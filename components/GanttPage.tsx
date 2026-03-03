'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { SectionWithTasks, TaskWithCells, TaskCell, Milestone, MONTHS, CURRENT_MONTH_ID } from '@/lib/database.types'
import { GanttTable } from './GanttTable'
import { EditPanel } from './EditPanel'
import { AddTaskModal } from './AddTaskModal'
import { MilestonePopover } from './MilestonePopover'
import { DatePopover } from './DatePopover'

interface GanttPageProps {
  initialSections: SectionWithTasks[]
  initialMilestones: Milestone[]
}

export function GanttPage({ initialSections, initialMilestones }: GanttPageProps) {
  const [sections, setSections] = useState<SectionWithTasks[]>(initialSections)
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones)
  const [editPanel, setEditPanel] = useState<{
    open: boolean
    taskId: string
    monthId: number
    taskName: string
    secName: string
    cell: TaskCell | null
  } | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [addModalSectionId, setAddModalSectionId] = useState<string | undefined>(undefined)
  const [milestonePopover, setMilestonePopover] = useState<{
    monthId: number
    anchor: DOMRect
  } | null>(null)
  const [datePopover, setDatePopover] = useState<{
    taskId: string
    currentDate: string | null
    anchor: DOMRect
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentFilter, setCurrentFilter] = useState('すべて')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }, [])

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('schedule-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_cells' },
        (payload: any) => {
          setSections(prev =>
            prev.map(sec => ({
              ...sec,
              tasks: sec.tasks.map(task => {
                if (task.id === payload.new?.task_id || task.id === payload.old?.task_id) {
                  return {
                    ...task,
                    cells: task.cells
                      .filter(c => c.id !== payload.old?.id)
                      .concat(payload.new ? [payload.new] : [])
                      .filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i)
                  }
                }
                return task
              })
            }))
          )
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            setSections(prev =>
              prev.map(sec => ({
                ...sec,
                tasks: sec.tasks.filter(t => t.id !== payload.old?.id)
              }))
            )
          } else {
            setSections(prev =>
              prev.map(sec => {
                const existing = sec.tasks.find(t => t.id === payload.new?.id)
                if (existing) {
                  return {
                    ...sec,
                    tasks: sec.tasks.map(t => (t.id === payload.new?.id ? { ...t, ...payload.new } : t))
                  }
                }
                return sec
              })
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            setMilestones(prev => prev.filter(m => m.month_id !== payload.old?.month_id))
          } else {
            setMilestones(prev => {
              const exists = prev.find(m => m.month_id === payload.new?.month_id)
              if (exists) {
                return prev.map(m => (m.month_id === payload.new?.month_id ? { ...m, ...payload.new } : m))
              }
              return [...prev, payload.new]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sections' },
        (payload: any) => {
          setSections(prev =>
            prev.map(sec => (sec.id === payload.new?.id ? { ...sec, ...payload.new } : sec))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const daysUntilEvent = Math.ceil((new Date(2026, 9, 17).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  const completedCount = sections.reduce(
    (total, sec) => total + sec.tasks.reduce((t, task) => {
      const hasCompleted = task.cells.some(c => c.content === '済')
      return t + (hasCompleted ? 1 : 0)
    }, 0),
    0
  )
  const totalTasks = sections.reduce((total, sec) => total + sec.tasks.length, 0)
  const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  const filteredSections = sections.map(sec => ({
    ...sec,
    tasks: sec.tasks.filter(task => {
      const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter =
        currentFilter === 'すべて' ||
        (currentFilter === '未定'
          ? !task.cells.some(c => c.content === '済' || c.content === '予定')
          : task.cells.some(c => c.content === currentFilter))
      return matchesSearch && matchesFilter
    })
  }))

  const handleCellClick = (taskId: string, monthId: number, taskName: string, secName: string, cell: TaskCell | null) => {
    setDatePopover(null)      // 排他制御
    setMilestonePopover(null) // 排他制御
    setEditPanel({ open: true, taskId, monthId, taskName, secName, cell: cell || null })
  }

  const handleTaskNameEdit = async (taskId: string, newName: string) => {
    await (supabase.from('tasks') as any).update({ name: newName }).eq('id', taskId)
  }

  const handleSectionNameEdit = async (sectionId: string, newName: string) => {
    await (supabase.from('sections') as any).update({ name: newName }).eq('id', sectionId)
  }

  const handleToggleSection = async (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId)
    if (sec) {
      await (supabase.from('sections') as any).update({ is_open: !sec.is_open }).eq('id', sectionId)
    }
  }

  const handleAddTaskToSection = (sectionId: string) => {
    setAddModalSectionId(sectionId)
    setAddModal(true)
  }

  const handleTaskAdded = (task: TaskWithCells) => {
    setSections(prev =>
      prev.map(sec =>
        sec.id === task.section_id ? { ...sec, tasks: [...sec.tasks, task] } : sec
      )
    )
    showToast(`「${task.name}」を追加しました ✓`)
  }

  const handleTaskDeleted = (taskId: string) => {
    setSections(prev =>
      prev.map(sec => ({ ...sec, tasks: sec.tasks.filter(t => t.id !== taskId) }))
    )
    showToast('タスクを削除しました')
  }

  return (
    <div className="w-full h-screen flex flex-col bg-white">
      {/* Header Row 1 */}
      <div style={{ height:56, background:'#0D2137', color:'white', display:'flex', alignItems:'center', padding:'0 18px', gap:12, flexShrink:0, boxShadow:'0 2px 14px rgba(0,0,0,.35)', position:'relative' }}>
        {/* Logo: /public/logo.jpg があれば表示、なければ桜絵文字 */}
        <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#E8C96A,#9a7230)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
          <img
            src="/logo.jpg"
            alt="logo"
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; (e.currentTarget.nextSibling as HTMLElement).style.display='flex' }}
          />
          <span style={{ display:'none', width:'100%', height:'100%', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>🌸</span>
        </div>
        {/* Title */}
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <div style={{ fontSize:'.9rem', fontWeight:700, color:'#fff', lineHeight:1.2 }}>51期 六華同窓会</div>
          <div style={{ fontSize:'.63rem', color:'rgba(255,255,255,.42)', lineHeight:1 }}>スケジュール管理 ｜ 執行部</div>
        </div>
        <div style={{ width:1, height:20, background:'rgba(255,255,255,.12)', flexShrink:0 }}></div>
        {/* Countdown */}
        <div style={{ background:'rgba(201,168,76,.13)', border:'1px solid rgba(201,168,76,.3)', borderRadius:7, padding:'5px 11px', color:'#E8C96A', fontSize:'.73rem', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
          🎉 本番まで <span style={{ fontSize:'1.05rem', fontWeight:700 }}>{daysUntilEvent}</span> 日
        </div>
        <div style={{ flex:1 }}></div>
        {/* Progress */}
        <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.55)', whiteSpace:'nowrap' }}>
          進捗: <span style={{ color:'#E8C96A', fontWeight:700 }}>{completedCount}/{totalTasks} ({percentage}%)</span>
        </div>
        {/* Add button */}
        <button
          onClick={() => { setAddModalSectionId(undefined); setAddModal(true) }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', background:'#C9A84C', color:'#0D2137', border:'none', borderRadius:7, fontSize:'.76rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
        >
          ＋ タスク追加
        </button>
      </div>

      {/* Header Row 2 */}
      <div style={{ height:38, display:'flex', alignItems:'center', padding:'0 18px', gap:8, background:'#0a1828', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
        {/* Search */}
        <div style={{ position:'relative', flex:1, maxWidth:220 }}>
          <input
            type="text"
            placeholder="タスクを検索…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width:'100%', padding:'5px 10px 5px 28px', border:'1px solid rgba(255,255,255,.12)', borderRadius:6, background:'rgba(255,255,255,.08)', color:'white', fontSize:'.76rem', fontFamily:'inherit', outline:'none' }}
          />
          <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:'.72rem', pointerEvents:'none' }}>🔍</span>
        </div>
        {/* Filter pills */}
        <div style={{ display:'flex', gap:4 }}>
          {[
            { key:'すべて', label:'すべて' },
            { key:'済',    label:'✓ 済' },
            { key:'予定',  label:'● 予定' },
            { key:'未定',  label:'— 未定' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCurrentFilter(key)}
              style={{
                padding:'3px 10px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
                fontSize:'.7rem', fontWeight:600, transition:'all .12s',
                border: currentFilter === key ? '1px solid rgba(201,168,76,.5)' : '1px solid rgba(255,255,255,.15)',
                background: currentFilter === key ? 'rgba(201,168,76,.18)' : 'transparent',
                color: currentFilter === key ? '#E8C96A' : 'rgba(255,255,255,.55)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          <span style={{ padding:'2px 7px', borderRadius:10, fontSize:'.62rem', fontWeight:700, background:'#D1FAE5', color:'#059669' }}>✓ 済</span>
          <span style={{ padding:'2px 7px', borderRadius:10, fontSize:'.62rem', fontWeight:700, background:'#FEF3C7', color:'#D97706' }}>● 予定</span>
          <span style={{ padding:'2px 7px', borderRadius:10, fontSize:'.62rem', fontWeight:700, background:'#DBEAFE', color:'#2563EB' }}>日 日付入り</span>
        </div>
      </div>

      {/* Main Table */}
      <GanttTable
        sections={filteredSections}
        milestones={milestones}
        currentFilter={currentFilter}
        searchQuery={searchQuery}
        onCellClick={handleCellClick}
        onMilestoneClick={(monthId, anchor) => {
          setEditPanel(null)      // 排他制御
          setDatePopover(null)    // 排他制御
          setMilestonePopover({ monthId, anchor })
        }}
        onDateChipClick={(taskId, dueDate, anchor) => {
          setEditPanel(null)         // 排他制御
          setMilestonePopover(null)  // 排他制御
          setDatePopover({ taskId, currentDate: dueDate, anchor })
        }}
        onTaskNameEdit={handleTaskNameEdit}
        onSectionNameEdit={handleSectionNameEdit}
        onToggleSection={handleToggleSection}
        onAddTaskToSection={handleAddTaskToSection}
      />

      {/* Edit Panel */}
      {editPanel?.open && (
        <EditPanel
          taskId={editPanel.taskId}
          monthId={editPanel.monthId}
          taskName={editPanel.taskName}
          secName={editPanel.secName}
          cell={editPanel.cell}
          onClose={() => setEditPanel(null)}
          onSaved={cell => {
            setSections(prev =>
              prev.map(sec => ({
                ...sec,
                tasks: sec.tasks.map(task =>
                  task.id === editPanel.taskId
                    ? { ...task, cells: task.cells.filter(c => c.id !== cell.id).concat(cell) }
                    : task
                )
              }))
            )
            showToast('保存しました ✓')
            setEditPanel(null)
          }}
          onDeleted={(taskId, monthId) => {
            setSections(prev =>
              prev.map(sec => ({
                ...sec,
                tasks: sec.tasks.map(task =>
                  task.id === taskId
                    ? { ...task, cells: task.cells.filter(c => c.month_id !== monthId) }
                    : task
                )
              }))
            )
            showToast('セルを削除しました')
            setEditPanel(null)
          }}
          onTaskDeleted={handleTaskDeleted}
        />
      )}

      {/* Add Task Modal */}
      {addModal && (
        <AddTaskModal
          sections={sections}
          preselectSectionId={addModalSectionId}
          onClose={() => {
            setAddModal(false)
            setAddModalSectionId(undefined)
          }}
          onAdded={handleTaskAdded}
        />
      )}

      {/* Milestone Popover */}
      {milestonePopover && (
        <MilestonePopover
          monthId={milestonePopover.monthId}
          milestone={milestones.find(m => m.month_id === milestonePopover.monthId) || null}
          anchor={milestonePopover.anchor}
          onClose={() => setMilestonePopover(null)}
          onSaved={m => {
            setMilestones(prev => {
              const exists = prev.find(x => x.month_id === m.month_id)
              return exists
                ? prev.map(x => (x.month_id === m.month_id ? m : x))
                : [...prev, m]
            })
            setMilestonePopover(null)
          }}
          onDeleted={monthId => {
            setMilestones(prev => prev.filter(m => m.month_id !== monthId))
            setMilestonePopover(null)
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:22, left:'50%', transform:'translateX(-50%)', background:'#0F172A', color:'white', padding:'8px 20px', borderRadius:20, fontSize:'.78rem', fontWeight:600, zIndex:400, boxShadow:'0 4px 20px rgba(0,0,0,.25)', whiteSpace:'nowrap' }}>
          {toast}
        </div>
      )}

      {/* Date Popover */}
      {datePopover && (
        <DatePopover
          taskId={datePopover.taskId}
          currentDate={datePopover.currentDate}
          anchor={datePopover.anchor}
          onClose={() => setDatePopover(null)}
          onSaved={(taskId, date) => {
            setSections(prev =>
              prev.map(sec => ({
                ...sec,
                tasks: sec.tasks.map(task =>
                  task.id === taskId
                    ? { ...task, due_date: date }
                    : task
                )
              }))
            )
            setDatePopover(null)
          }}
        />
      )}
    </div>
  )
}

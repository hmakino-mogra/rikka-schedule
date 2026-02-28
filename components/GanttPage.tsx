'use client'

import { useState, useEffect } from 'react'
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
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2200)
    setTimeout(() => setToastMsg(null), 2600)
  }

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
        currentFilter === 'すべて' ? true :
        currentFilter === '未定'   ? !task.cells.some(c => c.content === '済' || c.content === '予定') :
        task.cells.some(c => c.content === currentFilter)
      return matchesSearch && matchesFilter
    })
  }))

  const handleCellClick = (taskId: string, monthId: number, taskName: string, secName: string, cell: TaskCell | null) => {
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
        sec.id === task.section_id
          ? {
              ...sec,
              tasks: [...sec.tasks, task]
            }
          : sec
      )
    )
  }

  return (
    <div className="w-full h-screen flex flex-col bg-[#EEF2F7]">
      {/* ── Header Row 1 ── */}
      <div className="relative h-14 bg-[#0D2137] text-white flex items-center px-4 gap-3 z-10"
           style={{ boxShadow: '0 2px 14px rgba(0,0,0,0.35)' }}>
        {/* Gold accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1"
             style={{ background: 'linear-gradient(180deg,#E8C96A,#C9A84C)' }} />
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ml-1"
             style={{ background: 'linear-gradient(135deg,#E8C96A,#9a7230)' }}>🌸</div>
        <div className="flex-shrink-0">
          <div className="text-[14px] font-bold leading-tight">51期 六華同窓会</div>
          <div className="text-[11px] opacity-40 leading-tight">スケジュール管理</div>
        </div>
        <div className="w-px h-5 bg-white/10 flex-shrink-0" />
        {/* Gold countdown */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#E8C96A] text-[12px] flex-shrink-0"
             style={{ background: 'rgba(201,168,76,0.13)', border: '1px solid rgba(201,168,76,0.3)' }}>
          🎉 本番まで <span className="text-[18px] font-bold leading-none">{daysUntilEvent}</span> 日
        </div>
        <div className="flex-1" />
        <span className="text-[12px] opacity-55 flex-shrink-0">
          進捗: <span className="text-[#E8C96A] font-bold">{completedCount}/{totalTasks} ({percentage}%)</span>
        </span>
        <button
          onClick={() => { setAddModalSectionId(undefined); setAddModal(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold bg-[#C9A84C] text-[#0D2137] rounded-lg hover:bg-[#E8C96A] transition-all flex-shrink-0"
          style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}
        >＋ タスク追加</button>
      </div>

      {/* ── Header Row 2 ── */}
      <div className="h-[38px] flex items-center px-4 gap-2"
           style={{ background: 'rgba(0,0,0,0.18)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="relative flex-shrink-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] pointer-events-none">🔍</span>
          <input
            type="text" placeholder="タスクを検索…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="pl-7 pr-3 py-1 text-[12px] rounded-md focus:outline-none"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'white',
              width: '200px',
            }}
          />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'すべて', label: 'すべて' },
            { key: '済',     label: '✓ 済' },
            { key: '予定',   label: '● 予定' },
            { key: '未定',   label: '— 未定' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCurrentFilter(key)}
              className={`px-3 py-0.5 rounded-full text-[11px] font-semibold transition-all ${
                currentFilter === key
                  ? 'bg-[#C9A84C]/20 border border-[#C9A84C]/50 text-[#E8C96A]'
                  : 'bg-transparent border border-white/15 text-white/55 hover:border-white/30 hover:text-white/80'
              }`}
            >{label}</button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-emerald-100/90 text-emerald-700 font-bold">✓ 済</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100/90 text-amber-700 font-bold">● 予定</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-100/90 text-blue-700 font-bold">日 日付入り</span>
          <span className="text-white/25 text-[10px] ml-2">｜ ダブルクリックでタスク名を編集</span>
        </div>
      </div>

      {/* Main Table */}
      <GanttTable
        sections={filteredSections}
        milestones={milestones}
        currentFilter={currentFilter}
        searchQuery={searchQuery}
        onCellClick={handleCellClick}
        onMilestoneClick={(monthId, anchor) => setMilestonePopover({ monthId, anchor })}
        onDateChipClick={(taskId, dueDate, anchor) => setDatePopover({ taskId, currentDate: dueDate, anchor })}
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
                    ? {
                        ...task,
                        cells: task.cells.filter(c => c.id !== cell.id).concat(cell)
                      }
                    : task
                )
              }))
            )
            setEditPanel(null)
            showToast('保存しました ✓')
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
            setEditPanel(null)
            showToast('削除しました')
          }}
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

      {/* ── Toast ── */}
      {toastMsg && (
        <div
          className="fixed left-1/2 px-5 py-2 rounded-full text-[13px] font-semibold text-white z-[200] pointer-events-none"
          style={{
            bottom: '24px',
            background: '#0F172A',
            transform: `translateX(-50%) translateY(${toastVisible ? '0' : '12px'})`,
            opacity: toastVisible ? 1 : 0,
            transition: 'opacity 0.25s, transform 0.25s',
          }}
        >{toastMsg}</div>
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

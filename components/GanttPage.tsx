'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { SectionWithTasks, TaskWithCells, TaskCell, Milestone, MONTHS, CURRENT_MONTH_ID } from '@/lib/database.types'
import { GanttTable } from './GanttTable'
import { EditPanel } from './EditPanel'
import { AddTaskModal } from './AddTaskModal'
import { AddSectionModal } from './AddSectionModal'
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
    sectionId: string
    cell: TaskCell | null
    taskLinkedSectionIds: string[] | null
  } | null>(null)
  const [addModal, setAddModal] = useState(false)
  const [addModalSectionId, setAddModalSectionId] = useState<string | undefined>(undefined)
  const [addSectionModal, setAddSectionModal] = useState(false)
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
  const [sectionFilter, setSectionFilter] = useState('すべて')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }, [])

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel('schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_cells' }, (payload: any) => {
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
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          setSections(prev =>
            prev.map(sec => ({ ...sec, tasks: sec.tasks.filter(t => t.id !== payload.old?.id) }))
          )
        } else {
          setSections(prev =>
            prev.map(sec => {
              const existing = sec.tasks.find(t => t.id === payload.new?.id)
              if (existing) {
                return { ...sec, tasks: sec.tasks.map(t => t.id === payload.new?.id ? { ...t, ...payload.new } : t) }
              }
              return sec
            })
          )
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          setMilestones(prev => prev.filter(m => m.id !== payload.old?.id))
        } else if (payload.eventType === 'UPDATE') {
          setMilestones(prev => prev.map(m => m.id === payload.new?.id ? { ...m, ...payload.new } : m))
        } else {
          // INSERT: onAdded で既に追加済みの場合は重複しないようにする
          setMilestones(prev =>
            prev.find(m => m.id === payload.new?.id) ? prev : [...prev, payload.new]
          )
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, (payload: any) => {
        setSections(prev =>
          prev.map(sec => sec.id === payload.new?.id ? { ...sec, ...payload.new } : sec)
        )
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── 統計 ──
  const daysUntilEvent = Math.ceil((new Date(2026, 9, 17).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const daysUntilTokyo = Math.ceil((new Date(2026, 5, 20).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  const completedCount = sections.reduce(
    (total, sec) => total + sec.tasks.filter(t => t.cells.some(c => c.content === '済')).length, 0
  )
  const totalTasks = sections.reduce((total, sec) => total + sec.tasks.length, 0)
  const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0

  // ── フィルタリング（リンクタスクを各セクションに展開・ソート）──
  const allTasks = sections.flatMap(sec => sec.tasks)
  const filteredSections = sections
    .filter(sec => sectionFilter === 'すべて' || sec.id === sectionFilter)
    .map(sec => {
      const linkedOrders = ((sec.linked_task_orders ?? {}) as Record<string, number>)
      // 他セクションのタスクのうち、このセクションにリンクされているものを追加（表示順を付与）
      const linkedTasks = allTasks.filter(
        task => task.section_id !== sec.id && (task.linked_section_ids ?? []).includes(sec.id)
      ).map(task => ({ ...task, sort_order: linkedOrders[task.id] ?? 99999 }))
      const allSecTasks = [...sec.tasks, ...linkedTasks]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      return {
        ...sec,
        tasks: allSecTasks.filter(task => {
          const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase())
          const matchesFilter =
            currentFilter === 'すべて' ||
            (currentFilter === '未定'
              ? !task.cells.some(c => c.content === '済' || c.content === '予定')
              : task.cells.some(c => c.content === currentFilter))
          return matchesSearch && matchesFilter
        })
      }
    })

  // ── ハンドラー ──
  const handleCellClick = (taskId: string, monthId: number, taskName: string, secName: string, cell: TaskCell | null, sectionId: string) => {
    setDatePopover(null)
    setMilestonePopover(null)
    const task = sections.flatMap(s => s.tasks).find(t => t.id === taskId)
    setEditPanel({ open: true, taskId, monthId, taskName, secName, sectionId, cell: cell || null, taskLinkedSectionIds: task?.linked_section_ids ?? null })
  }

  const handleTaskNameEdit = async (taskId: string, newName: string) => {
    await (supabase.from('tasks') as any).update({ name: newName }).eq('id', taskId)
    setSections(prev => prev.map(sec => ({ ...sec, tasks: sec.tasks.map(t => t.id === taskId ? { ...t, name: newName } : t) })))
  }

  const handleSectionNameEdit = async (sectionId: string, newName: string) => {
    await (supabase.from('sections') as any).update({ name: newName }).eq('id', sectionId)
    setSections(prev => prev.map(sec => sec.id === sectionId ? { ...sec, name: newName } : sec))
  }

  const handleToggleSection = async (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId)
    if (sec) {
      await (supabase.from('sections') as any).update({ is_open: !sec.is_open }).eq('id', sectionId)
      setSections(prev => prev.map(s => s.id === sectionId ? { ...s, is_open: !s.is_open } : s))
    }
  }

  const handleAddTaskToSection = (sectionId: string) => {
    setAddModalSectionId(sectionId)
    setAddModal(true)
  }

  const handleTaskAdded = (task: TaskWithCells) => {
    setSections(prev =>
      prev.map(sec => sec.id === task.section_id ? { ...sec, tasks: [...sec.tasks, task] } : sec)
    )
    showToast(`「${task.name}」を追加しました ✓`)
  }

  const handleTaskDeleted = (taskId: string) => {
    setSections(prev => prev.map(sec => ({ ...sec, tasks: sec.tasks.filter(t => t.id !== taskId) })))
    showToast('タスクを削除しました')
  }

  const handleSectionAdded = (section: any) => {
    setSections(prev => [...prev, section])
    showToast(`「${section.name}」セクションを追加しました ✓`)
  }

  // ── セクション削除 ──
  const handleSectionDelete = async (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId)
    if (!sec) return
    const taskCount = sec.tasks.length
    const msg = taskCount > 0
      ? `「${sec.name}」を削除しますか？\n${taskCount}個のタスクも一緒に削除されます。\nこの操作は元に戻せません。`
      : `「${sec.name}」を削除しますか？`
    if (!confirm(msg)) return
    await (supabase.from('sections') as any).delete().eq('id', sectionId)
    setSections(prev => prev.filter(s => s.id !== sectionId))
    showToast(`「${sec.name}」を削除しました`)
  }

  // ── セクション並べ替え ──
  const handleSectionMove = async (sectionId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === sectionId)
    if (direction === 'up' && idx <= 0) return
    if (direction === 'down' && idx >= sections.length - 1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const newSections = [...sections]
    ;[newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]]
    setSections(newSections)
    await Promise.all([
      (supabase.from('sections') as any).update({ sort_order: swapIdx }).eq('id', sections[idx].id),
      (supabase.from('sections') as any).update({ sort_order: idx }).eq('id', sections[swapIdx].id),
    ])
  }

  // ── タスクのドラッグ並び替え（リンクタスク対応）──
  const handleTaskReorder = (sectionId: string, fromTaskId: string, toTaskId: string, insertBefore: boolean) => {
    setSections(prev => {
      const section = prev.find(s => s.id === sectionId)
      if (!section) return prev

      // このセクションの表示タスク一覧を構築（ネイティブ + リンク）
      const linkedOrders = ((section.linked_task_orders ?? {}) as Record<string, number>)
      const allDisplayed = [
        ...section.tasks,
        ...prev.flatMap(s => s.tasks).filter(
          t => t.section_id !== sectionId && (t.linked_section_ids ?? []).includes(sectionId)
        ).map(t => ({ ...t, sort_order: linkedOrders[t.id] ?? 99999 }))
      ].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      const fromIdx = allDisplayed.findIndex(t => t.id === fromTaskId)
      const toIdx   = allDisplayed.findIndex(t => t.id === toTaskId)
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return prev

      const reordered = [...allDisplayed]
      const [moved] = reordered.splice(fromIdx, 1)
      const newToIdx = reordered.findIndex(t => t.id === toTaskId)
      reordered.splice(insertBefore ? newToIdx : newToIdx + 1, 0, moved)

      const nativeUpdates: { id: string; sort_order: number }[] = []
      const newLinkedOrders: Record<string, number> = { ...linkedOrders }

      reordered.forEach((t, i) => {
        const newOrder = (i + 1) * 10
        if (t.section_id === sectionId) {
          nativeUpdates.push({ id: t.id, sort_order: newOrder })
        } else {
          newLinkedOrders[t.id] = newOrder
        }
      })

      // DB保存
      Promise.all([
        ...nativeUpdates.map(({ id, sort_order }) =>
          (supabase.from('tasks') as any).update({ sort_order }).eq('id', id)
        ),
        (supabase.from('sections') as any)
          .update({ linked_task_orders: newLinkedOrders })
          .eq('id', sectionId)
      ]).catch(console.error)

      // ローカルstate更新
      return prev.map(sec => {
        if (sec.id !== sectionId) return sec
        return {
          ...sec,
          linked_task_orders: newLinkedOrders,
          tasks: sec.tasks.map(t => {
            const u = nativeUpdates.find(o => o.id === t.id)
            return u ? { ...t, sort_order: u.sort_order } : t
          })
        }
      })
    })
  }

  // ── タスクのセクション間移動 ──
  const handleTaskSectionChange = (taskId: string, newSectionId: string) => {
    setSections(prev => {
      let movedTask: TaskWithCells | undefined
      const withoutTask = prev.map(sec => {
        const task = sec.tasks.find(t => t.id === taskId)
        if (task) movedTask = { ...task, section_id: newSectionId }
        return { ...sec, tasks: sec.tasks.filter(t => t.id !== taskId) }
      })
      if (!movedTask) return prev
      return withoutTask.map(sec =>
        sec.id === newSectionId ? { ...sec, tasks: [...sec.tasks, movedTask!] } : sec
      )
    })
    showToast('セクションを移動しました ✓')
    setEditPanel(null)
  }

  return (
    <div className="w-full h-screen flex flex-col bg-white">
      {/* Header Row 1 */}
      <div style={{ height:66, background:'#0D2137', color:'white', display:'flex', alignItems:'center', padding:'0 20px', gap:14, flexShrink:0, boxShadow:'0 2px 14px rgba(0,0,0,.35)', position:'relative' }}>
        <div style={{ width:38, height:38, borderRadius:9, background:'linear-gradient(135deg,#E8C96A,#9a7230)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
          <img
            src="/logo.jpg"
            alt="logo"
            style={{ width:'100%', height:'100%', objectFit:'cover' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; (e.currentTarget.nextSibling as HTMLElement).style.display='flex' }}
          />
          <span style={{ display:'none', width:'100%', height:'100%', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>🌸</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <div style={{ fontSize:'.98rem', fontWeight:700, color:'#fff', lineHeight:1.2 }}>51期 六華同窓会</div>
          <div style={{ fontSize:'.67rem', color:'rgba(255,255,255,.42)', lineHeight:1 }}>スケジュール管理 ｜ 執行部</div>
        </div>
        <div style={{ width:1, height:24, background:'rgba(255,255,255,.12)', flexShrink:0 }}></div>
        <div style={{ background:'rgba(201,168,76,.13)', border:'1px solid rgba(201,168,76,.3)', borderRadius:8, padding:'7px 13px', color:'#E8C96A', fontSize:'.76rem', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
          🎉 六華同窓会まで <span style={{ fontSize:'1.1rem', fontWeight:700 }}>{daysUntilEvent}</span> 日
        </div>
        <div style={{ background:'rgba(96,165,250,.1)', border:'1px solid rgba(96,165,250,.3)', borderRadius:8, padding:'7px 13px', color:'#93C5FD', fontSize:'.76rem', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
          🗼 東京六華まで <span style={{ fontSize:'1.1rem', fontWeight:700 }}>{daysUntilTokyo}</span> 日
        </div>
        <div style={{ flex:1 }}></div>
        <div style={{ fontSize:'.72rem', color:'rgba(255,255,255,.55)', whiteSpace:'nowrap' }}>
          進捗: <span style={{ color:'#E8C96A', fontWeight:700 }}>{completedCount}/{totalTasks} ({percentage}%)</span>
        </div>
        <button
          onClick={() => setAddSectionModal(true)}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', background:'rgba(201,168,76,.15)', color:'#E8C96A', border:'1px solid rgba(201,168,76,.35)', borderRadius:7, fontSize:'.76rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
        >
          ＋ セクション追加
        </button>
        <button
          onClick={() => { setAddModalSectionId(undefined); setAddModal(true) }}
          style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', background:'#C9A84C', color:'#0D2137', border:'none', borderRadius:7, fontSize:'.76rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}
        >
          ＋ タスク追加
        </button>
      </div>

      {/* Header Row 2 — 検索 / ステータスフィルター */}
      <div style={{ height:44, display:'flex', alignItems:'center', padding:'0 18px', gap:10, background:'#0a1828', borderTop:'1px solid rgba(255,255,255,.06)', flexShrink:0 }}>
        {/* 検索 */}
        <div style={{ position:'relative', flexShrink:0, width:170 }}>
          <input
            type="text"
            placeholder="タスクを検索…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width:'100%', padding:'5px 10px 5px 28px', border:'1px solid rgba(255,255,255,.15)', borderRadius:7, background:'rgba(255,255,255,.09)', color:'white', fontSize:'.74rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
          />
          <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:'.72rem', pointerEvents:'none' }}>🔍</span>
        </div>

        {/* 区切り線 */}
        <div style={{ width:1, height:20, background:'rgba(255,255,255,.15)', flexShrink:0 }} />

        {/* ステータスフィルター */}
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
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
                padding:'4px 12px', borderRadius:14, cursor:'pointer', fontFamily:'inherit',
                fontSize:'.73rem', fontWeight:600, transition:'all .12s', whiteSpace:'nowrap',
                border: currentFilter === key ? '1px solid rgba(201,168,76,.5)' : '1px solid rgba(255,255,255,.15)',
                background: currentFilter === key ? 'rgba(201,168,76,.18)' : 'transparent',
                color: currentFilter === key ? '#E8C96A' : 'rgba(255,255,255,.55)',
              }}
            >{label}</button>
          ))}
        </div>

        {/* 区切り線 */}
        <div style={{ width:1, height:20, background:'rgba(255,255,255,.15)', flexShrink:0 }} />

        {/* 部フィルター（横スクロール対応） */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', flex:1, alignItems:'center' }}>
          <button
            onClick={() => setSectionFilter('すべて')}
            style={{
              padding:'4px 12px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', flexShrink:0,
              fontSize:'.73rem', fontWeight:600, transition:'all .12s', whiteSpace:'nowrap',
              border: sectionFilter === 'すべて' ? '1px solid rgba(255,255,255,.4)' : '1px solid rgba(255,255,255,.12)',
              background: sectionFilter === 'すべて' ? 'rgba(255,255,255,.15)' : 'transparent',
              color: sectionFilter === 'すべて' ? 'white' : 'rgba(255,255,255,.5)',
            }}
          >全部署</button>
          {sections.map(sec => {
            const isSelected = sectionFilter === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => setSectionFilter(isSelected ? 'すべて' : sec.id)}
                style={{
                  padding:'4px 12px', borderRadius:14, cursor:'pointer', fontFamily:'inherit', flexShrink:0,
                  fontSize:'.73rem', fontWeight:600, transition:'all .12s', whiteSpace:'nowrap',
                  display:'flex', alignItems:'center', gap:5,
                  border: isSelected ? `1px solid ${sec.color || '#94a3b8'}` : '1px solid rgba(255,255,255,.12)',
                  background: isSelected ? `${sec.color}28` : 'transparent',
                  color: isSelected ? (sec.color || 'white') : 'rgba(255,255,255,.5)',
                }}
              >
                <span style={{ width:6, height:6, borderRadius:'50%', background: sec.color || '#94a3b8', flexShrink:0, display:'inline-block' }}></span>
                {sec.name}
                {isSelected && <span style={{ fontSize:'.6rem', marginLeft:1, opacity:.7 }}>✕</span>}
              </button>
            )
          })}
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
          setEditPanel(null)
          setDatePopover(null)
          setMilestonePopover({ monthId, anchor })
        }}
        onDateChipClick={(taskId, dueDate, anchor) => {
          setEditPanel(null)
          setMilestonePopover(null)
          setDatePopover({ taskId, currentDate: dueDate, anchor })
        }}
        onTaskNameEdit={handleTaskNameEdit}
        onSectionNameEdit={handleSectionNameEdit}
        onToggleSection={handleToggleSection}
        onAddTaskToSection={handleAddTaskToSection}
        onSectionDelete={handleSectionDelete}
        onSectionMove={handleSectionMove}
        onTaskReorder={handleTaskReorder}
      />

      {/* Edit Panel */}
      {editPanel?.open && (
        <EditPanel
          taskId={editPanel.taskId}
          monthId={editPanel.monthId}
          taskName={editPanel.taskName}
          secName={editPanel.secName}
          sectionId={editPanel.sectionId}
          cell={editPanel.cell}
          sections={sections}
          taskLinkedSectionIds={editPanel.taskLinkedSectionIds}
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
          onSectionChange={handleTaskSectionChange}
          onLinkedSectionsChanged={(taskId, linkedIds) => {
            setSections(prev =>
              prev.map(sec => ({
                ...sec,
                tasks: sec.tasks.map(task =>
                  task.id === taskId ? { ...task, linked_section_ids: linkedIds } : task
                )
              }))
            )
          }}
          onDueDateChanged={(taskId, dueDate) => {
            setSections(prev =>
              prev.map(sec => ({
                ...sec,
                tasks: sec.tasks.map(task =>
                  task.id === taskId ? { ...task, due_date: dueDate } : task
                )
              }))
            )
          }}
        />
      )}

      {/* Add Task Modal */}
      {addModal && (
        <AddTaskModal
          sections={sections}
          preselectSectionId={addModalSectionId}
          onClose={() => { setAddModal(false); setAddModalSectionId(undefined) }}
          onAdded={handleTaskAdded}
        />
      )}

      {/* Add Section Modal */}
      {addSectionModal && (
        <AddSectionModal
          onClose={() => setAddSectionModal(false)}
          onAdded={handleSectionAdded}
        />
      )}

      {/* Milestone Popover */}
      {milestonePopover && (
        <MilestonePopover
          monthId={milestonePopover.monthId}
          milestonesForMonth={milestones.filter(m => m.month_id === milestonePopover.monthId)}
          anchor={milestonePopover.anchor}
          onClose={() => setMilestonePopover(null)}
          onAdded={m => {
            setMilestones(prev =>
              prev.find(x => x.id === m.id) ? prev : [...prev, m]
            )
          }}
          onUpdated={m => {
            setMilestones(prev => prev.map(x => x.id === m.id ? m : x))
          }}
          onDeleted={id => {
            setMilestones(prev => prev.filter(m => m.id !== id))
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
                tasks: sec.tasks.map(task => task.id === taskId ? { ...task, due_date: date } : task)
              }))
            )
            setDatePopover(null)
          }}
        />
      )}
    </div>
  )
}

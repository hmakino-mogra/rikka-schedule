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
    <div className="w-full h-screen flex flex-col bg-white">
      {/* Header Row 1 */}
      <div className="h-12 bg-[#0D2137] text-white flex items-center px-6 gap-4 border-b border-slate-300">
        <span className="text-xl">🌸</span>
        <div className="flex-1">
          <div className="text-sm font-semibold">51期 六華同窓会</div>
          <div className="text-xs opacity-75">スケジュール管理</div>
        </div>
        <div className="border-l border-slate-500 pl-4">
          <span className="text-xs text-[#C9A84C] font-semibold">あと {daysUntilEvent} 日</span>
        </div>
        <div className="flex-1"></div>
        <span className="text-xs opacity-75">進度: {completedCount}/{totalTasks} ({percentage}%)</span>
        <button
          onClick={() => {
            setAddModalSectionId(undefined)
            setAddModal(true)
          }}
          className="ml-6 px-3 py-1 text-xs font-semibold bg-[#C9A84C] text-[#0D2137] rounded hover:opacity-90"
        >
          ＋ タスク追加
        </button>
      </div>

      {/* Header Row 2 */}
      <div className="h-10 bg-slate-50 border-b border-slate-200 flex items-center px-6 gap-4">
        <input
          type="text"
          placeholder="検索..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
        />
        <div className="flex gap-2">
          {['すべて', '済', '予定', '未定'].map(filter => (
            <button
              key={filter}
              onClick={() => setCurrentFilter(filter)}
              className={`px-3 py-1 text-xs font-medium rounded ${
                currentFilter === filter
                  ? 'bg-[#0D2137] text-white'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex-1"></div>
        <div className="flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
            ✓ 済
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded">
            ● 予定
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded">
            未定
          </span>
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

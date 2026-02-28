'use client'

import { useState } from 'react'
import { SectionWithTasks, TaskWithCells, TaskCell, Milestone, MONTHS, CURRENT_MONTH_ID, fmtDate } from '@/lib/database.types'

interface Props {
  sections: SectionWithTasks[]
  milestones: Milestone[]
  currentFilter: string
  searchQuery: string
  onCellClick: (taskId: string, monthId: number, taskName: string, secName: string, cell: TaskCell | null) => void
  onMilestoneClick: (monthId: number, anchor: DOMRect) => void
  onDateChipClick: (taskId: string, dueDate: string | null, anchor: DOMRect) => void
  onTaskNameEdit: (taskId: string, newName: string) => void
  onSectionNameEdit: (sectionId: string, newName: string) => void
  onToggleSection: (sectionId: string) => void
  onAddTaskToSection: (sectionId: string) => void
}

export function GanttTable({
  sections,
  milestones,
  currentFilter,
  searchQuery,
  onCellClick,
  onMilestoneClick,
  onDateChipClick,
  onTaskNameEdit,
  onSectionNameEdit,
  onToggleSection,
  onAddTaskToSection,
}: Props) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')

  const handleTaskNameDoubleClick = (taskId: string, currentName: string) => {
    setEditingTaskId(taskId)
    setEditingTaskName(currentName)
  }

  const handleTaskNameSave = async (taskId: string) => {
    if (editingTaskName.trim()) {
      await onTaskNameEdit(taskId, editingTaskName.trim())
    }
    setEditingTaskId(null)
  }

  const handleSectionNameDoubleClick = (sectionId: string, currentName: string) => {
    setEditingSectionId(sectionId)
    setEditingSectionName(currentName)
  }

  const handleSectionNameSave = async (sectionId: string) => {
    if (editingSectionName.trim()) {
      await onSectionNameEdit(sectionId, editingSectionName.trim())
    }
    setEditingSectionId(null)
  }

  const renderStatusBadge = (content: string | null) => {
    if (!content) return null
    if (content === '済') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">✓ 済</span>
    }
    if (content === '予定') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">● 予定</span>
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{content}</span>
  }

  return (
    <div className="custom-scroll overflow-auto h-[calc(100vh-94px)]">
      <table className="border-collapse w-full">
        <thead>
          {/* Month headers */}
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-[#0D2137] text-white w-[248px] min-w-[248px] max-w-[248px] border border-slate-300 h-8"></th>
            {MONTHS.map(month => {
              const isCurrentMonth = month.id === CURRENT_MONTH_ID
              const isMainEvent = (month as any).isMain
              return (
                <th
                  key={month.id}
                  className={`sticky top-0 z-10 border border-slate-300 h-8 text-center text-xs font-semibold w-20 min-w-[80px] ${
                    isMainEvent
                      ? 'bg-red-900 text-white'
                      : isCurrentMonth
                      ? 'bg-blue-800 text-white'
                      : 'bg-[#0D2137] text-white'
                  }`}
                >
                  {month.label}
                </th>
              )
            })}
          </tr>

          {/* Milestone strip */}
          <tr>
            <th className="sticky left-0 top-8 z-20 bg-slate-100 border border-slate-300 h-6"></th>
            {MONTHS.map(month => {
              const milestone = milestones.find(m => m.month_id === month.id)
              const isCurrentMonth = month.id === CURRENT_MONTH_ID
              const isMainEvent = (month as any).isMain
              return (
                <td
                  key={month.id}
                  onClick={e => onMilestoneClick(month.id, e.currentTarget.getBoundingClientRect())}
                  className={`sticky top-8 z-10 border border-slate-300 h-6 text-xs cursor-pointer hover:opacity-80 overflow-hidden text-ellipsis whitespace-nowrap px-1 ${
                    isMainEvent
                      ? 'bg-red-50/30'
                      : isCurrentMonth
                      ? 'bg-blue-50/40'
                      : 'bg-white'
                  } ${milestone ? 'text-slate-700 font-medium' : 'text-slate-400'}`}
                >
                  {milestone && (
                    <span className={milestone.is_main ? 'text-red-700 font-semibold' : 'text-slate-700'}>
                      {milestone.text}
                    </span>
                  )}
                </td>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {sections.map((section, secIdx) => (
            <tbody key={section.id}>
              {/* Section Header */}
              <tr>
                <td className="sticky left-0 z-10 bg-slate-200 border border-slate-300 px-3 py-2 h-8 flex items-center gap-2 min-w-[248px] max-w-[248px]">
                  <button
                    onClick={() => onToggleSection(section.id)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-800"
                  >
                    {section.is_open ? '▼' : '▶'}
                  </button>
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0`}
                    style={{ backgroundColor: section.color || '#94a3b8' }}
                  ></span>
                  <span
                    onDoubleClick={() => handleSectionNameDoubleClick(section.id, section.name)}
                    className="font-semibold text-sm text-slate-700 flex-1 cursor-pointer hover:text-slate-900"
                  >
                    {editingSectionId === section.id ? (
                      <input
                        autoFocus
                        value={editingSectionName}
                        onChange={e => setEditingSectionName(e.target.value)}
                        onBlur={() => handleSectionNameSave(section.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSectionNameSave(section.id)
                          if (e.key === 'Escape') setEditingSectionId(null)
                        }}
                        className="text-sm font-semibold border border-slate-300 rounded px-1 py-0 w-full"
                      />
                    ) : (
                      section.name
                    )}
                  </span>
                  <span className="text-xs text-slate-600">{section.tasks.length}</span>
                  <div className="flex-1 max-w-[60px]">
                    <div className="bg-slate-300 rounded-full h-1 overflow-hidden">
                      <div
                        className="bg-green-600 h-full"
                        style={{
                          width: section.tasks.length > 0
                            ? `${(section.tasks.filter(t => t.cells.some(c => c.content === '済')).length / section.tasks.length) * 100}%`
                            : '0%'
                        }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 ml-1">
                    {section.tasks.filter(t => t.cells.some(c => c.content === '済')).length}/{section.tasks.length}
                  </span>
                </td>
                {MONTHS.map(month => {
                  const isCurrentMonth = month.id === CURRENT_MONTH_ID
                  const isMainEvent = (month as any).isMain
                  return (
                    <td
                      key={month.id}
                      className={`border border-slate-300 h-8 ${
                        isMainEvent
                          ? 'bg-red-50/30'
                          : isCurrentMonth
                          ? 'bg-blue-50/40'
                          : 'bg-white'
                      }`}
                    ></td>
                  )
                })}
              </tr>

              {/* Task Rows */}
              {section.is_open && section.tasks.map(task => {
                const taskCell = task.cells.find(c => {
                  const month = MONTHS.find(m => m.id === CURRENT_MONTH_ID)
                  return c.month_id === CURRENT_MONTH_ID
                })
                return (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white border border-slate-300 px-3 py-2 min-w-[248px] max-w-[248px]">
                      <div className="flex flex-col gap-2">
                        <span
                          onDoubleClick={() => handleTaskNameDoubleClick(task.id, task.name)}
                          className="text-sm text-slate-700 cursor-pointer hover:text-slate-900 font-medium"
                        >
                          {editingTaskId === task.id ? (
                            <input
                              autoFocus
                              value={editingTaskName}
                              onChange={e => setEditingTaskName(e.target.value)}
                              onBlur={() => handleTaskNameSave(task.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleTaskNameSave(task.id)
                                if (e.key === 'Escape') setEditingTaskId(null)
                              }}
                              className="text-sm font-medium border border-slate-300 rounded px-1 py-0 w-full"
                            />
                          ) : (
                            task.name
                          )}
                        </span>
                        {task.due_date ? (
                          <button
                            onClick={e => onDateChipClick(task.id, task.due_date, e.currentTarget.getBoundingClientRect())}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded hover:bg-amber-100 w-fit"
                          >
                            📅 {fmtDate(task.due_date)}
                          </button>
                        ) : (
                          <button
                            onClick={e => onDateChipClick(task.id, null, e.currentTarget.getBoundingClientRect())}
                            className="text-xs text-blue-600 hover:text-blue-800 underline w-fit"
                          >
                            ＋ 日付
                          </button>
                        )}
                      </div>
                    </td>

                    {MONTHS.map(month => {
                      const cell = task.cells.find(c => c.month_id === month.id)
                      const isCurrentMonth = month.id === CURRENT_MONTH_ID
                      const isMainEvent = (month as any).isMain
                      return (
                        <td
                          key={month.id}
                          onClick={() => onCellClick(task.id, month.id, task.name, section.name, cell || null)}
                          className={`border border-slate-300 h-12 cursor-pointer hover:opacity-80 flex items-center justify-center ${
                            isMainEvent
                              ? 'bg-red-50/30'
                              : isCurrentMonth
                              ? 'bg-blue-50/40'
                              : 'bg-white'
                          }`}
                        >
                          {cell && renderStatusBadge(cell.content)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* Add Task Row */}
              {section.is_open && (
                <tr>
                  <td className="sticky left-0 z-10 bg-slate-50 border border-slate-300 px-3 py-2 h-8 min-w-[248px] max-w-[248px]">
                    <button
                      onClick={() => onAddTaskToSection(section.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      ＋ タスク追加
                    </button>
                  </td>
                  {MONTHS.map(month => {
                    const isCurrentMonth = month.id === CURRENT_MONTH_ID
                    const isMainEvent = (month as any).isMain
                    return (
                      <td
                        key={month.id}
                        className={`border border-slate-300 h-8 ${
                          isMainEvent
                            ? 'bg-red-50/30'
                            : isCurrentMonth
                            ? 'bg-blue-50/40'
                            : 'bg-white'
                        }`}
                      ></td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          ))}
        </tbody>
      </table>
    </div>
  )
}

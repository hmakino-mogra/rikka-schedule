'use client'

import { Fragment } from 'react'
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
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">✓ 済</span>
    }
    if (content === '予定') {
      return <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">● 予定</span>
    }
    return <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">{content}</span>
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
          {sections.map((section) => {
            const completedCount = section.tasks.filter(t => t.cells.some(c => c.content === '済')).length
            const totalCount = section.tasks.length
            return (
              <Fragment key={section.id}>
                {/* Section Header */}
                <tr>
                  <td className="sticky left-0 z-10 bg-slate-200 border border-slate-300 min-w-[248px] max-w-[248px]">
                    <div className="flex items-center gap-1.5 px-2 h-8">
                      <button
                        onClick={() => onToggleSection(section.id)}
                        className="text-xs text-slate-600 hover:text-slate-800 w-4 shrink-0"
                      >
                        {section.is_open ? '▼' : '▶'}
                      </button>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: section.color || '#94a3b8' }}
                      />
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
                          className="text-sm font-semibold border border-slate-300 rounded px-1 py-0 flex-1 min-w-0"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => handleSectionNameDoubleClick(section.id, section.name)}
                          className="font-semibold text-xs text-slate-700 flex-1 cursor-pointer hover:text-slate-900 min-w-0 truncate"
                        >
                          {section.name}
                        </span>
                      )}
                      {/* Progress bar */}
                      <div className="w-8 shrink-0">
                        <div className="bg-slate-300 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-green-500 h-full"
                            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 shrink-0 tabular-nums">{completedCount}/{totalCount}</span>
                    </div>
                  </td>
                  {MONTHS.map(month => {
                    const isCurrentMonth = month.id === CURRENT_MONTH_ID
                    const isMainEvent = (month as any).isMain
                    return (
                      <td
                        key={month.id}
                        className={`border border-slate-300 h-8 ${
                          isMainEvent ? 'bg-red-50/30' : isCurrentMonth ? 'bg-blue-50/40' : 'bg-slate-50'
                        }`}
                      />
                    )
                  })}
                </tr>

                {/* Task Rows */}
                {section.is_open && section.tasks.map(task => (
                  <tr key={task.id} className="group/row hover:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white border border-slate-300 min-w-[248px] max-w-[248px]">
                      <div className="flex items-center gap-1.5 px-2 h-9">
                        {editingTaskId === task.id ? (
                          <input
                            autoFocus
                            value={editingTaskName}
                            onChange={e => setEditingTaskName(e.target.value)}
                            onBlur={() => handleTaskNameSave(task.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleTaskNameSave(task.id)
                              if (e.key === 'Escape') setEditingTaskId(task.id)
                            }}
                            className="text-sm font-medium border border-slate-300 rounded px-1 py-0 flex-1 min-w-0"
                          />
                        ) : (
                          <span
                            onDoubleClick={() => handleTaskNameDoubleClick(task.id, task.name)}
                            className="text-xs text-slate-700 cursor-pointer hover:text-slate-900 flex-1 min-w-0 truncate leading-tight"
                          >
                            {task.name}
                          </span>
                        )}
                        {task.due_date ? (
                          <button
                            onClick={e => onDateChipClick(task.id, task.due_date, e.currentTarget.getBoundingClientRect())}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded hover:bg-amber-100 shrink-0"
                          >
                            📅 {fmtDate(task.due_date)}
                          </button>
                        ) : (
                          <button
                            onClick={e => onDateChipClick(task.id, null, e.currentTarget.getBoundingClientRect())}
                            className="text-xs text-slate-400 hover:text-blue-600 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
                          >
                            ＋
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
                          className={`border border-slate-300 h-9 cursor-pointer hover:opacity-80 ${
                            isMainEvent ? 'bg-red-50/30' : isCurrentMonth ? 'bg-blue-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-center h-full">
                            {cell && renderStatusBadge(cell.content)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}

                {/* Add Task Row */}
                {section.is_open && (
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 border border-slate-300 min-w-[248px] max-w-[248px]">
                      <div className="flex items-center px-2 h-7">
                        <button
                          onClick={() => onAddTaskToSection(section.id)}
                          className="text-xs text-blue-500 hover:text-blue-700"
                        >
                          ＋ タスク追加
                        </button>
                      </div>
                    </td>
                    {MONTHS.map(month => {
                      const isCurrentMonth = month.id === CURRENT_MONTH_ID
                      const isMainEvent = (month as any).isMain
                      return (
                        <td
                          key={month.id}
                          className={`border border-slate-300 h-7 ${
                            isMainEvent ? 'bg-red-50/30' : isCurrentMonth ? 'bg-blue-50/40' : 'bg-slate-50'
                          }`}
                        />
                      )
                    })}
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

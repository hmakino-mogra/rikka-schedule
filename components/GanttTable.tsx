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

  /** セルの中身をカラーブロックで表示 */
  const renderCellBlock = (content: string | null) => {
    if (!content) return null
    if (content === '済') {
      return (
        <div className="absolute inset-[3px] rounded flex items-center justify-center bg-emerald-500 shadow-sm">
          <span className="text-white text-xs font-bold leading-none">✓ 済</span>
        </div>
      )
    }
    if (content === '予定') {
      return (
        <div className="absolute inset-[3px] rounded flex items-center justify-center bg-amber-400 shadow-sm">
          <span className="text-white text-xs font-semibold leading-none">予定</span>
        </div>
      )
    }
    return (
      <div className="absolute inset-[3px] rounded flex items-center justify-center bg-sky-400 shadow-sm">
        <span className="text-white text-xs font-semibold leading-none">{content}</span>
      </div>
    )
  }

  return (
    <div className="custom-scroll overflow-auto h-[calc(100vh-94px)]">
      <table className="border-collapse w-full">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-[#0D2137] text-white w-[220px] min-w-[220px] max-w-[220px] border border-slate-700 h-9" />
            {MONTHS.map(month => {
              const isCurrentMonth = month.id === CURRENT_MONTH_ID
              const isMainEvent = (month as any).isMain
              return (
                <th
                  key={month.id}
                  className={`sticky top-0 z-10 border border-slate-700 h-9 text-center text-xs font-bold w-[72px] min-w-[72px] tracking-wide ${
                    isMainEvent
                      ? 'bg-red-700 text-white'
                      : isCurrentMonth
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0D2137] text-slate-300'
                  }`}
                >
                  {month.label}
                </th>
              )
            })}
          </tr>
          <tr>
            <th className="sticky left-0 top-9 z-20 bg-[#142030] border border-slate-700 h-6" />
            {MONTHS.map(month => {
              const milestone = milestones.find(m => m.month_id === month.id)
              const isCurrentMonth = month.id === CURRENT_MONTH_ID
              const isMainEvent = (month as any).isMain
              return (
                <td
                  key={month.id}
                  onClick={e => onMilestoneClick(month.id, e.currentTarget.getBoundingClientRect())}
                  className={`sticky top-9 z-10 border border-slate-700 h-6 text-xs cursor-pointer hover:opacity-80 overflow-hidden text-ellipsis whitespace-nowrap px-1 ${
                    isMainEvent ? 'bg-red-900/60' : isCurrentMonth ? 'bg-blue-900/50' : 'bg-[#0D2137]/80'
                  } ${milestone ? 'text-slate-200' : 'text-slate-600'}`}
                >
                  {milestone && (
                    <span className={milestone.is_main ? 'text-red-300 font-semibold' : 'text-slate-300'}>
                      {milestone.text}
                    </span>
                  )}
                </td>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map(section => {
            const completedCount = section.tasks.filter(t => t.cells.some(c => c.content === '済')).length
            const totalCount = section.tasks.length
            const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
            const sectionColor = section.color || '#94a3b8'
            return (
              <Fragment key={section.id}>
                <tr>
                  <td
                    className="sticky left-0 z-10 border border-slate-300 min-w-[220px] max-w-[220px]"
                    style={{ background: `color-mix(in srgb, ${sectionColor} 18%, #e2e8f0)` }}
                  >
                    <div className="flex items-center gap-1.5 h-8 pr-2" style={{ paddingLeft: '4px', borderLeft: `4px solid ${sectionColor}` }}>
                      <button
                        onClick={() => onToggleSection(section.id)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 w-4 shrink-0"
                      >
                        {section.is_open ? '▼' : '▶'}
                      </button>
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
                          className="text-xs font-bold border border-slate-400 rounded px-1 py-0 flex-1 min-w-0 bg-white"
                        />
                      ) : (
                        <span
                          onDoubleClick={() => handleSectionNameDoubleClick(section.id, section.name)}
                          className="text-xs font-bold text-slate-700 flex-1 min-w-0 truncate cursor-pointer"
                        >
                          {section.name}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="w-10 h-1.5 bg-slate-300 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">{completedCount}/{totalCount}</span>
                      </div>
                    </div>
                  </td>
                  {MONTHS.map(month => {
                    const isCurrentMonth = month.id === CURRENT_MONTH_ID
                    const isMainEvent = (month as any).isMain
                    return (
                      <td
                        key={month.id}
                        className={`border border-slate-200 h-8 ${
                          isMainEvent ? 'bg-red-50' : isCurrentMonth ? 'bg-blue-50' : 'bg-slate-100'
                        }`}
                      />
                    )
                  })}
                </tr>
                {section.is_open && section.tasks.map(task => (
                  <tr key={task.id} className="group/row">
                    <td className="sticky left-0 z-10 bg-white border border-slate-200 min-w-[220px] max-w-[220px] group-hover/row:bg-slate-50">
                      <div className="flex items-center gap-1.5 h-9 pr-2" style={{ paddingLeft: '8px', borderLeft: `4px solid ${sectionColor}30` }}>
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
                            className="text-xs border border-slate-300 rounded px-1 py-0 flex-1 min-w-0"
                          />
                        ) : (
                          <span
                            onDoubleClick={() => handleTaskNameDoubleClick(task.id, task.name)}
                            className="text-xs text-slate-700 flex-1 min-w-0 truncate cursor-pointer leading-tight"
                            title={task.name}
                          >
                            {task.name}
                          </span>
                        )}
                        {task.due_date ? (
                          <button
                            onClick={e => onDateChipClick(task.id, task.due_date, e.currentTarget.getBoundingClientRect())}
                            className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-700 hover:bg-amber-200"
                          >
                            {fmtDate(task.due_date)}
                          </button>
                        ) : (
                          <button
                            onClick={e => onDateChipClick(task.id, null, e.currentTarget.getBoundingClientRect())}
                            className="shrink-0 text-[10px] text-slate-300 hover:text-blue-500 opacity-0 group-hover/row:opacity-100 transition-opacity"
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
                      const isDone = cell?.content === '済'
                      const isPlanned = cell?.content === '予定'
                      return (
                        <td
                          key={month.id}
                          onClick={() => onCellClick(task.id, month.id, task.name, section.name, cell || null)}
                          className={`relative border border-slate-200 h-9 cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-emerald-50 hover:bg-emerald-100'
                              : isPlanned
                              ? 'bg-amber-50 hover:bg-amber-100'
                              : isMainEvent
                              ? 'bg-red-50/40 hover:bg-red-100/40'
                              : isCurrentMonth
                              ? 'bg-blue-50/40 hover:bg-blue-100/40'
                              : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          {renderCellBlock(cell?.content ?? null)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {section.is_open && (
                  <tr>
                    <td className="sticky left-0 z-10 bg-slate-50 border border-slate-200 min-w-[220px] max-w-[220px]" style={{ borderLeft: `4px solid ${sectionColor}20` }}>
                      <div className="flex items-center px-3 h-7">
                        <button
                          onClick={() => onAddTaskToSection(section.id)}
                          className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
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
                          className={`border border-slate-100 h-7 ${
                            isMainEvent ? 'bg-red-50/20' : isCurrentMonth ? 'bg-blue-50/20' : 'bg-slate-50'
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

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SectionWithTasks, TaskWithCells, MONTHS } from '@/lib/database.types'

interface Props {
  sections: SectionWithTasks[]
  preselectSectionId?: string
  onClose: () => void
  onAdded: (task: TaskWithCells) => void
}

export function AddTaskModal({ sections, preselectSectionId, onClose, onAdded }: Props) {
  const [taskName, setTaskName] = useState('')
  const [sectionId, setSectionId] = useState(preselectSectionId || sections[0]?.id || '')
  const [monthId, setMonthId] = useState<number | ''>('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskName.trim() || !sectionId) return

    setLoading(true)
    try {
      // Insert task
      const taskInsert = {
        section_id: sectionId,
        name: taskName.trim(),
        sort_order: 0
      }
      const { data: taskData } = await supabase
        .from('tasks')
        .insert([taskInsert] as any)
        .select()
        .single()

      if (!taskData) return

      const task = taskData as any
      let cells: any[] = []
      // If month selected, create cell
      if (monthId) {
        const cellInsert = {
          task_id: task.id,
          month_id: monthId as number,
          content: status || null
        }
        const { data: cellData } = await supabase
          .from('task_cells')
          .insert([cellInsert] as any)
          .select()
        if (cellData) cells = cellData
      }

      onAdded({
        ...task,
        cells: cells
      } as TaskWithCells)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-[#0D2137] text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold">タスクを追加</h2>
          <button
            onClick={onClose}
            className="text-xl hover:opacity-75"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              タスク名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
              placeholder="タスク名を入力..."
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>

          {/* Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              セクション <span className="text-red-500">*</span>
            </label>
            <select
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.name}
                </option>
              ))}
            </select>
          </div>

          {/* Month (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              月 (オプション)
            </label>
            <select
              value={monthId}
              onChange={e => setMonthId(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            >
              <option value="">選択しない</option>
              {MONTHS.map(month => (
                <option key={month.id} value={month.id}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status (Optional) */}
          {monthId && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ステータス (オプション)
              </label>
              <div className="flex gap-2">
                {['済', '予定', '未定'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded ${
                      status === s
                        ? s === '済'
                          ? 'bg-green-100 text-green-700'
                          : s === '予定'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s === '済' ? '✓' : s === '予定' ? '●' : s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading || !taskName.trim() || !sectionId}
              className="flex-1 px-4 py-2 bg-[#C9A84C] text-[#0D2137] font-semibold rounded hover:opacity-90 disabled:opacity-50"
            >
              追加
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 font-semibold rounded hover:bg-slate-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toReiwa } from '@/lib/database.types'

interface Props {
  taskId: string
  currentDate: string | null
  anchor: DOMRect
  onClose: () => void
  onSaved: (taskId: string, date: string | null) => void
}

export function DatePopover({ taskId, currentDate, anchor, onClose, onSaved }: Props) {
  const [date, setDate] = useState(currentDate || '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const updateData: Record<string, any> = { due_date: date || null }
      await (supabase.from('tasks') as any).update(updateData).eq('id', taskId)

      onSaved(taskId, date || null)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    setLoading(true)
    try {
      const updateData: Record<string, any> = { due_date: null }
      await (supabase.from('tasks') as any).update(updateData).eq('id', taskId)

      setDate('')
      onSaved(taskId, null)
    } finally {
      setLoading(false)
    }
  }

  const top = anchor.bottom + 8
  const left = Math.min(anchor.left, window.innerWidth - 280)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div
        className="fixed bg-white rounded-lg shadow-lg border border-slate-200 w-72 z-50 p-4 space-y-3"
        style={{
          top: `${top}px`,
          left: `${left}px`
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700">期限日</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Date Input */}
        <div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
          {date && (
            <div className="text-xs text-slate-500 mt-2">
              和暦: {toReiwa(date)}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-3 py-1.5 text-xs font-semibold bg-[#C9A84C] text-[#0D2137] rounded hover:opacity-90 disabled:opacity-50"
          >
            OK
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            className="flex-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded hover:bg-slate-200 disabled:opacity-50"
          >
            クリア
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded hover:bg-slate-50"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}

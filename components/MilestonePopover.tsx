'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Milestone } from '@/lib/database.types'

interface Props {
  monthId: number
  milestone: Milestone | null
  anchor: DOMRect
  onClose: () => void
  onSaved: (m: Milestone) => void
  onDeleted: (monthId: number) => void
}

export function MilestonePopover({ monthId, milestone, anchor, onClose, onSaved, onDeleted }: Props) {
  const [text, setText] = useState(milestone?.text || '')
  const [isMain, setIsMain] = useState(milestone?.is_main || false)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const { data } = await (supabase.from('milestones') as any)
        .upsert({
          month_id: monthId,
          text: text || null,
          is_main: isMain
        }, { onConflict: 'month_id' })
        .select()
        .single()

      if (data) {
        onSaved(data as Milestone)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!milestone || !confirm('このマイルストーンを削除してもよろしいですか？')) return
    setLoading(true)
    try {
      await supabase.from('milestones').delete().eq('month_id', monthId)
      onDeleted(monthId)
    } finally {
      setLoading(false)
    }
  }

  const top = anchor.bottom + 8
  const left = Math.min(anchor.left, window.innerWidth - 320)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div
        className="fixed bg-white rounded-lg shadow-lg border border-slate-200 w-80 z-50 p-4 space-y-3"
        style={{
          top: `${top}px`,
          left: `${left}px`
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <h3 className="font-semibold text-slate-700">マイルストーン</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Text */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            テキスト
          </label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="マイルストーンの説明..."
            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none h-16"
          />
        </div>

        {/* Main Event Checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isMain"
            checked={isMain}
            onChange={e => setIsMain(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="isMain" className="text-xs font-medium text-slate-700 cursor-pointer">
            本番イベント（赤表示）
          </label>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-3 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-3 py-1.5 text-xs font-semibold bg-[#C9A84C] text-[#0D2137] rounded hover:opacity-90 disabled:opacity-50"
          >
            保存
          </button>
          {milestone && (
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
            >
              削除
            </button>
          )}
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

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TaskCell, Comment, toReiwa, MONTHS } from '@/lib/database.types'

interface Props {
  taskId: string
  monthId: number
  taskName: string
  secName: string
  cell: TaskCell | null
  onClose: () => void
  onSaved: (cell: TaskCell) => void
  onDeleted: (taskId: string, monthId: number) => void
}

export function EditPanel({ taskId, monthId, taskName, secName, cell, onClose, onSaved, onDeleted }: Props) {
  const [status, setStatus] = useState(cell?.content || '')
  const [assignee, setAssignee] = useState(cell?.assignee || '')
  const [cellDate, setCellDate] = useState(cell?.cell_date || '')
  const [memo, setMemo] = useState(cell?.memo || '')
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  const monthLabel = MONTHS.find(m => m.id === monthId)?.label || ''

  // Enter animation — use setTimeout to ensure initial state is painted
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(id)
  }, [])

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') doClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => { loadComments() }, [])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments').select('*')
      .eq('task_id', taskId).eq('month_id', monthId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  /** Exit animation then run callback */
  const doClose = (action?: () => void) => {
    setVisible(false)
    setTimeout(() => (action ? action() : onClose()), 280)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const cellData = {
        task_id: taskId,
        month_id: monthId,
        content: status || null,
        assignee: assignee || null,
        cell_date: cellDate || null,
        memo: memo || null,
      }
      const { data } = await (supabase.from('task_cells') as any)
        .upsert(cellData, { onConflict: 'task_id, month_id' })
        .select().single()
      if (data) doClose(() => onSaved(data as TaskCell))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!cell || !confirm('このセルを削除してもよろしいですか？')) return
    setLoading(true)
    try {
      await supabase.from('task_cells').delete().eq('id', cell.id)
      doClose(() => onDeleted(taskId, monthId))
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setLoading(true)
    try {
      const { data } = await (supabase.from('comments') as any)
        .insert({ task_id: taskId, month_id: monthId, text: newComment, author: 'ユーザー' })
        .select().single()
      if (data) { setComments([...comments, data as Comment]); setNewComment('') }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('コメントを削除してもよろしいですか？')) return
    await supabase.from('comments').delete().eq('id', commentId)
    setComments(comments.filter(c => c.id !== commentId))
  }

  return (
    <>
      {/* ── Overlay ── */}
      <div
        className="fixed"
        style={{
          zIndex: 150,
          top: 0, right: 0, bottom: 0, left: 0,
          background: visible ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(2px)' : 'blur(0px)',
          transition: 'background 0.3s, backdrop-filter 0.3s',
          pointerEvents: visible ? 'auto' : 'none',
        } as React.CSSProperties}
        onClick={() => doClose()}
      />

      {/* ── Side Panel ── */}
      <div
        className="fixed top-0 w-[410px] h-screen bg-white flex flex-col"
        style={{
          zIndex: 200,
          right: 0,
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.14)',
        }}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{secName}</span>
            <button
              onClick={() => doClose()}
              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm transition-colors"
            >✕</button>
          </div>
          <div className="text-[17px] font-bold text-slate-900 leading-snug mb-2">{taskName}</div>
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 rounded-lg px-3 py-1 text-[12px] font-semibold">
            📅 {monthLabel}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Status pills */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">ステータス</label>
            <div className="flex gap-2">
              {([
                { val: '済',   label: '✓ 済',   bg: '#ecfdf5', color: '#047857', border: '#10b981' },
                { val: '予定', label: '● 予定', bg: '#fffbeb', color: '#b45309', border: '#f59e0b' },
                { val: '',     label: '— 未定', bg: '#f1f5f9', color: '#475569', border: '#94a3b8' },
              ] as const).map(({ val, label, bg, color, border }) => {
                const isActive = status === val
                return (
                  <button
                    key={val || 'none'}
                    onClick={() => setStatus(val)}
                    className="flex-1 py-2 text-[13px] font-bold rounded-lg border-2 transition-all duration-100"
                    style={isActive
                      ? { background: bg, color, borderColor: border }
                      : { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }
                    }
                  >{label}</button>
                )
              })}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">担当者</label>
            <input
              type="text" value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="担当者名…"
              className="w-full px-3 py-2 text-[13px] border-[1.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#2B5A8A] focus:shadow-[0_0_0_3px_rgba(43,90,138,0.1)] transition-all"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">実行日</label>
            <input
              type="date" value={cellDate}
              onChange={e => setCellDate(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border-[1.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#2B5A8A] transition-all"
            />
            {cellDate && <div className="text-[11px] text-blue-600 mt-1">令和表記: {toReiwa(cellDate)}</div>}
          </div>

          {/* Memo */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">メモ</label>
            <textarea
              value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="詳細・注意事項…"
              className="w-full px-3 py-2 text-[13px] border-[1.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#2B5A8A] transition-all resize-none h-[72px]"
            />
          </div>

          {/* Comments */}
          <div className="pt-3 border-t border-slate-200">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">💬 コメント</label>
            <div className="space-y-2 mb-3 max-h-[170px] overflow-y-auto">
              {comments.length === 0 && (
                <div className="text-[12px] text-slate-400 italic">まだコメントはありません</div>
              )}
              {comments.map(comment => (
                <div key={comment.id} className="bg-slate-50 rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] text-slate-800">{comment.text}</p>
                    <button onClick={() => handleDeleteComment(comment.id)} className="text-slate-300 hover:text-red-500 shrink-0 text-xs">✕</button>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{new Date(comment.created_at).toLocaleString('ja-JP')}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text" value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                placeholder="コメントを追加…"
                className="flex-1 px-3 py-1.5 text-[12px] border-[1.5px] border-slate-200 rounded-lg focus:outline-none focus:border-[#2B5A8A] transition-all"
              />
              <button
                onClick={handleAddComment} disabled={loading}
                className="px-3 py-1.5 text-[12px] bg-[#0D2137] text-white rounded-lg hover:bg-[#1A3A5C] disabled:opacity-50"
              >送信</button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3 flex gap-2 bg-white flex-shrink-0">
          <button
            onClick={handleSave} disabled={loading}
            className="flex-1 py-2.5 text-[13px] font-bold bg-[#0D2137] text-white rounded-lg hover:bg-[#1A3A5C] disabled:opacity-50 transition-colors"
          >💾 保存</button>
          {cell && (
            <button
              onClick={handleDelete} disabled={loading}
              className="px-4 py-2.5 text-[13px] font-bold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
            >🗑 削除</button>
          )}
        </div>
      </div>
    </>
  )
}

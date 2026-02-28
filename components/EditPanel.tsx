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

  const monthLabel = MONTHS.find(m => m.id === monthId)?.label || ''

  useEffect(() => {
    loadComments()
  }, [])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .eq('month_id', monthId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
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

      const { data } = await (supabase
        .from('task_cells') as any)
        .upsert(cellData, { onConflict: 'task_id, month_id' })
        .select()
        .single()

      if (data) {
        onSaved(data as TaskCell)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!cell || !confirm('このセルを削除してもよろしいですか？')) return
    setLoading(true)
    try {
      await supabase.from('task_cells').delete().eq('id', cell.id)
      onDeleted(taskId, monthId)
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setLoading(true)
    try {
      const { data } = await (supabase.from('comments') as any)
        .insert({
          task_id: taskId,
          month_id: monthId,
          text: newComment,
          author: 'ユーザー'
        })
        .select()
        .single()

      if (data) {
        setComments([...comments, data as Comment])
        setNewComment('')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('コメントを削除してもよろしいですか？')) return
    setLoading(true)
    try {
      await supabase.from('comments').delete().eq('id', commentId)
      setComments(comments.filter(c => c.id !== commentId))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed right-0 top-0 w-96 h-screen bg-white border-l border-slate-300 shadow-lg overflow-y-auto z-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-[#0D2137] text-white px-6 py-4 border-b border-slate-300 flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-semibold">{taskName}</div>
          <div className="text-xs opacity-75">
            {secName} / {monthLabel}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-xl hover:opacity-75"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">ステータス</label>
          <div className="flex gap-2">
            {['済', '予定', '未定'].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-2 text-xs font-medium rounded ${
                  status === s
                    ? s === '済'
                      ? 'bg-green-100 text-green-700'
                      : s === '予定'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === '済' ? '✓ 済' : s === '予定' ? '● 予定' : '未定'}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">担当者</label>
          <input
            type="text"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            placeholder="名前を入力..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">実行日</label>
          <input
            type="date"
            value={cellDate}
            onChange={e => setCellDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
          />
          {cellDate && <div className="text-xs text-slate-500 mt-1">和暦: {toReiwa(cellDate)}</div>}
        </div>

        {/* Memo */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">メモ</label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="メモを入力..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none h-24"
          />
        </div>

        {/* Comments */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">コメント</label>
          <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
            {comments.map(comment => (
              <div key={comment.id} className="bg-slate-50 p-2 rounded text-xs">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-slate-700">{comment.author}</span>
                  <button
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-slate-400 hover:text-red-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-slate-600 mt-1">{comment.text}</p>
                <span className="text-slate-400 text-xs">
                  {new Date(comment.created_at).toLocaleString('ja-JP')}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAddComment()}
              placeholder="コメントを追加..."
              className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
            <button
              onClick={handleAddComment}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-[#C9A84C] text-[#0D2137] rounded hover:opacity-90 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="sticky bottom-0 bg-slate-50 border-t border-slate-300 px-6 py-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs font-semibold bg-[#C9A84C] text-[#0D2137] rounded hover:opacity-90 disabled:opacity-50"
        >
          保存
        </button>
        {cell && (
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 px-3 py-2 text-xs font-semibold bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
          >
            削除
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 px-3 py-2 text-xs font-semibold border border-slate-300 text-slate-600 rounded hover:bg-slate-100"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}

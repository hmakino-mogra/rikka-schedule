'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { TaskCell, Comment, SectionWithTasks, toReiwa, MONTHS } from '@/lib/database.types'
import { useIsMobile } from '@/lib/useIsMobile'

interface Props {
  taskId: string
  monthId: number
  taskName: string
  secName: string
  sectionId: string
  cell: TaskCell | null
  sections: SectionWithTasks[]
  taskLinkedSectionIds?: string[] | null
  onClose: () => void
  onSaved: (cell: TaskCell) => void
  onDeleted: (taskId: string, monthId: number) => void
  onTaskDeleted?: (taskId: string) => void
  onSectionChange?: (taskId: string, newSectionId: string) => void
  onLinkedSectionsChanged?: (taskId: string, linkedIds: string[]) => void
  onDueDateChanged?: (taskId: string, dueDate: string | null) => void
  onMonthChanged?: (taskId: string, oldMonthId: number, newCell: TaskCell) => void
}

export function EditPanel({
  taskId, monthId, taskName, secName, sectionId,
  cell, sections, taskLinkedSectionIds, onClose, onSaved, onDeleted, onTaskDeleted, onSectionChange, onLinkedSectionsChanged, onDueDateChanged, onMonthChanged
}: Props) {
  const isMobile = useIsMobile()
  const [status, setStatus] = useState(cell?.content || '')
  const [assignee, setAssignee] = useState(cell?.assignee || '')
  const [cellDate, setCellDate] = useState(cell?.cell_date || '')
  const [cellDateEnd, setCellDateEnd] = useState(cell?.cell_date_end || '')
  const [dateMode, setDateMode] = useState<'single' | 'range'>(cell?.cell_date_end ? 'range' : 'single')
  const [memo, setMemo] = useState(cell?.memo || '')
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState(sectionId)
  const [linkedSectionIds, setLinkedSectionIds] = useState<string[]>(taskLinkedSectionIds ?? [])
  const [targetMonthId, setTargetMonthId] = useState(monthId)

  const monthLabel = MONTHS.find(m => m.id === targetMonthId)?.label || ''

  useEffect(() => { loadComments() }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments').select('*')
      .eq('task_id', taskId).eq('month_id', monthId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // 1. 共同担当部署（linked_section_ids）を先に保存 → パネルが閉じる前に state を更新
      const prevIds = (taskLinkedSectionIds ?? []).slice().sort().join(',')
      const newIds  = linkedSectionIds.slice().sort().join(',')
      if (prevIds !== newIds) {
        await (supabase.from('tasks') as any)
          .update({ linked_section_ids: linkedSectionIds })
          .eq('id', taskId)
        if (onLinkedSectionsChanged) onLinkedSectionsChanged(taskId, linkedSectionIds)
      }

      // 2. 実行日を tasks.due_date に自動反映（期間の場合は終了日を期限とする）
      const newDueDate = dateMode === 'range' ? (cellDateEnd || cellDate || null) : (cellDate || null)
      await (supabase.from('tasks') as any)
        .update({ due_date: newDueDate })
        .eq('id', taskId)
      if (onDueDateChanged) onDueDateChanged(taskId, newDueDate)

      // 3. セルデータを保存（onSaved がパネルを閉じる）
      const { data } = await (supabase.from('task_cells') as any)
        .upsert(
          {
            task_id: taskId, month_id: targetMonthId, content: status || null,
            assignee: assignee || null, memo: memo || null,
            cell_date: cellDate || null,
            cell_date_end: dateMode === 'range' ? (cellDateEnd || null) : null,
          },
          { onConflict: 'task_id, month_id' }
        ).select().single()

      // 月が変わった場合は元のセルを削除して専用コールバックを呼ぶ
      if (targetMonthId !== monthId && cell) {
        await supabase.from('task_cells').delete().eq('id', cell.id)
        if (onMonthChanged && data) { onMonthChanged(taskId, monthId, data as TaskCell); return }
      }
      if (data) onSaved(data as TaskCell)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCell = async () => {
    if (!cell || !confirm('このセルのデータを削除しますか？')) return
    setLoading(true)
    try {
      await supabase.from('task_cells').delete().eq('id', cell.id)
      onDeleted(taskId, monthId)
    } finally { setLoading(false) }
  }

  const handleDeleteTask = async () => {
    if (!confirm(`「${taskName}」を完全に削除しますか？\nこの操作は元に戻せません。`)) return
    setLoading(true)
    try {
      await supabase.from('tasks').delete().eq('id', taskId)
      if (onTaskDeleted) onTaskDeleted(taskId)
      onClose()
    } finally { setLoading(false) }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setLoading(true)
    try {
      const { data } = await (supabase.from('comments') as any)
        .insert({ task_id: taskId, month_id: monthId, text: newComment.trim(), author: '自分' })
        .select().single()
      if (data) { setComments([...comments, data as Comment]); setNewComment('') }
    } finally { setLoading(false) }
  }

  const handleDeleteComment = async (commentId: string) => {
    setLoading(true)
    try {
      await supabase.from('comments').delete().eq('id', commentId)
      setComments(comments.filter(c => c.id !== commentId))
    } finally { setLoading(false) }
  }

  const handleMoveSection = async () => {
    if (selectedSectionId === sectionId || !onSectionChange) return
    setLoading(true)
    try {
      await (supabase.from('tasks') as any).update({ section_id: selectedSectionId }).eq('id', taskId)
      onSectionChange(taskId, selectedSectionId)
    } finally { setLoading(false) }
  }

  const statusOptions = [
    { value: '済',   label: '✓ 済',  bg: '#D1FAE5', color: '#059669', border: '#059669' },
    { value: '予定', label: '● 予定', bg: '#FEF3C7', color: '#D97706', border: '#D97706' },
    { value: '',     label: '— 未定', bg: '#F1F5F9', color: '#334155', border: '#CBD5E1' },
  ]

  const sectionChanged = selectedSectionId !== sectionId

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:150, background:'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Panel — モバイル: ボトムシート / デスクトップ: 右サイドパネル */}
      <div style={
        isMobile
          ? {
              position:'fixed', bottom:0, left:0, right:0,
              height:'88dvh', maxHeight:'88dvh',
              background:'white',
              boxShadow:'0 -8px 40px rgba(0,0,0,.22)',
              zIndex:200,
              display:'flex', flexDirection:'column',
              borderRadius:'18px 18px 0 0',
              overflow:'hidden',
              animation:'slideUp .22s ease-out',
            }
          : {
              position:'fixed', right:0, top:0, width:420, height:'100vh',
              background:'white',
              boxShadow:'-8px 0 32px rgba(0,0,0,.12)',
              zIndex:200,
              display:'flex', flexDirection:'column',
              borderLeft:'1px solid #E2E8F0',
            }
      }>

        {/* ボトムシートハンドル（モバイルのみ） */}
        {isMobile && (
          <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px', flexShrink:0, background:'#0D2137', cursor:'pointer' }} onClick={onClose}>
            <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,.3)' }}></div>
          </div>
        )}

        {/* Header */}
        <div style={{ padding: isMobile ? '10px 14px 10px' : '16px 16px 12px', borderBottom:'1px solid #E2E8F0', flexShrink:0, background:'#0D2137' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:'.65rem', fontWeight:700, color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.05em' }}>{secName}</span>
            <button onClick={onClose} style={{ width:26, height:26, borderRadius:6, background:'rgba(255,255,255,.12)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.78rem', color:'rgba(255,255,255,.7)', fontFamily:'inherit' }}>✕</button>
          </div>
          <div style={{ fontSize:'.98rem', fontWeight:700, color:'white', marginBottom:7, lineHeight:1.3 }}>{taskName}</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(37,99,235,.25)', borderRadius:6, padding:'3px 9px' }}>
            <span style={{ fontSize:'.71rem', color:'#93c5fd' }}>📅</span>
            <select
              value={targetMonthId}
              onChange={e => setTargetMonthId(Number(e.target.value))}
              style={{
                background:'transparent', border:'none', outline:'none', cursor:'pointer',
                color:'#93c5fd', fontSize:'.71rem', fontWeight:600, fontFamily:'inherit',
                appearance:'none', WebkitAppearance:'none',
                paddingRight:12,
              }}
            >
              {MONTHS.map(m => (
                <option key={m.id} value={m.id} style={{ background:'#1e3a5f', color:'white' }}>{m.label}</option>
              ))}
            </select>
            <span style={{ fontSize:'.6rem', color:'rgba(147,197,253,.6)', marginLeft:-8 }}>▾</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Status */}
          <div>
            <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>ステータス</label>
            <div style={{ display:'flex', gap:6 }}>
              {statusOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  style={{
                    flex:1, padding:'9px 4px', borderRadius:7, cursor:'pointer', fontSize:'.76rem', fontWeight:700, textAlign:'center', fontFamily:'inherit',
                    background: status === opt.value ? opt.bg : '#F1F5F9',
                    color: status === opt.value ? opt.color : '#94A3B8',
                    border: status === opt.value ? `2px solid ${opt.border}` : '2px solid #E2E8F0',
                    transform: status === opt.value ? 'translateY(-1px)' : 'none',
                    transition: 'all .12s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>担当者</label>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              placeholder="担当者名…"
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Date */}
          <div>
            {/* ラベル + 単日/期間トグル */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em' }}>実行日</label>
              <div style={{ display:'flex', border:'1.5px solid #E2E8F0', borderRadius:6, overflow:'hidden' }}>
                {(['single', 'range'] as const).map((mode, i) => (
                  <button
                    key={mode}
                    onClick={() => { setDateMode(mode); if (mode === 'single') setCellDateEnd('') }}
                    style={{
                      padding:'3px 9px', fontSize:'.65rem', fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit',
                      borderLeft: i === 1 ? '1px solid #E2E8F0' : 'none',
                      background: dateMode === mode ? '#0D2137' : 'white',
                      color: dateMode === mode ? 'white' : '#94A3B8',
                      transition:'all .12s',
                    }}
                  >{mode === 'single' ? '単日' : '期間'}</button>
                ))}
              </div>
            </div>

            {/* 単日モード */}
            {dateMode === 'single' && (
              <>
                <input
                  type="date"
                  value={cellDate}
                  onChange={e => setCellDate(e.target.value)}
                  style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                />
                {cellDate && <div style={{ fontSize:'.7rem', color:'#2563EB', marginTop:4 }}>令和表記: {toReiwa(cellDate)}</div>}
              </>
            )}

            {/* 期間モード */}
            {dateMode === 'range' && (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input
                    type="date"
                    value={cellDate}
                    onChange={e => setCellDate(e.target.value)}
                    style={{ flex:1, padding:'8px 8px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.78rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  />
                  <span style={{ color:'#94A3B8', fontSize:'.9rem', flexShrink:0 }}>〜</span>
                  <input
                    type="date"
                    value={cellDateEnd}
                    onChange={e => setCellDateEnd(e.target.value)}
                    style={{ flex:1, padding:'8px 8px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.78rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
                  />
                </div>
                {(cellDate || cellDateEnd) && (
                  <div style={{ fontSize:'.7rem', color:'#2563EB', marginTop:4 }}>
                    令和表記: {cellDate ? toReiwa(cellDate) : '?'}{' 〜 '}{cellDateEnd ? toReiwa(cellDateEnd) : '?'}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Memo */}
          <div>
            <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>メモ</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="詳細・注意事項…"
              style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', outline:'none', resize:'vertical', height:72, boxSizing:'border-box' }}
            />
          </div>

          {/* Save / Delete Cell Buttons */}
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{ flex:1, padding:10, background:'#0D2137', color:'white', border:'none', borderRadius:8, fontSize:'.84rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
            >
              💾 保存
            </button>
            {cell && (
              <button
                onClick={handleDeleteCell}
                disabled={loading}
                style={{ padding:'10px 14px', background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:8, fontSize:'.84rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}
              >
                🗑 セル削除
              </button>
            )}
          </div>

          {/* ── 共同担当部署 ── */}
          <div style={{ paddingTop:12, borderTop:'1px solid #E2E8F0' }}>
            <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>🔗 共同担当部署</label>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {sections.filter(sec => sec.id !== sectionId).map(sec => {
                const isLinked = linkedSectionIds.includes(sec.id)
                return (
                  <label
                    key={sec.id}
                    style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:'6px 10px', borderRadius:7, border:`1.5px solid ${isLinked ? (sec.color || '#2563EB') : '#E2E8F0'}`, background: isLinked ? `${sec.color || '#2563EB'}15` : '#FAFAFA', transition:'all .12s' }}
                  >
                    <input
                      type="checkbox"
                      checked={isLinked}
                      onChange={() => {
                        setLinkedSectionIds(prev =>
                          isLinked ? prev.filter(id => id !== sec.id) : [...prev, sec.id]
                        )
                      }}
                      style={{ accentColor: sec.color || '#2563EB', width:14, height:14, flexShrink:0 }}
                    />
                    <span style={{ fontSize:'.8rem', color: isLinked ? '#1e293b' : '#64748B', fontWeight: isLinked ? 700 : 400, lineHeight:1.2 }}>
                      {sec.name}
                    </span>
                    {isLinked && (
                      <span style={{ marginLeft:'auto', fontSize:'.62rem', color: sec.color || '#2563EB', fontWeight:700 }}>共有中</span>
                    )}
                  </label>
                )
              })}
            </div>
            {linkedSectionIds.length > 0 && (
              <div style={{ fontSize:'.7rem', color:'#64748B', marginTop:6, lineHeight:1.4 }}>
                「保存」ボタンで共同担当部署に自動反映されます
              </div>
            )}
          </div>

          {/* ── Section Move ── */}
          <div style={{ paddingTop:12, borderTop:'1px solid #E2E8F0' }}>
            <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>セクションを変更</label>
            <div style={{ display:'flex', gap:8 }}>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                style={{ flex:1, padding:'8px 10px', border:`1.5px solid ${sectionChanged ? '#C9A84C' : '#E2E8F0'}`, borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', outline:'none', background:'white', boxSizing:'border-box' }}
              >
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.name}</option>
                ))}
              </select>
              <button
                onClick={handleMoveSection}
                disabled={!sectionChanged || loading}
                style={{
                  padding:'8px 14px', borderRadius:7, fontSize:'.78rem', fontWeight:700, fontFamily:'inherit', cursor: sectionChanged ? 'pointer' : 'default', border:'none',
                  background: sectionChanged ? '#C9A84C' : '#E2E8F0',
                  color: sectionChanged ? '#0D2137' : '#94A3B8',
                  transition:'all .15s',
                }}
              >
                移動
              </button>
            </div>
            {sectionChanged && (
              <div style={{ fontSize:'.72rem', color:'#C9A84C', marginTop:4 }}>「移動」ボタンで確定します</div>
            )}
          </div>

          {/* Comments */}
          <div style={{ paddingTop:12, borderTop:'1px solid #E2E8F0' }}>
            <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>💬 コメント</label>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10, maxHeight:160, overflowY:'auto' }}>
              {comments.length === 0 ? (
                <div style={{ fontSize:'.74rem', color:'#94A3B8', fontStyle:'italic' }}>まだコメントはありません</div>
              ) : comments.map(comment => (
                <div key={comment.id} style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:'.72rem', fontWeight:700, color:'#334155' }}>{comment.author}</span>
                    <button onClick={() => handleDeleteComment(comment.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'.7rem', fontFamily:'inherit' }}>✕</button>
                  </div>
                  <p style={{ fontSize:'.78rem', color:'#334155', margin:'4px 0 0' }}>{comment.text}</p>
                  <span style={{ fontSize:'.64rem', color:'#94A3B8' }}>{new Date(comment.created_at).toLocaleString('ja-JP')}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                placeholder="コメントを追加…"
                style={{ flex:1, padding:'7px 10px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.78rem', fontFamily:'inherit', outline:'none' }}
              />
              <button
                onClick={handleAddComment}
                disabled={loading}
                style={{ padding:'7px 12px', background:'#0D2137', color:'white', border:'none', borderRadius:7, fontSize:'.76rem', cursor:'pointer', fontFamily:'inherit' }}
              >
                送信
              </button>
            </div>
          </div>

          {/* Danger Zone: Delete Task */}
          <div style={{ paddingTop:12, borderTop:'1px solid #FEE2E2' }}>
            <button
              onClick={handleDeleteTask}
              disabled={loading}
              style={{ width:'100%', padding:'8px', background:'transparent', color:'#DC2626', border:'1px solid #FEE2E2', borderRadius:7, fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}
            >
              ⚠️ タスク自体を削除する
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

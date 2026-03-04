'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Milestone } from '@/lib/database.types'

interface Props {
  monthId: number
  milestonesForMonth: Milestone[]
  anchor: DOMRect
  onClose: () => void
  onAdded: (m: Milestone) => void
  onUpdated: (m: Milestone) => void
  onDeleted: (id: string) => void
}

export function MilestonePopover({ monthId, milestonesForMonth, anchor, onClose, onAdded, onUpdated, onDeleted }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editIsMain, setEditIsMain] = useState(false)
  const [newText, setNewText] = useState('')
  const [newIsMain, setNewIsMain] = useState(false)
  const [loading, setLoading] = useState(false)

  const startEdit = (m: Milestone) => {
    setEditingId(m.id)
    setEditText(m.text)
    setEditIsMain(m.is_main)
  }

  const handleUpdate = async (id: string) => {
    if (!editText.trim()) return
    setLoading(true)
    try {
      const { data } = await (supabase.from('milestones') as any)
        .update({ text: editText.trim(), is_main: editIsMain })
        .eq('id', id)
        .select()
        .single()
      if (data) onUpdated(data as Milestone)
      setEditingId(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newText.trim()) return
    setLoading(true)
    try {
      const { data } = await (supabase.from('milestones') as any)
        .insert({ month_id: monthId, text: newText.trim(), is_main: newIsMain })
        .select()
        .single()
      if (data) {
        onAdded(data as Milestone)
        setNewText('')
        setNewIsMain(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このイベントを削除してもよろしいですか？')) return
    setLoading(true)
    try {
      await supabase.from('milestones').delete().eq('id', id)
      onDeleted(id)
    } finally {
      setLoading(false)
    }
  }

  const top = Math.min(anchor.bottom + 8, window.innerHeight - 460)
  const left = Math.min(anchor.left, window.innerWidth - 340)

  return (
    <>
      <div
        style={{ position:'fixed', top:0, right:0, bottom:0, left:0, zIndex:150 }}
        onClick={onClose}
      />
      <div style={{
        position:'fixed', zIndex:200,
        top:`${top}px`, left:`${left}px`,
        background:'white', borderRadius:10,
        boxShadow:'0 8px 32px rgba(0,0,0,.18)',
        border:'1px solid #E2E8F0',
        width:320, padding:16,
        display:'flex', flexDirection:'column', gap:10,
        maxHeight:480, overflowY:'auto',
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:10, borderBottom:'1px solid #E2E8F0' }}>
          <h3 style={{ fontWeight:700, color:'#334155', fontSize:'.9rem', margin:0 }}>主なイベント</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'1rem', lineHeight:1, padding:2, fontFamily:'inherit' }}>✕</button>
        </div>

        {/* 既存イベント一覧 */}
        {milestonesForMonth.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {milestonesForMonth.map(m => (
              <div key={m.id} style={{ border:'1px solid #E2E8F0', borderRadius:7, padding:'8px 10px', background:'#FAFAFA' }}>
                {editingId === m.id ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <input
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(m.id); if (e.key === 'Escape') setEditingId(null) }}
                      style={{ padding:'5px 8px', border:'1px solid #CBD5E1', borderRadius:5, fontSize:'.78rem', fontFamily:'inherit', outline:'2px solid #2B5A8A', width:'100%', boxSizing:'border-box' }}
                    />
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <input type="checkbox" id={`edit-main-${m.id}`} checked={editIsMain} onChange={e => setEditIsMain(e.target.checked)} style={{ width:14, height:14, cursor:'pointer' }} />
                      <label htmlFor={`edit-main-${m.id}`} style={{ fontSize:'.73rem', color:'#334155', cursor:'pointer' }}>本番イベント（赤）</label>
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={() => handleUpdate(m.id)} disabled={loading} style={{ flex:1, padding:'5px 8px', background:'#C9A84C', color:'#0D2137', border:'none', borderRadius:5, fontSize:'.73rem', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>保存</button>
                      <button onClick={() => setEditingId(null)} style={{ padding:'5px 8px', background:'none', color:'#64748B', border:'1px solid #CBD5E1', borderRadius:5, fontSize:'.73rem', cursor:'pointer', fontFamily:'inherit' }}>キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ flex:1, fontSize:'.78rem', color: m.is_main ? '#ef4444' : '#334155', fontWeight: m.is_main ? 700 : 400, wordBreak:'break-all' }}>{m.text}</span>
                    <button onClick={() => startEdit(m)} style={{ flexShrink:0, padding:'2px 7px', background:'none', border:'1px solid #E2E8F0', borderRadius:4, cursor:'pointer', color:'#64748B', fontSize:'.65rem', fontFamily:'inherit' }}>編集</button>
                    <button onClick={() => handleDelete(m.id)} disabled={loading} style={{ flexShrink:0, padding:'2px 7px', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:4, cursor:'pointer', color:'#EF4444', fontSize:'.65rem', fontFamily:'inherit' }}>🗑</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 新規追加フォーム */}
        <div style={{ borderTop: milestonesForMonth.length > 0 ? '1px solid #E2E8F0' : 'none', paddingTop: milestonesForMonth.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize:'.72rem', fontWeight:700, color:'#475569', marginBottom:6 }}>
            {milestonesForMonth.length === 0 ? 'イベントを追加' : '＋ イベントを追加'}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="イベント名..."
              style={{ padding:'6px 8px', fontSize:'.78rem', border:'1px solid #CBD5E1', borderRadius:6, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' }}
            />
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input type="checkbox" id="new-is-main" checked={newIsMain} onChange={e => setNewIsMain(e.target.checked)} style={{ width:14, height:14, cursor:'pointer' }} />
              <label htmlFor="new-is-main" style={{ fontSize:'.73rem', color:'#334155', cursor:'pointer' }}>本番イベント（赤）</label>
            </div>
            <button
              onClick={handleAdd}
              disabled={loading || !newText.trim()}
              style={{
                padding:'7px 12px', fontSize:'.78rem', fontWeight:700,
                background: newText.trim() ? '#C9A84C' : '#E2E8F0',
                color: newText.trim() ? '#0D2137' : '#94A3B8',
                border:'none', borderRadius:6,
                cursor: newText.trim() ? 'pointer' : 'default',
                fontFamily:'inherit',
                opacity: loading ? 0.6 : 1,
              }}
            >
              追加
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

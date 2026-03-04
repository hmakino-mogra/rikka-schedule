'use client'

import { useState } from 'react'
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
        width:300, padding:16,
        display:'flex', flexDirection:'column', gap:12,
      }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:10, borderBottom:'1px solid #E2E8F0' }}>
          <h3 style={{ fontWeight:700, color:'#334155', fontSize:'.9rem', margin:0 }}>マイルストーン</h3>
          <button
            onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'1rem', lineHeight:1, padding:2, fontFamily:'inherit' }}
          >✕</button>
        </div>

        {/* Text */}
        <div>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:4 }}>
            <label style={{ fontSize:'.72rem', fontWeight:700, color:'#475569' }}>
              イベント名
            </label>
            <span style={{ fontSize:'.63rem', color:'#94A3B8' }}>改行で複数入力可</span>
          </div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"例:\n学校林散歩\n六華ゼミ/1"}
            style={{ width:'100%', padding:'6px 8px', fontSize:'.78rem', border:'1px solid #CBD5E1', borderRadius:6, resize:'vertical', height:80, outline:'none', fontFamily:'inherit', boxSizing:'border-box', lineHeight:1.6 }}
          />
        </div>

        {/* Main Event Checkbox */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input
            type="checkbox"
            id="isMain"
            checked={isMain}
            onChange={e => setIsMain(e.target.checked)}
            style={{ width:16, height:16, cursor:'pointer' }}
          />
          <label htmlFor="isMain" style={{ fontSize:'.78rem', fontWeight:600, color:'#334155', cursor:'pointer' }}>
            本番イベント（赤表示）
          </label>
        </div>

        {/* Buttons */}
        <div style={{ display:'flex', gap:6, paddingTop:10, borderTop:'1px solid #E2E8F0' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{ flex:1, padding:'6px 12px', fontSize:'.78rem', fontWeight:700, background:'#C9A84C', color:'#0D2137', border:'none', borderRadius:6, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.5:1 }}
          >
            保存
          </button>
          {milestone && (
            <button
              onClick={handleDelete}
              disabled={loading}
              style={{ padding:'6px 12px', fontSize:'.78rem', fontWeight:700, background:'#FEF2F2', color:'#EF4444', border:'1px solid #FCA5A5', borderRadius:6, cursor:'pointer', fontFamily:'inherit', opacity:loading?0.5:1 }}
            >
              削除
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding:'6px 12px', fontSize:'.78rem', fontWeight:700, background:'none', color:'#64748B', border:'1px solid #CBD5E1', borderRadius:6, cursor:'pointer', fontFamily:'inherit' }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  onClose: () => void
  onAdded: (section: any) => void
}

const COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#14B8A6', '#F97316',
  '#6366F1', '#84CC16',
]

export function AddSectionModal({ onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [isSub, setIsSub] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      const { data } = await (supabase.from('sections') as any)
        .insert([{ name: name.trim(), color, is_open: true, is_sub: isSub, sort_order: 999 }])
        .select().single()
      if (data) {
        onAdded({ ...data, tasks: [] })
        onClose()
      }
    } finally { setLoading(false) }
  }

  return (
    <div
      style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,.42)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background:'white', borderRadius:13, width:400, maxWidth:'calc(100vw - 20px)', boxShadow:'0 20px 60px rgba(0,0,0,.22)' }}>
        {/* Header */}
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0D2137', borderRadius:'13px 13px 0 0' }}>
          <h2 style={{ fontSize:'1rem', fontWeight:700, color:'white' }}>セクションを追加</h2>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:6, background:'rgba(255,255,255,.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.78rem', color:'white', fontFamily:'inherit' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>

            {/* Name */}
            <div>
              <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                セクション名 <span style={{ color:'#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例：広報部、IT部…"
                autoFocus
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', outline:'none', boxSizing:'border-box' }}
              />
            </div>

            {/* Color */}
            <div>
              <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                カラー
              </label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {COLORS.map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width:28, height:28, borderRadius:'50%', background:c, border:'none', cursor:'pointer',
                      boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
                      transform: color === c ? 'scale(1.1)' : 'none',
                      transition:'all .15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Sub section toggle */}
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:'.82rem', color:'#334155' }}>
              <input
                type="checkbox"
                checked={isSub}
                onChange={e => setIsSub(e.target.checked)}
                style={{ cursor:'pointer' }}
              />
              サブセクション（淡い紫背景・インデント表示）
            </label>
          </div>

          {/* Footer */}
          <div style={{ padding:'12px 16px 14px', borderTop:'1px solid #E2E8F0', display:'flex', justifyContent:'flex-end', gap:7 }}>
            <button type="button" onClick={onClose} style={{ padding:'8px 15px', background:'#F1F5F9', color:'#334155', border:'none', borderRadius:7, fontSize:'.8rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{ padding:'8px 15px', background: !name.trim() ? '#94A3B8' : '#0D2137', color:'white', border:'none', borderRadius:7, fontSize:'.8rem', fontWeight:600, cursor: !name.trim() ? 'not-allowed' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}
            >
              <span style={{ width:14, height:14, borderRadius:'50%', background:color, display:'inline-block', flexShrink:0 }}></span>
              {loading ? '追加中…' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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
      await (supabase.from('tasks') as any).update({ due_date: date || null }).eq('id', taskId)
      onSaved(taskId, date || null)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    setLoading(true)
    try {
      await (supabase.from('tasks') as any).update({ due_date: null }).eq('id', taskId)
      setDate('')
      onSaved(taskId, null)
    } finally {
      setLoading(false)
    }
  }

  // ── 画面内に収まるよう位置を計算 ──
  const popoverW = 260
  const popoverH = 200
  const margin = 8

  const rawTop = anchor.bottom + margin
  const top = rawTop + popoverH > window.innerHeight
    ? Math.max(margin, anchor.top - popoverH - margin)
    : rawTop
  const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - popoverW - margin))

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 250 }}
        onClick={onClose}
      />

      {/* Popover */}
      <div style={{
        position: 'fixed',
        top,
        left,
        width: popoverW,
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,.18)',
        border: '1px solid #E2E8F0',
        zIndex: 300,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#334155' }}>📅 期限日</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '.8rem', padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* Date Input */}
        <div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: 7, fontSize: '.84rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
          />
          {date && (
            <div style={{ fontSize: '.72rem', color: '#2563EB', marginTop: 4 }}>
              令和: {toReiwa(date)}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{ flex: 1, padding: '7px 4px', background: '#C9A84C', color: '#0D2137', border: 'none', borderRadius: 7, fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            OK
          </button>
          <button
            onClick={handleClear}
            disabled={loading}
            style={{ flex: 1, padding: '7px 4px', background: '#F1F5F9', color: '#334155', border: 'none', borderRadius: 7, fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            クリア
          </button>
          <button
            onClick={onClose}
            style={{ padding: '7px 10px', background: 'white', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ✕
          </button>
        </div>
      </div>
    </>
  )
}

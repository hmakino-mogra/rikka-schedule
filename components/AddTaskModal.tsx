'use client'

import { useState, useEffect } from 'react'
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
  const [status, setStatus] = useState('予定')
  const [loading, setLoading] = useState(false)

  // Escキーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskName.trim() || !sectionId) return

    setLoading(true)
    try {
      const { data: taskData } = await supabase
        .from('tasks')
        .insert([{ section_id: sectionId, name: taskName.trim(), sort_order: 0 }] as any)
        .select()
        .single()

      if (!taskData) return

      const task = taskData as any
      let cells: any[] = []

      if (monthId) {
        const { data: cellData } = await supabase
          .from('task_cells')
          .insert([{ task_id: task.id, month_id: monthId as number, content: status || null }] as any)
          .select()
        if (cellData) cells = cellData
      }

      onAdded({ ...task, cells } as TaskWithCells)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const statusOptions = [
    { value: '予定', label: '● 予定', bg: '#FEF3C7', color: '#D97706', activeBorder: '#D97706' },
    { value: '済',   label: '✓ 済',   bg: '#D1FAE5', color: '#059669', activeBorder: '#059669' },
    { value: '',     label: '— 未定',  bg: '#F1F5F9', color: '#64748B', activeBorder: '#94A3B8' },
  ]

  return (
    /* backdrop */
    <div
      style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,.42)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{ background:'white', borderRadius:13, width:440, maxWidth:'calc(100vw - 20px)', boxShadow:'0 20px 60px rgba(0,0,0,.22)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0D2137', borderRadius:'13px 13px 0 0' }}>
          <h2 style={{ fontSize:'1rem', fontWeight:700, color:'white' }}>タスクを追加</h2>
          <button onClick={onClose} style={{ width:26, height:26, borderRadius:6, background:'rgba(255,255,255,.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.78rem', color:'white', fontFamily:'inherit' }}>✕</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding:16, display:'flex', flexDirection:'column', gap:14 }}>

            {/* Task Name */}
            <div>
              <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                タスク名 <span style={{ color:'#DC2626' }}>*</span>
              </label>
              <input
                type="text"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                placeholder="タスク名を入力…"
                autoFocus
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', color:'#0F172A', boxSizing:'border-box', outline:'none' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#2B5A8A')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
              />
            </div>

            {/* Section */}
            <div>
              <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                セクション <span style={{ color:'#DC2626' }}>*</span>
              </label>
              <select
                value={sectionId}
                onChange={e => setSectionId(e.target.value)}
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', color:'#0F172A', outline:'none' }}
              >
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>{sec.name}</option>
                ))}
              </select>
            </div>

            {/* Month */}
            <div>
              <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                月（任意）
              </label>
              <select
                value={monthId}
                onChange={e => setMonthId(e.target.value ? parseInt(e.target.value) : '')}
                style={{ width:'100%', padding:'8px 11px', border:'1.5px solid #E2E8F0', borderRadius:7, fontSize:'.82rem', fontFamily:'inherit', color:'#0F172A', outline:'none' }}
              >
                <option value="">— 未定</option>
                {MONTHS.map(month => (
                  <option key={month.id} value={month.id}>{month.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            {monthId !== '' && (
              <div>
                <label style={{ display:'block', fontSize:'.65rem', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>
                  初期ステータス
                </label>
                <div style={{ display:'flex', gap:6 }}>
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      style={{
                        flex:1, padding:'8px 4px', borderRadius:7, cursor:'pointer', fontSize:'.76rem', fontWeight:700, textAlign:'center', fontFamily:'inherit',
                        background: status === opt.value ? opt.bg : '#F1F5F9',
                        color: status === opt.value ? opt.color : '#64748B',
                        border: status === opt.value ? `2px solid ${opt.activeBorder}` : '2px solid #E2E8F0',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding:'12px 16px 14px', borderTop:'1px solid #E2E8F0', display:'flex', justifyContent:'flex-end', gap:7 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding:'8px 15px', background:'#F1F5F9', color:'#334155', border:'none', borderRadius:7, fontSize:'.8rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !taskName.trim() || !sectionId}
              style={{ padding:'8px 15px', background: (!taskName.trim() || !sectionId) ? '#94A3B8' : '#0D2137', color:'white', border:'none', borderRadius:7, fontSize:'.8rem', fontWeight:600, cursor: (!taskName.trim() || !sectionId) ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}
            >
              {loading ? '追加中…' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { SectionWithTasks, TaskCell, Milestone, MONTHS, CURRENT_MONTH_ID, fmtDate } from '@/lib/database.types'

interface Props {
  sections: SectionWithTasks[]
  milestones: Milestone[]
  currentFilter: string
  searchQuery: string
  onCellClick: (taskId: string, monthId: number, taskName: string, secName: string, cell: TaskCell | null, sectionId: string) => void
  onMilestoneClick: (monthId: number, anchor: DOMRect) => void
  onDateChipClick: (taskId: string, dueDate: string | null, anchor: DOMRect) => void
  onTaskNameEdit: (taskId: string, newName: string) => void
  onSectionNameEdit: (sectionId: string, newName: string) => void
  onToggleSection: (sectionId: string) => void
  onAddTaskToSection: (sectionId: string) => void
  onSectionDelete: (sectionId: string) => void
  onSectionMove: (sectionId: string, direction: 'up' | 'down') => void
}

export function GanttTable({
  sections,
  milestones,
  currentFilter,
  searchQuery,
  onCellClick,
  onMilestoneClick,
  onDateChipClick,
  onTaskNameEdit,
  onSectionNameEdit,
  onToggleSection,
  onAddTaskToSection,
  onSectionDelete,
  onSectionMove,
}: Props) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null)
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── 今月の列が画面中央付近に来るよう初回スクロール ──
  useEffect(() => {
    if (!scrollRef.current) return
    const idx = MONTHS.findIndex(m => m.id === CURRENT_MONTH_ID)
    if (idx < 0) return
    const TASK_COL = 248
    const CELL_W = 86
    const targetLeft = TASK_COL + CELL_W * idx
    const containerWidth = scrollRef.current.clientWidth
    scrollRef.current.scrollLeft = Math.max(0, targetLeft - containerWidth / 3)
  }, [])

  const handleTaskNameDoubleClick = (taskId: string, currentName: string) => {
    setEditingTaskId(taskId)
    setEditingTaskName(currentName)
  }
  const handleTaskNameSave = async (taskId: string) => {
    if (editingTaskName.trim()) await onTaskNameEdit(taskId, editingTaskName.trim())
    setEditingTaskId(null)
  }
  const handleSectionNameDoubleClick = (sectionId: string, currentName: string) => {
    setEditingSectionId(sectionId)
    setEditingSectionName(currentName)
  }
  const handleSectionNameSave = async (sectionId: string) => {
    if (editingSectionName.trim()) await onSectionNameEdit(sectionId, editingSectionName.trim())
    setEditingSectionId(null)
  }

  const renderStatusBadge = (content: string | null) => {
    if (!content) return null
    if (content === '済')
      return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:11, fontSize:'.67rem', fontWeight:700, lineHeight:1, background:'#D1FAE5', color:'#059669' }}>✓ 済</span>
    if (content === '予定')
      return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:11, fontSize:'.67rem', fontWeight:700, lineHeight:1, background:'#FEF3C7', color:'#D97706' }}>● 予定</span>
    return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'3px 8px', borderRadius:11, fontSize:'.67rem', fontWeight:700, lineHeight:1, background:'#DBEAFE', color:'#2563EB' }}>{content}</span>
  }

  return (
    <div
      ref={scrollRef}
      style={{ height:'calc(100vh - 94px)', overflow:'auto', position:'relative', zIndex:0 }}
      className="custom-scroll"
    >
      <table style={{ borderCollapse:'collapse', width:'max-content', minWidth:'100%' }}>
        <thead>
          {/* ── Month header row ── */}
          <tr>
            <th style={{ position:'sticky', left:0, top:0, zIndex:40, background:'#091929', color:'rgba(255,255,255,.3)', fontSize:'.65rem', fontWeight:400, textAlign:'left', padding:'0 14px', minWidth:248, maxWidth:248, height:42, borderRight:'1px solid rgba(255,255,255,.07)' }}>
              タスク
            </th>
            {MONTHS.map(month => {
              const isCurrentMonth = month.id === CURRENT_MONTH_ID
              const isMainEvent = (month as any).isMain
              return (
                <th key={month.id} style={{
                  position:'sticky', top:0, zIndex:30,
                  background: isMainEvent ? '#7f1d1d' : isCurrentMonth ? '#1e3a8a' : '#091929',
                  color: isMainEvent ? '#fca5a5' : isCurrentMonth ? '#93c5fd' : 'rgba(255,255,255,.7)',
                  fontSize:'.75rem', fontWeight:600, textAlign:'center',
                  height:42, borderLeft:'1px solid rgba(255,255,255,.05)',
                  minWidth:86, whiteSpace:'nowrap', verticalAlign:'middle'
                }}>
                  <div>{month.label}</div>
                  {isCurrentMonth && <div style={{ fontSize:'.56rem', color:'#60a5fa', marginTop:1 }}>◀ 今月</div>}
                  {isMainEvent && <div style={{ fontSize:'.56rem', marginTop:1 }}>🎉 本番</div>}
                </th>
              )
            })}
          </tr>

          {/* ── Milestone strip ── */}
          <tr>
            <td style={{ position:'sticky', left:0, top:42, zIndex:20, background:'#0a1a2b', color:'#E8C96A', fontSize:'.65rem', fontWeight:700, letterSpacing:'.05em', padding:'0 14px', borderRight:'1px solid rgba(255,255,255,.07)', height:52, verticalAlign:'middle', whiteSpace:'nowrap' }}>
              主なイベント ✏️
            </td>
            {MONTHS.map(month => {
              const milestone = milestones.find(m => m.month_id === month.id)
              return (
                <td key={month.id}
                  onClick={e => onMilestoneClick(month.id, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                  style={{ position:'sticky', top:42, zIndex:10, background:'#0c1f33', height:52, verticalAlign:'middle', textAlign:'center', borderBottom:'2px solid rgba(201,168,76,.18)', borderLeft:'1px solid rgba(255,255,255,.04)', cursor:'pointer', transition:'background .12s' }}
                >
                  {milestone ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:3 }}>
                      <div style={{ width:8, height:8, background: milestone.is_main ? '#f87171' : '#C9A84C', transform:'rotate(45deg)', borderRadius:1, flexShrink:0 }}></div>
                      <div style={{ fontSize:'.59rem', color: milestone.is_main ? '#fca5a5' : 'rgba(232,201,106,.85)', lineHeight:1.25, whiteSpace:'pre-line', textAlign:'center' }}>{milestone.text}</div>
                    </div>
                  ) : (
                    <div style={{ fontSize:'.6rem', color:'rgba(255,255,255,.2)' }}>＋</div>
                  )}
                </td>
              )
            })}
          </tr>
        </thead>

        {sections.map((section, secIdx) => {
          const doneCnt = section.tasks.filter(t => t.cells.some(c => c.content === '済')).length
          const totalCnt = section.tasks.length
          const pct = totalCnt > 0 ? Math.round(doneCnt / totalCnt * 100) : 0
          const isSub = section.is_sub
          const secBg = isSub ? '#f0ebff' : '#e4eaf5'
          const secBorder = isSub ? '1px solid #e9d5ff' : '2px solid #E2E8F0'
          const isSecHovered = hoveredSectionId === section.id

          return (
            <tbody key={section.id}>
              {/* ── Section Header ── */}
              <tr>
                <td
                  style={{ position:'sticky', left:0, zIndex:8, background: secBg, borderTop: secBorder, borderBottom:'1px solid #E2E8F0', height:34, minWidth:248, maxWidth:248, padding:0 }}
                  onMouseEnter={() => setHoveredSectionId(section.id)}
                  onMouseLeave={() => setHoveredSectionId(null)}
                >
                  <div style={{ display:'flex', alignItems:'center', height:'100%', gap:5, padding:'0 6px 0 12px' }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background: section.color || '#94a3b8' }}></div>

                    {editingSectionId === section.id ? (
                      <input
                        autoFocus
                        value={editingSectionName}
                        onChange={e => setEditingSectionName(e.target.value)}
                        onBlur={() => handleSectionNameSave(section.id)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSectionNameSave(section.id); if (e.key === 'Escape') setEditingSectionId(null) }}
                        style={{ fontSize:'.7rem', fontWeight:700, border:'none', background:'white', borderRadius:3, padding:'2px 4px', outline:'2px solid #2B5A8A', fontFamily:'inherit', width:110 }}
                      />
                    ) : (
                      <span
                        onDoubleClick={() => handleSectionNameDoubleClick(section.id, section.name)}
                        title="ダブルクリックで名前を編集"
                        style={{ fontSize:'.7rem', fontWeight:700, color:'#334155', cursor:'pointer', padding:'2px 3px', borderRadius:3, maxWidth:90, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                      >
                        {section.name}
                      </span>
                    )}

                    <span style={{ fontSize:'.6rem', color:'#64748B', background:'#E2E8F0', borderRadius:10, padding:'1px 5px', whiteSpace:'nowrap', flexShrink:0 }}>{totalCnt}</span>

                    <div style={{ flex:1, margin:'0 3px', minWidth:30 }}>
                      <div style={{ height:3, background:'#E2E8F0', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:2, transition:'width .4s', background: section.color || '#3B82F6', width:`${pct}%` }}></div>
                      </div>
                      <div style={{ fontSize:'.55rem', color:'#94A3B8', marginTop:1 }}>{pct}%</div>
                    </div>

                    {/* ── Hover: section action buttons ── */}
                    {isSecHovered && (
                      <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); onSectionMove(section.id, 'up') }}
                          disabled={secIdx === 0}
                          title="上に移動"
                          style={{ padding:'2px 5px', background:'white', border:'1px solid #CBD5E1', borderRadius:3, cursor: secIdx === 0 ? 'default' : 'pointer', color: secIdx === 0 ? '#CBD5E1' : '#64748B', fontSize:'.72rem', fontFamily:'inherit', lineHeight:1 }}
                        >↑</button>
                        <button
                          onClick={e => { e.stopPropagation(); onSectionMove(section.id, 'down') }}
                          disabled={secIdx === sections.length - 1}
                          title="下に移動"
                          style={{ padding:'2px 5px', background:'white', border:'1px solid #CBD5E1', borderRadius:3, cursor: secIdx === sections.length - 1 ? 'default' : 'pointer', color: secIdx === sections.length - 1 ? '#CBD5E1' : '#64748B', fontSize:'.72rem', fontFamily:'inherit', lineHeight:1 }}
                        >↓</button>
                        <button
                          onClick={e => { e.stopPropagation(); onSectionDelete(section.id) }}
                          title="セクションを削除"
                          style={{ padding:'2px 5px', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:3, cursor:'pointer', color:'#EF4444', fontSize:'.65rem', fontFamily:'inherit', lineHeight:1 }}
                        >🗑</button>
                      </div>
                    )}

                    <button
                      onClick={() => onToggleSection(section.id)}
                      style={{ fontSize:'.65rem', color:'#64748B', background:'none', border:'none', cursor:'pointer', padding:'3px 4px', borderRadius:4, fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}
                    >
                      {section.is_open ? '▼' : '▶'}
                    </button>
                  </div>
                </td>
                {MONTHS.map(month => {
                  const isCurrentMonth = month.id === CURRENT_MONTH_ID
                  const isMainEvent = (month as any).isMain
                  return (
                    <td key={month.id} style={{
                      height:34,
                      background: isMainEvent ? 'rgba(220,38,38,.04)' : isCurrentMonth ? 'rgba(37,99,235,.04)' : secBg,
                      borderTop: secBorder, borderBottom:'1px solid #E2E8F0', borderLeft:'1px solid #CBD5E1'
                    }}></td>
                  )
                })}
              </tr>

              {/* ── Task Rows ── */}
              {section.is_open && section.tasks.map(task => (
                <tr key={task.id}>
                  <td
                    style={{ position:'sticky', left:0, zIndex:7, background:'white', borderBottom:'1px solid #E2E8F0', minWidth:248, maxWidth:248, borderRight:'1px solid #E2E8F0', padding:0, height:36 }}
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                  >
                    <div style={{ display:'flex', alignItems:'stretch', height:'100%' }}>
                      <div style={{ width:3, flexShrink:0, background: section.color || '#94a3b8' }}></div>
                      <div style={{ flex:1, padding:'0 6px 0 7px', display:'flex', flexDirection:'column', justifyContent:'center', minWidth:0 }}>

                        {editingTaskId === task.id ? (
                          <input
                            autoFocus
                            value={editingTaskName}
                            onChange={e => setEditingTaskName(e.target.value)}
                            onBlur={() => handleTaskNameSave(task.id)}
                            onKeyDown={e => { if (e.key === 'Enter') handleTaskNameSave(task.id); if (e.key === 'Escape') setEditingTaskId(null) }}
                            style={{ fontSize:'.78rem', color:'#334155', border:'none', background:'white', outline:'2px solid #2B5A8A', borderRadius:3, width:'100%', padding:'1px 3px', fontFamily:'inherit' }}
                          />
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:3, minWidth:0 }}>
                            <span
                              style={{ fontSize:'.78rem', color:'#334155', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}
                              title={task.name}
                              onDoubleClick={() => handleTaskNameDoubleClick(task.id, task.name)}
                            >
                              {task.name}
                            </span>
                            {/* ホバー時に鉛筆ボタン表示 */}
                            {hoveredTaskId === task.id && (
                              <button
                                onClick={e => { e.stopPropagation(); handleTaskNameDoubleClick(task.id, task.name) }}
                                title="タスク名を編集"
                                style={{ flexShrink:0, padding:'1px 4px', background:'white', border:'1px solid #CBD5E1', borderRadius:3, cursor:'pointer', color:'#64748B', fontSize:'.62rem', fontFamily:'inherit', lineHeight:1 }}
                              >✏</button>
                            )}
                          </div>
                        )}

                        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2 }}>
                          {task.due_date ? (
                            <button
                              onClick={e => onDateChipClick(task.id, task.due_date, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                              style={{ display:'inline-flex', alignItems:'center', gap:3, background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:5, padding:'1px 6px', fontSize:'.63rem', color:'#0369a1', cursor:'pointer', whiteSpace:'nowrap' }}
                            >
                              📅 {fmtDate(task.due_date)}
                            </button>
                          ) : (
                            <button
                              onClick={e => onDateChipClick(task.id, null, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                              style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:'.62rem', color:'#94A3B8', cursor:'pointer', padding:'1px 4px', borderRadius:4, background:'none', border:'none', fontFamily:'inherit' }}
                            >
                              ＋ 日付
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {MONTHS.map(month => {
                    const cell = task.cells.find(c => c.month_id === month.id)
                    const isCurrentMonth = month.id === CURRENT_MONTH_ID
                    const isMainEvent = (month as any).isMain
                    return (
                      <td key={month.id}
                        onClick={() => onCellClick(task.id, month.id, task.name, section.name, cell || null, section.id)}
                        style={{
                          height:36, borderBottom:'1px solid #E2E8F0',
                          textAlign:'center', cursor:'pointer', verticalAlign:'middle',
                          minWidth:86, position:'relative',
                          background: isMainEvent ? 'rgba(220,38,38,.04)' : isCurrentMonth ? 'rgba(37,99,235,.04)' : 'white',
                          borderLeft:'1px solid #CBD5E1'
                        }}
                      >
                        {cell && renderStatusBadge(cell.content)}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* ── Add Task Row ── */}
              {section.is_open && (
                <tr>
                  <td style={{ position:'sticky', left:0, zIndex:7, background:'white', borderBottom:'1px solid #E2E8F0', height:26, minWidth:248, maxWidth:248, padding:0 }}>
                    <button
                      onClick={() => onAddTaskToSection(section.id)}
                      style={{ display:'flex', alignItems:'center', gap:4, height:'100%', width:'100%', padding:'0 0 0 18px', background:'none', border:'none', cursor:'pointer', color:'#94A3B8', fontSize:'.7rem', fontFamily:'inherit' }}
                    >
                      <span style={{ fontSize:'.95rem', lineHeight:1 }}>＋</span> タスクを追加
                    </button>
                  </td>
                  {MONTHS.map(month => {
                    const isCurrentMonth = month.id === CURRENT_MONTH_ID
                    const isMainEvent = (month as any).isMain
                    return (
                      <td key={month.id} style={{
                        height:26, borderBottom:'1px solid #E2E8F0',
                        background: isMainEvent ? 'rgba(220,38,38,.04)' : isCurrentMonth ? 'rgba(37,99,235,.04)' : 'white',
                        borderLeft:'1px solid #CBD5E1'
                      }}></td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

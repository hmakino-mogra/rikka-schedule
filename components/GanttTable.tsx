'use client'

import { useState, useRef, useEffect } from 'react'
import { SectionWithTasks, TaskWithCells, TaskCell, Milestone, Comment, MONTHS, CURRENT_MONTH_ID, fmtDate } from '@/lib/database.types'
import { useIsMobile } from '@/lib/useIsMobile'

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
  onTaskReorder: (sectionId: string, fromTaskId: string, toTaskId: string, insertBefore: boolean) => void
  commentMap?: Record<string, Comment[]>
}

// ── 令和日付文字列 (例: "R7.12.19") をパース ──────────────────
function parseReiwaDate(s: string): Date | null {
  const m = s?.match(/^R(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return null
  return new Date(parseInt(m[1]) + 2018, parseInt(m[2]) - 1, parseInt(m[3]))
}

// ── アラートレベル判定 ──────────────────────────────────────────
type AlertLevel = 'overdue' | 'delayed' | 'done' | 'ok'

function getTaskAlert(task: TaskWithCells): AlertLevel {
  const isDone = task.cells.some(c => c.content === '済')
  if (isDone) return 'done'

  // due_date が今日より前なら期限切れ
  if (task.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = new Date(task.due_date + 'T00:00:00')
    if (due < today) return 'overdue'
  }

  // 過去月に「予定」または令和日付が付いているが「済み扱い」でない → 遅延中
  const today2 = new Date(); today2.setHours(0, 0, 0, 0)
  const hasDelayed = MONTHS
    .filter(m => m.id < CURRENT_MONTH_ID)
    .some(m => {
      const c = task.cells.find(cell => cell.month_id === m.id)
      if (!c) return false
      // cell_date が過去 → 実施済みとみなす（期間がある場合は終了日で判定）
      const cellCheckDate = c.cell_date_end || c.cell_date
      if (cellCheckDate && new Date(cellCheckDate + 'T00:00:00') < today2) return false
      // content が過去の令和日付 → 実施済みとみなす
      const rDate = parseReiwaDate(c.content || '')
      if (rDate && rDate < today2) return false
      return c.content === '予定'
    })
  if (hasDelayed) return 'delayed'

  return 'ok'
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
  onTaskReorder,
  commentMap = {},
}: Props) {
  const isMobile = useIsMobile()

  // レスポンシブ寸法
  const TASK_COL_W = isMobile ? 150 : 248
  const CELL_W     = isMobile ? 70  : 86
  const ROW_H      = isMobile ? 40  : 46
  const SEC_H      = isMobile ? 32  : 38
  const MS_H       = isMobile ? 44  : 60
  const MONTH_H    = isMobile ? 36  : 42
  // ヘッダー合計: モバイル 52+40=92、デスクトップ 66+44=110
  const TABLE_H    = isMobile ? 'calc(100dvh - 92px)' : 'calc(100dvh - 110px)'

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [hoveredTaskKey, setHoveredTaskKey] = useState<string | null>(null)
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null)
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragOverInfo, setDragOverInfo] = useState<{ taskId: string; position: 'before' | 'after' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── 今月の列が画面中央に来るよう初回スクロール ──
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!scrollRef.current) return
      const idx = MONTHS.findIndex(m => m.id === CURRENT_MONTH_ID)
      if (idx < 0) return
      const targetLeft = TASK_COL_W + CELL_W * idx
      const containerWidth = scrollRef.current.clientWidth
      const scrollTo = targetLeft - containerWidth / 2 + CELL_W / 2
      scrollRef.current.scrollTo({ left: Math.max(0, scrollTo), behavior: 'smooth' })
    }, 150)
    return () => clearTimeout(timer)
  }, [isMobile])

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

  // ── ステータスバッジ ──
  const renderStatusBadge = (content: string | null) => {
    if (!content) return null
    if (content === '済')
      return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:11, fontSize:'.67rem', fontWeight:700, lineHeight:1, background:'#D1FAE5', color:'#059669' }}>✓ 済</span>
    if (content === '予定')
      return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:11, fontSize:'.67rem', fontWeight:700, lineHeight:1, background:'#FEF3C7', color:'#D97706' }}>● 予定</span>
    return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:11, fontSize:'.67rem', fontWeight:700, lineHeight:1, background:'#DBEAFE', color:'#2563EB' }}>{content}</span>
  }

  // ── セル内容（ステータス + 実行日 + 担当者）──
  const renderCellContent = (cell: TaskCell) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // cell_date による過去判定 - 期間がある場合は終了日で判定
    const isPastCellDate = (() => {
      if (!cell.cell_date) return false
      const checkDate = cell.cell_date_end || cell.cell_date  // 期間モードは終了日基準
      return new Date(checkDate + 'T00:00:00') < today
    })()

    // content が令和日付文字列の場合の過去判定 (例: "R7.12.19")
    const rDate = parseReiwaDate(cell.content || '')
    const isReiwaDateContent = rDate !== null
    const isPastReiwaContent = isReiwaDateContent && rDate! < today

    const isPast = isPastCellDate || isPastReiwaContent
    const autoCompleted = isPast && cell.content !== '済'

    // 令和日付コンテンツの表示ラベル（例: "R7.12.19" → "12/19"）
    const reiwaDisplayDate = isReiwaDateContent && rDate
      ? `${rDate.getMonth() + 1}/${rDate.getDate()}`
      : null

    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'2px 0' }}>
        {autoCompleted
          ? <span style={{ fontSize:'.6rem', color:'#CBD5E1', fontStyle:'italic', lineHeight:1 }}>✓ 実施済</span>
          : isReiwaDateContent
            ? null  // 令和日付コンテンツは下のチップで表示
            : renderStatusBadge(cell.content)
        }
        {/* 令和日付コンテンツ or cell_date（期間含む）をチップ表示 */}
        {(reiwaDisplayDate || cell.cell_date || cell.cell_date_end) && (
          <span style={{
            fontSize:'.6rem', lineHeight:1, fontWeight:700,
            borderRadius:3, padding:'1px 5px',
            color:      isPast ? '#94A3B8' : '#2563EB',
            background: isPast ? '#F8FAFC'  : '#EFF6FF',
            border:     `1px solid ${isPast ? '#E2E8F0' : '#BFDBFE'}`,
            whiteSpace: 'nowrap',
          }}>
            {reiwaDisplayDate || (cell.cell_date ? fmtDate(cell.cell_date) : '')}
            {cell.cell_date_end && `〜${fmtDate(cell.cell_date_end)}`}
          </span>
        )}
        {cell.assignee && (
          <span style={{
            fontSize:'.65rem', color:'#475569', lineHeight:1,
            maxWidth:78, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            background:'#F1F5F9', borderRadius:3, padding:'2px 5px',
          }}>
            👤 {cell.assignee}
          </span>
        )}
        {/* メモ・コメントインジケーター */}
        {(cell.memo || (commentMap[`${cell.task_id}-${cell.month_id}`]?.length ?? 0) > 0) && (
          <div style={{ display:'flex', gap:3, alignItems:'center', marginTop:1 }}>
            {cell.memo && (
              <span style={{ fontSize:'.58rem', background:'#FEF3C7', color:'#92400E', borderRadius:3, padding:'1px 4px', lineHeight:1.3, fontWeight:600 }}>
                📝
              </span>
            )}
            {(commentMap[`${cell.task_id}-${cell.month_id}`]?.length ?? 0) > 0 && (
              <span style={{ fontSize:'.58rem', background:'#EFF6FF', color:'#1D4ED8', borderRadius:3, padding:'1px 4px', lineHeight:1.3, fontWeight:600 }}>
                💬 {commentMap[`${cell.task_id}-${cell.month_id}`].length}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{ height: TABLE_H, overflow:'auto', position:'relative', zIndex:0 }}
      className="custom-scroll"
    >
      <table style={{ borderCollapse:'collapse', width:'max-content', minWidth:'100%' }}>
        <thead>
          {/* ── Month header row ── */}
          <tr>
            <th style={{ position:'sticky', left:0, top:0, zIndex:40, background:'#091929', color:'rgba(255,255,255,.3)', fontSize: isMobile ? '.58rem' : '.65rem', fontWeight:400, textAlign:'left', padding:'0 10px', minWidth:TASK_COL_W, maxWidth:TASK_COL_W, height:MONTH_H, borderRight:'1px solid rgba(255,255,255,.07)' }}>
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
                  fontSize: isMobile ? '.63rem' : '.75rem', fontWeight:600, textAlign:'center',
                  height:MONTH_H, borderLeft:'1px solid rgba(255,255,255,.05)',
                  minWidth:CELL_W, whiteSpace:'nowrap', verticalAlign:'middle'
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
            <td style={{ position:'sticky', left:0, top:MONTH_H, zIndex:20, background:'#0a1a2b', color:'#E8C96A', fontSize: isMobile ? '.6rem' : '.68rem', fontWeight:700, letterSpacing:'.05em', padding: isMobile ? '0 8px' : '0 14px', borderRight:'1px solid rgba(255,255,255,.07)', height:MS_H, verticalAlign:'middle', whiteSpace:'nowrap' }}>
              主なイベント ✏️
            </td>
            {MONTHS.map(month => {
              const monthMilestones = milestones.filter(m => m.month_id === month.id)
              return (
                <td key={month.id}
                  onClick={e => onMilestoneClick(month.id, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                  style={{ position:'sticky', top:MONTH_H, zIndex:10, background:'#0c1f33', height:MS_H, verticalAlign:'middle', textAlign:'center', borderBottom:'2px solid rgba(201,168,76,.18)', borderLeft:'1px solid rgba(255,255,255,.04)', cursor:'pointer', transition:'background .12s' }}
                >
                  {monthMilestones.length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'2px 3px', overflowY:'auto', maxHeight: MS_H - 4 }}>
                      {monthMilestones.map(ms => (
                        <div key={ms.id} style={{ fontSize: isMobile ? '.56rem' : '.63rem', color: ms.is_main ? '#fca5a5' : 'rgba(232,201,106,.9)', lineHeight:1.35, textAlign:'center', maxWidth: CELL_W - 4, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ms.text}</div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:'.65rem', color:'rgba(255,255,255,.2)' }}>＋</div>
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

          // セクション内のアラート数を集計
          const alertCounts = section.tasks.reduce((acc, t) => {
            const a = getTaskAlert(t)
            if (a === 'overdue') acc.overdue++
            else if (a === 'delayed') acc.delayed++
            return acc
          }, { overdue: 0, delayed: 0 })

          const isSub = section.is_sub
          const secBg = isSub ? '#F3F0FD' : '#EEF2F8'
          const secAccentColor = section.color || (isSub ? '#8B5CF6' : '#64748B')
          const secBorder = `3px solid ${secAccentColor}`
          const isSecHovered = hoveredSectionId === section.id

          return (
            <tbody key={section.id}>
              {/* ── Section Header ── */}
              <tr>
                <td
                  style={{ position:'sticky', left:0, zIndex:8, background: secBg, borderTop: secBorder, borderBottom:'1px solid #BDC9D9', height:SEC_H, minWidth:TASK_COL_W, maxWidth:TASK_COL_W, padding:0 }}
                  onMouseEnter={() => setHoveredSectionId(section.id)}
                  onMouseLeave={() => setHoveredSectionId(null)}
                >
                  <div style={{ display:'flex', alignItems:'center', height:'100%', gap:5, padding:'0 6px 0 0' }}>
                    {/* セクションカラーの太い左アクセントライン */}
                    <div style={{ width:4, alignSelf:'stretch', flexShrink:0, background: section.color || '#94a3b8', borderRadius:'0 2px 2px 0' }}></div>

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
                        style={{ fontSize: isMobile ? '.65rem' : '.73rem', fontWeight:800, color:'#1E293B', cursor:'pointer', padding:'2px 3px', borderRadius:3, maxWidth: isMobile ? 60 : 85, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}
                      >
                        {section.name}
                      </span>
                    )}

                    <span style={{ fontSize:'.6rem', color:'#64748B', background:'#E2E8F0', borderRadius:10, padding:'1px 5px', whiteSpace:'nowrap', flexShrink:0 }}>{totalCnt}</span>

                    {/* アラートバッジをセクションヘッダーにも表示 */}
                    {alertCounts.overdue > 0 && (
                      <span title={`期限切れ ${alertCounts.overdue}件`} style={{ fontSize:'.58rem', fontWeight:700, background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'1px 5px', whiteSpace:'nowrap', flexShrink:0 }}>
                        🔴 {alertCounts.overdue}
                      </span>
                    )}
                    {alertCounts.delayed > 0 && (
                      <span title={`遅延 ${alertCounts.delayed}件`} style={{ fontSize:'.58rem', fontWeight:700, background:'#FEF3C7', color:'#B45309', borderRadius:8, padding:'1px 5px', whiteSpace:'nowrap', flexShrink:0 }}>
                        🟡 {alertCounts.delayed}
                      </span>
                    )}

                    <div style={{ flex:1, margin:'0 3px', minWidth:20 }}>
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
                      height:SEC_H,
                      background: isMainEvent ? 'rgba(220,38,38,.04)' : isCurrentMonth ? 'rgba(37,99,235,.05)' : secBg,
                      borderTop: secBorder, borderBottom:'1px solid #BDC9D9', borderLeft:'1px solid #E4EBF2',
                    }}></td>
                  )
                })}
              </tr>

              {/* ── Task Rows ── */}
              {section.is_open && section.tasks.map((task, taskIdx) => {
                const alert = getTaskAlert(task)
                const taskKey = `${section.id}-${task.id}`
                const isHovered = hoveredTaskKey === taskKey
                const isFirstTask = taskIdx === 0
                const isLastTask  = taskIdx === section.tasks.length - 1
                // このセクションにリンクされた外部タスクかどうか
                const isLinkedTask = task.section_id !== section.id
                // 完了タスク判定
                const isDone = task.cells.some(c => c.content === '済')

                // タスク行は白ベース（セクションカラー着色なし）
                const sectionTint = '#FFFFFF'

                // アラートに応じた色設定
                const rowBg    = alert === 'overdue' ? 'rgba(239,68,68,.04)'  : alert === 'delayed' ? 'rgba(245,158,11,.04)' : sectionTint
                const barColor = alert === 'overdue' ? '#EF4444'              : alert === 'delayed' ? '#F59E0B'              : (section.color || '#94a3b8')
                // ホバー時の行背景
                const hoverTaskBg = alert === 'overdue' ? 'rgba(239,68,68,.08)' : alert === 'delayed' ? 'rgba(245,158,11,.08)' : '#F0F7FF'

                const isDragOver = dragOverInfo?.taskId === task.id
                const dropShadow = isDragOver
                  ? (dragOverInfo?.position === 'before'
                    ? 'inset 0 2px 0 #3B82F6'
                    : 'inset 0 -2px 0 #3B82F6')
                  : undefined

                return (
                  <tr
                    key={`${section.id}-${task.id}`}
                    draggable={true}
                    onMouseEnter={() => setHoveredTaskKey(taskKey)}
                    onMouseLeave={() => setHoveredTaskKey(null)}
                    onDragStart={e => {
                      setDraggedTaskId(task.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', task.id)
                    }}
                    onDragOver={e => {
                      e.preventDefault()
                      if (!draggedTaskId || draggedTaskId === task.id) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                      setDragOverInfo({ taskId: task.id, position })
                    }}
                    onDragLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverInfo(null)
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      if (draggedTaskId && draggedTaskId !== task.id && dragOverInfo) {
                        onTaskReorder(section.id, draggedTaskId, task.id, dragOverInfo.position === 'before')
                      }
                      setDraggedTaskId(null); setDragOverInfo(null)
                    }}
                    onDragEnd={() => { setDraggedTaskId(null); setDragOverInfo(null) }}
                    style={{ opacity: draggedTaskId === task.id ? 0.35 : 1, transition:'opacity .1s' }}
                  >
                    <td
                      style={{ position:'sticky', left:0, zIndex:7, background: isHovered ? hoverTaskBg : rowBg, borderBottom:'1px solid #BDC9D9', minWidth:TASK_COL_W, maxWidth:TASK_COL_W, borderRight:'1px solid #E8EDF3', padding:0, height:ROW_H, transition:'background .1s', boxShadow: dropShadow }}
                    >
                      <div style={{ display:'flex', alignItems:'stretch', height:'100%' }}>
                        {/* 左のカラーバー（アラート時は赤/橙） */}
                        <div style={{ width:3, flexShrink:0, background: barColor }}></div>
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
                            <div style={{ display:'flex', alignItems:'center', gap:2, minWidth:0 }}>
                              {/* ドラッグハンドル */}
                              <span
                                title={isLinkedTask ? '共同担当タスク（ドラッグして並べ替え）' : 'ドラッグして並べ替え'}
                                style={{ flexShrink:0, fontSize:'.85rem', color: isHovered ? '#94A3B8' : 'transparent', cursor: 'grab', lineHeight:1, userSelect:'none', transition:'color .1s' }}
                              >⠿</span>
                              {/* 🔗バッジ（リンクタスク or 共同担当あり） */}
                              {(isLinkedTask || ((task.linked_section_ids ?? []).length > 0 && !isHovered)) && (
                                <span title={isLinkedTask ? '共同担当タスク' : '共同担当部署あり'} style={{ flexShrink:0, fontSize:'.65rem', lineHeight:1 }}>🔗</span>
                              )}
                              <span
                                style={{ fontSize: isMobile ? '.68rem' : '.78rem', color: isDone ? '#94A3B8' : '#334155', textDecoration: isDone ? 'line-through' : 'none', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}
                                title={task.name}
                                onDoubleClick={() => handleTaskNameDoubleClick(task.id, task.name)}
                              >
                                {task.name}
                              </span>
                              {isHovered && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleTaskNameDoubleClick(task.id, task.name) }}
                                  title="タスク名を編集"
                                  style={{ flexShrink:0, padding:'1px 4px', background:'white', border:'1px solid #CBD5E1', borderRadius:3, cursor:'pointer', color:'#64748B', fontSize:'.62rem', fontFamily:'inherit', lineHeight:1 }}
                                >✏</button>
                              )}
                            </div>
                          )}

                          {/* 日付チップ or アラートバッジ */}
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                            {task.due_date ? (
                              <button
                                onClick={e => onDateChipClick(task.id, task.due_date, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                                style={{
                                  display:'inline-flex', alignItems:'center', gap:3, borderRadius:5, padding:'1px 6px', fontSize:'.63rem', cursor:'pointer', whiteSpace:'nowrap',
                                  background: alert === 'overdue' ? '#FEE2E2' : '#f0f9ff',
                                  border:     alert === 'overdue' ? '1px solid #FCA5A5' : '1px solid #bae6fd',
                                  color:      alert === 'overdue' ? '#DC2626' : '#0369a1',
                                }}
                              >
                                📅 {fmtDate(task.due_date)}
                                {alert === 'overdue' && <span style={{ fontWeight:700 }}>期限切れ</span>}
                              </button>
                            ) : isHovered ? (
                              <button
                                onClick={e => onDateChipClick(task.id, null, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                                style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:'.62rem', color:'#94A3B8', cursor:'pointer', padding:'1px 4px', borderRadius:4, background:'none', border:'none', fontFamily:'inherit' }}
                              >
                                ＋ 日付
                              </button>
                            ) : null}
                            {/* 遅延バッジ（due_dateなし or 遅延中） */}
                            {alert === 'delayed' && (
                              <span style={{ fontSize:'.58rem', fontWeight:700, color:'#B45309', background:'#FEF3C7', borderRadius:6, padding:'1px 5px', whiteSpace:'nowrap' }}>
                                ⚠ 遅延
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {MONTHS.map(month => {
                      const cell = task.cells.find(c => c.month_id === month.id)
                      const isCurrentMonth = month.id === CURRENT_MONTH_ID
                      const isMainEvent = (month as any).isMain

                      // 期間セルの跨ぎ検出: このタスクに cell_date_end があり、このmonthをカバーするセルを探す
                      const mo = month as unknown as { year: number; month: number }
                      const spanningCell = !cell ? (task.cells.find(c => {
                        if (!c.cell_date || !c.cell_date_end) return false
                        const mStart = new Date(mo.year, mo.month - 1, 1)
                        const mEnd   = new Date(mo.year, mo.month, 0)       // 月末日
                        const rStart = new Date(c.cell_date    + 'T00:00:00')
                        const rEnd   = new Date(c.cell_date_end + 'T00:00:00')
                        return rStart <= mEnd && rEnd >= mStart
                      }) ?? null) : null

                      // 遅延・期限切れの月セルは背景を強調
                      const cellAlertBg = (() => {
                        if (isMainEvent) return 'rgba(220,38,38,.03)'
                        if (isCurrentMonth) return 'rgba(37,99,235,.03)'
                        if (alert !== 'ok' && alert !== 'done' && month.id < CURRENT_MONTH_ID && cell?.content === '予定')
                          return 'rgba(245,158,11,.06)'
                        return '#FFFFFF'
                      })()
                      // ホバー時の月セル背景
                      const monthHoverBg = isMainEvent
                        ? 'rgba(220,38,38,.07)'
                        : isCurrentMonth
                          ? 'rgba(37,99,235,.10)'
                          : alert === 'overdue' ? 'rgba(239,68,68,.07)' : alert === 'delayed' ? 'rgba(245,158,11,.07)' : '#EFF6FF'

                      const cellKey = `${task.id}-${month.id}`
                      const cellComments = commentMap[cellKey] ?? []
                      const hasMemo = !!cell?.memo
                      const hasTooltip = cell && (hasMemo || cellComments.length > 0)
                      const isTooltipVisible = hoveredCellKey === cellKey && hasTooltip

                      return (
                        <td key={month.id}
                          onClick={() => {
                            // 跨ぎバー（spanningCell）をクリックした場合は元のmonth_idを使う
                            const editMonthId = cell ? month.id : (spanningCell ? spanningCell.month_id : month.id)
                            onCellClick(task.id, editMonthId, task.name, section.name, cell || spanningCell || null, section.id)
                          }}
                          onMouseEnter={() => hasTooltip && setHoveredCellKey(cellKey)}
                          onMouseLeave={() => setHoveredCellKey(null)}
                          style={{
                            height:ROW_H, borderBottom:'1px solid #BDC9D9', borderLeft:'1px solid #E4EBF2',
                            textAlign:'center', cursor:'pointer', verticalAlign:'middle',
                            minWidth:86, position:'relative',
                            background: isHovered ? monthHoverBg : cellAlertBg,
                            transition:'background .1s',
                            boxShadow: dropShadow,
                          }}
                        >
                          {cell && renderCellContent(cell)}
                          {/* 期間バー: cell_date_end がある範囲の月に跨ぎバーを表示 */}
                          {!cell && spanningCell && (
                            <div style={{
                              height: 8,
                              background: barColor,
                              opacity: 0.35,
                              margin: '0 3px',
                              borderRadius: 3,
                            }} />
                          )}
                          {/* 空セルのホバーヒント */}
                          {!cell && !spanningCell && isHovered && (
                            <span style={{ fontSize:'.72rem', color:'#CBD5E1', userSelect:'none', lineHeight:1 }}>＋</span>
                          )}
                          {/* メモ・コメントホバーツールチップ */}
                          {isTooltipVisible && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                position:'absolute', bottom:'calc(100% + 6px)', left:'50%',
                                transform:'translateX(-50%)',
                                background:'#1E293B', color:'#F1F5F9',
                                borderRadius:8, padding:'8px 10px',
                                fontSize:'.72rem', lineHeight:1.5,
                                whiteSpace:'pre-wrap', textAlign:'left',
                                maxWidth:220, minWidth:120,
                                zIndex:500,
                                boxShadow:'0 4px 16px rgba(0,0,0,.28)',
                                pointerEvents:'none',
                              }}
                            >
                              {hasMemo && (
                                <div>
                                  <div style={{ fontSize:'.62rem', color:'#94A3B8', fontWeight:700, marginBottom:3 }}>📝 メモ</div>
                                  <div style={{ color:'#F8FAFC' }}>{cell!.memo}</div>
                                </div>
                              )}
                              {cellComments.length > 0 && (
                                <div style={{ marginTop: hasMemo ? 8 : 0 }}>
                                  <div style={{ fontSize:'.62rem', color:'#94A3B8', fontWeight:700, marginBottom:3 }}>💬 コメント ({cellComments.length}件)</div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:160, overflowY:'auto' }}>
                                    {cellComments.map(c => (
                                      <div key={c.id} style={{ borderTop:'1px solid rgba(255,255,255,.1)', paddingTop:4 }}>
                                        <div style={{ fontSize:'.62rem', color:'#94A3B8', marginBottom:2 }}>
                                          {c.author} · {new Date(c.created_at).toLocaleDateString('ja-JP', { month:'numeric', day:'numeric' })}
                                        </div>
                                        <div style={{ color:'#F8FAFC' }}>{c.text}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* ── Add Task Row ── */}
              {section.is_open && (
                <tr>
                  <td style={{ position:'sticky', left:0, zIndex:7, background:'white', borderBottom:'1px solid #E2E8F0', height: isMobile ? 24 : 26, minWidth:TASK_COL_W, maxWidth:TASK_COL_W, padding:0 }}>
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
                        height:26, borderBottom:'1px solid #BDC9D9', borderLeft:'1px solid #E4EBF2',
                        background: isMainEvent ? 'rgba(220,38,38,.03)' : isCurrentMonth ? 'rgba(37,99,235,.03)' : 'white',
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

import * as XLSX from 'xlsx'
import { SectionWithTasks, Milestone, MONTHS } from './database.types'

export function exportToExcel(sections: SectionWithTasks[], milestones: Milestone[]) {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: スケジュール表 ──────────────────────────────────

  const scheduleRows: (string | number)[][] = []

  // タイトル行
  scheduleRows.push(['51期 六華同窓会 スケジュール表', '', '', ...MONTHS.map(() => ''), '', ''])

  // ヘッダー行
  scheduleRows.push([
    '部署・セクション',
    'タスク名',
    '担当者',
    ...MONTHS.map(m => m.label),
    '進捗',
    'メモ',
  ])

  // セクション・タスク行
  for (const section of sections) {
    if (section.tasks.length === 0) continue

    // セクションヘッダー行
    scheduleRows.push([
      `【${section.name}】`,
      '', '', ...MONTHS.map(() => ''), '', '',
    ])

    for (const task of section.tasks) {
      const cellMap: Record<number, typeof task.cells[0]> = {}
      for (const c of task.cells) {
        cellMap[c.month_id] = c
      }

      // 各月のステータス
      const monthCells = MONTHS.map(m => {
        const c = cellMap[m.id]
        if (!c) return ''
        let val = c.content || ''
        // 日付情報があれば付加
        if (c.cell_date) {
          const d = new Date(c.cell_date + 'T00:00:00')
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
          val = val ? `${val}（${dateStr}）` : dateStr
        }
        return val
      })

      // 進捗計算
      const filledCells = task.cells.filter(c => c.content && c.content !== '未定')
      const totalMonths = MONTHS.length
      const progress = totalMonths > 0 ? `${Math.round((filledCells.length / totalMonths) * 100)}%` : ''

      // メモ集約（全月のメモを結合）
      const memos = task.cells
        .filter(c => c.memo)
        .map(c => {
          const m = MONTHS.find(mo => mo.id === c.month_id)
          return `[${m?.label ?? c.month_id}] ${c.memo}`
        })
        .join(' / ')

      scheduleRows.push([
        section.name,
        task.name,
        task.cells.find(c => c.assignee)?.assignee ?? '',
        ...monthCells,
        progress,
        memos,
      ])
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(scheduleRows)

  // 列幅設定
  ws1['!cols'] = [
    { wch: 16 }, // 部署
    { wch: 28 }, // タスク名
    { wch: 12 }, // 担当者
    ...MONTHS.map(() => ({ wch: 8 })), // 月列
    { wch: 8 },  // 進捗
    { wch: 40 }, // メモ
  ]

  XLSX.utils.book_append_sheet(wb, ws1, 'スケジュール表')

  // ── Sheet 2: 主なイベント ─────────────────────────────────────

  const eventRows: (string | boolean)[][] = []
  eventRows.push(['月', 'イベント名', '本番イベント'])

  for (const month of MONTHS) {
    const monthMs = milestones.filter(m => m.month_id === month.id)
    if (monthMs.length === 0) {
      // 空行は出さない
      continue
    }
    for (const ms of monthMs) {
      eventRows.push([month.label, ms.text, ms.is_main ? '●' : ''])
    }
  }

  const ws2 = XLSX.utils.aoa_to_sheet(eventRows)
  ws2['!cols'] = [{ wch: 8 }, { wch: 36 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws2, '主なイベント')

  // ── 担当者別サマリー Sheet 3 ─────────────────────────────────

  const assigneeMap: Record<string, { section: string; task: string; months: string[] }[]> = {}

  for (const section of sections) {
    for (const task of section.tasks) {
      // 担当者を取得（複数担当者対応）
      const assigneeStr = task.cells.find(c => c.assignee)?.assignee ?? ''
      const assignees = assigneeStr
        ? assigneeStr.split(/[・、\s]+/).filter(Boolean)
        : ['未設定']

      const activeMonths = task.cells
        .filter(c => c.content && c.content !== '未定')
        .map(c => MONTHS.find(m => m.id === c.month_id)?.label ?? '')
        .filter(Boolean)

      for (const assignee of assignees) {
        if (!assigneeMap[assignee]) assigneeMap[assignee] = []
        assigneeMap[assignee].push({
          section: section.name,
          task: task.name,
          months: activeMonths,
        })
      }
    }
  }

  const summaryRows: string[][] = []
  summaryRows.push(['担当者', '部署', 'タスク名', '担当月'])

  for (const [assignee, tasks] of Object.entries(assigneeMap).sort()) {
    for (const t of tasks) {
      summaryRows.push([assignee, t.section, t.task, t.months.join('、')])
    }
  }

  const ws3 = XLSX.utils.aoa_to_sheet(summaryRows)
  ws3['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 28 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws3, '担当者別サマリー')

  // ── ダウンロード ──────────────────────────────────────────────

  const today = new Date()
  const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  XLSX.writeFile(wb, `六華同窓会スケジュール_${dateStr}.xlsx`)
}

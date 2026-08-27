import ExcelJS from 'exceljs'
import type { AgeingReport, AgeBuckets, PersonAgeRow, TaskAgeRow } from '@/lib/types/reports'

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const HEADER_FILL = 'FF2563EB'
const TOTAL_FILL = 'FFEFF6FF'

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
}

/** The seven bands + three derived figures, in sheet order. */
function bands(b: AgeBuckets): (number | string)[] {
  return [
    b.not_yet_due, b.d1_7, b.d8_15, b.d16_30, b.d31_60, b.d61_90, b.d90_plus,
    b.total_pending, b.over_month_late, b.oldest_late_days ?? '', b.avg_late_days ?? '',
  ]
}

const BAND_HEADERS = [
  'Not Yet Due', '1 to 7 Days Late', '8 to 15 Days Late', '16 to 30 Days Late',
  '31 to 60 Days Late', '61 to 90 Days Late', 'More than 90 Days Late',
  'Total Pending', 'More than a Month Late', 'Oldest Late Task (Days)', 'Average Days Late',
]

/**
 * Build + download an .xlsx mirroring the client's "Pending and Overdue Ageing
 * Report": Person-wise Ageing, Task-wise Ageing, and the Pending Task List that
 * every figure is drawn from.
 */
export async function exportAgeingXlsx(report: AgeingReport, filename: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'V2E'
  wb.created = new Date()
  const asOn = fmtDate(report.as_on_date)

  // ── Person-wise Ageing ──────────────────────────────────────────────────────────
  const ps = wb.addWorksheet('Person-wise Ageing', { views: [{ state: 'frozen', ySplit: 3 }] })
  ps.columns = [{ width: 7 }, { width: 24 }, ...BAND_HEADERS.map(() => ({ width: 13 }))]
  const pTitle = ps.addRow(['Person-wise Pending & Overdue Ageing'])
  pTitle.font = { bold: true, size: 15, color: { argb: 'FF0F172A' } }
  ps.mergeCells(1, 1, 1, 13)
  const pSub = ps.addRow([`Position as on ${asOn}`])
  pSub.font = { italic: true, color: { argb: 'FF64748B' } }
  ps.mergeCells(2, 1, 2, 13)
  styleHeader(ps.addRow(['Sr. No.', 'Person Name', ...BAND_HEADERS]))
  report.people.forEach((p: PersonAgeRow, i) => {
    ps.addRow([i + 1, p.name, ...bands(p)]).alignment = { vertical: 'middle' }
  })
  const pTotal = ps.addRow(['', 'Total / Overall', ...bands(report.totals)])
  pTotal.font = { bold: true }
  pTotal.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } } })

  // ── Task-wise Ageing ───────────────────────────────────────────────────────────
  const ts = wb.addWorksheet('Task-wise Ageing', { views: [{ state: 'frozen', ySplit: 3 }] })
  ts.columns = [{ width: 7 }, { width: 40 }, { width: 12 }, ...BAND_HEADERS.map(() => ({ width: 13 }))]
  const tTitle = ts.addRow(['Task-wise Pending & Overdue Ageing'])
  tTitle.font = { bold: true, size: 15, color: { argb: 'FF0F172A' } }
  ts.mergeCells(1, 1, 1, 14)
  const tSub = ts.addRow([`Position as on ${asOn}`])
  tSub.font = { italic: true, color: { argb: 'FF64748B' } }
  ts.mergeCells(2, 1, 2, 14)
  styleHeader(ts.addRow(['Sr. No.', 'Task Name', 'Frequency', ...BAND_HEADERS]))
  report.tasks.forEach((t: TaskAgeRow, i) => {
    ts.addRow([i + 1, t.title, t.frequency, ...bands(t)]).alignment = { vertical: 'middle' }
  })
  const tTotal = ts.addRow(['', 'Total / Overall', '', ...bands(report.totals)])
  tTotal.font = { bold: true }
  tTotal.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } } })

  // ── Pending Task List ────────────────────────────────────────────────────────--
  const ls = wb.addWorksheet('Pending Task List', { views: [{ state: 'frozen', ySplit: 3 }] })
  ls.columns = [
    { width: 7 }, { width: 40 }, { width: 22 }, { width: 20 }, { width: 20 },
    { width: 12 }, { width: 14 }, { width: 11 }, { width: 20 }, { width: 12 },
  ]
  const lHead = ls.addRow(['Position As On Date', asOn])
  lHead.font = { bold: true, color: { argb: 'FF0F172A' } }
  ls.addRow([])
  styleHeader(ls.addRow([
    'Sr. No.', 'Task Name', 'Assigned To', 'Assigned By', 'Department',
    'Frequency', 'Due Date', 'Days Late', 'How Late', 'Status',
  ]))
  ls.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 10 } }
  report.pending.forEach((r, i) => {
    ls.addRow([
      i + 1, r.title, r.assigned_to, r.assigned_by ?? '', r.department ?? '',
      r.frequency, fmtDate(r.due_date), r.days_late ?? '', r.bucket_label, r.status,
    ])
  })

  ls.addRow([])
  const howHead = ls.addRow(['How to read this Report'])
  howHead.font = { bold: true, size: 12, color: { argb: 'FF0F172A' } }
  const notes = [
    '1. This report covers only tasks that are still open — Overdue or Ongoing. Completed and closed tasks are not shown.',
    '2. Days Late — the Position As On Date minus the Due Date. The As On Date is the current date the report is taken on.',
    '3. Not Yet Due — the due date has not come yet, so the task is not late. It is kept in a separate column so nobody is blamed wrongly, and is left out of the oldest / average figures.',
    '4. The six Late columns show the shape of the pile. Work in the last two columns has genuinely been left aside and needs a different conversation from work only a few days late.',
    '5. More than a Month Late — the last three Late columns added together (everything above 30 days). This is the column to look at first in a review meeting.',
    '6. Oldest Late Task (Days) — the age of the single oldest task lying with that person or task. An average can look fine while one very old task hides in the pile, so both are shown.',
    '7. Average Days Late — the average age of the late work. Not Yet Due tasks are kept out of this average.',
  ]
  notes.forEach((n) => {
    const r = ls.addRow([n])
    ls.mergeCells(r.number, 1, r.number, 10)
    r.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    r.height = 28
    r.font = { color: { argb: 'FF334155' } }
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

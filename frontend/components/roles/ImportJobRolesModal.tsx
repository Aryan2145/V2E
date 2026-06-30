'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { createRole } from '@/lib/api/roles'
import { useToast } from '@/components/ui/Toast'
import type { Department, RoleLevel } from '@/lib/types'

interface Props {
  orgId: string
  departments: Department[]
  onClose: () => void
  onImported: () => void
}

interface ImportRow {
  title: string
  department: string
  level: string
  job_description: string
}

interface RowResult {
  row: number
  title: string
  status: 'created' | 'failed'
  error?: string
}

const COLUMNS = ['title', 'department', 'level', 'job_description'] as const
type Column = (typeof COLUMNS)[number]

const HEADER_LABEL: Record<Column, string> = {
  title: 'title *',
  department: 'department *',
  level: 'level',
  job_description: 'job_description',
}

const COLUMN_ALIASES: Record<string, Column> = {
  title: 'title',
  role: 'title',
  job_role: 'title',
  name: 'title',
  department: 'department',
  dept: 'department',
  level: 'level',
  seniority: 'level',
  job_description: 'job_description',
  description: 'job_description',
  jd: 'job_description',
}

const LEVELS: RoleLevel[] = ['head', 'senior', 'mid', 'junior']

function normalizeHeader(h: string): string {
  return h
    .replace(/\*/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((v) => v && v.trim() !== '')))
}

const norm = (s: string) => s.trim().toLowerCase()

// ─── CSV parser (RFC-4180-ish; handles quotes, escaped quotes, CRLF) ────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export default function ImportJobRolesModal({ orgId, departments, onClose, onImported }: Props) {
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState<{ created: number; failed: number; results: RowResult[] } | null>(
    null,
  )

  // ─── Template (.xlsx with dropdowns) ──────────────────────────────────────────
  async function downloadTemplate() {
    setBuilding(true)
    try {
      const mod: any = await import('exceljs')
      const ExcelJS = mod.default ?? mod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Job Roles')
      const lists = wb.addWorksheet('Lists')
      lists.state = 'veryHidden'

      const deptNames = uniq(departments.map((d) => d.name))
      deptNames.forEach((v, i) => (lists.getCell(i + 1, 1).value = v)) // col A
      LEVELS.forEach((v, i) => (lists.getCell(i + 1, 2).value = v)) // col B

      ws.addRow(COLUMNS.map((c) => HEADER_LABEL[c]))
      const headerRow = ws.getRow(1)
      headerRow.height = 22
      headerRow.eachCell((cell: any, col: number) => {
        const key = COLUMNS[col - 1]
        const required = key === 'title' || key === 'department'
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: required ? 'FF2563EB' : 'FF475569' },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      })
      ws.columns.forEach((c: any) => (c.width = 28))

      const sampleDept = departments[0]?.name ?? 'Engineering'
      ws.addRow(['Senior Engineer', sampleDept, 'senior', 'Owns delivery of core services'])
      ws.addRow(['Engineer', sampleDept, 'mid', ''])

      const LAST = 300
      const addListDV = (col: number, formula: string) => {
        const letter = String.fromCharCode(64 + col)
        for (let r = 2; r <= LAST; r++) {
          ws.getCell(`${letter}${r}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [formula],
            showErrorMessage: true,
            errorStyle: 'warning',
            errorTitle: 'Pick from the list',
            error: 'Choose a value from the dropdown, or clear the cell.',
          }
        }
      }
      addListDV(2, `Lists!$A$1:$A$${Math.max(deptNames.length, 1)}`) // department
      addListDV(3, `Lists!$B$1:$B$${LEVELS.length}`) // level

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'job-role-import-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast('Could not build the template. Please try again.', 'error')
    } finally {
      setBuilding(false)
    }
  }

  // ─── Parsing ──────────────────────────────────────────────────────────────────
  function gridToRows(grid: string[][]): { rows: ImportRow[]; error?: string } {
    if (grid.length === 0) return { rows: [], error: 'The file is empty.' }
    const header = grid[0].map(normalizeHeader)
    const idx: Partial<Record<Column, number>> = {}
    header.forEach((h, i) => {
      const col = COLUMN_ALIASES[h]
      if (col && idx[col] === undefined) idx[col] = i
    })
    if (idx.title === undefined || idx.department === undefined) {
      return {
        rows: [],
        error:
          'Could not find the required "title" and "department" columns. Download the template to see the expected format.',
      }
    }
    const parsed: ImportRow[] = []
    for (let r = 1; r < grid.length; r++) {
      const cells = grid[r]
      if (!cells || cells.every((c) => (c ?? '').trim() === '')) continue
      const get = (c: Column) => {
        const i = idx[c]
        return i !== undefined ? (cells[i] ?? '').trim() : ''
      }
      parsed.push({
        title: get('title'),
        department: get('department'),
        level: get('level'),
        job_description: get('job_description'),
      })
    }
    if (parsed.length === 0) return { rows: [], error: 'No data rows found below the header.' }
    return { rows: parsed }
  }

  async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
    const mod: any = await import('exceljs')
    const ExcelJS = mod.default ?? mod
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const ws = wb.worksheets[0]
    if (!ws) return []
    const cellText = (cell: any): string => {
      const v = cell?.value
      if (v == null) return ''
      if (typeof v === 'object') {
        if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('')
        if (typeof v.text === 'string') return v.text
        if ('result' in v) return v.result == null ? '' : String(v.result)
        return ''
      }
      return String(v)
    }
    const colCount = Math.max(ws.getRow(1).cellCount, COLUMNS.length)
    const grid: string[][] = []
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const cells: string[] = []
      for (let c = 1; c <= colCount; c++) cells.push(cellText(row.getCell(c)))
      grid.push(cells)
    }
    return grid
  }

  function handleFile(file: File) {
    setParseError('')
    setResult(null)
    setRows([])
    setFileName(file.name)
    const finish = (grid: string[][]) => {
      const { rows: parsed, error } = gridToRows(grid)
      if (error) {
        setParseError(error)
        return
      }
      setRows(parsed)
    }
    if (/\.xlsx$/i.test(file.name)) {
      file
        .arrayBuffer()
        .then(parseXlsx)
        .then(finish)
        .catch(() => setParseError('Could not read this Excel file. Make sure it is a valid .xlsx.'))
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          finish(parseCsv(String(reader.result ?? '')))
        } catch {
          setParseError('Could not read this file. Make sure it is a valid CSV.')
        }
      }
      reader.onerror = () => setParseError('Could not read this file.')
      reader.readAsText(file)
    }
  }

  // ─── Import ─────────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true)

    const deptByName = new Map(departments.map((d) => [norm(d.name), d.id]))
    const results: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const line = i + 2 // header is line 1
      if (!row.title) {
        results.push({ row: line, title: '(blank)', status: 'failed', error: 'Title is required.' })
        continue
      }
      const departmentId = deptByName.get(norm(row.department))
      if (!departmentId) {
        results.push({
          row: line,
          title: row.title,
          status: 'failed',
          error: row.department
            ? `Department "${row.department}" was not found.`
            : 'Department is required.',
        })
        continue
      }
      const lvl = norm(row.level)
      let level: RoleLevel
      if (!lvl) level = 'mid'
      else if ((LEVELS as string[]).includes(lvl)) level = lvl as RoleLevel
      else {
        results.push({
          row: line,
          title: row.title,
          status: 'failed',
          error: `Invalid level "${row.level}". Use one of: ${LEVELS.join(', ')}.`,
        })
        continue
      }
      try {
        await createRole(orgId, {
          department_id: departmentId,
          title: row.title,
          level,
          job_description: row.job_description || undefined,
        })
        results.push({ row: line, title: row.title, status: 'created' })
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? 'Could not create this job role.'
        results.push({
          row: line,
          title: row.title,
          status: 'failed',
          error: Array.isArray(msg) ? msg.join(', ') : msg,
        })
      }
    }

    const created = results.filter((r) => r.status === 'created').length
    const failed = results.length - created
    setResult({ created, failed, results })
    if (created > 0) {
      addToast(
        `Imported ${created} job role${created !== 1 ? 's' : ''}`,
        failed > 0 ? 'warning' : 'success',
      )
      onImported()
    } else {
      addToast('No job roles were imported', 'error')
    }
    setImporting(false)
  }

  function reset() {
    setRows([])
    setResult(null)
    setParseError('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const failedRows = result?.results.filter((r) => r.status === 'failed') ?? []

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-[12px] rounded-t-[16px] shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Import Job Roles</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[#DCFCE7] border border-[#BBF7D0]">
                  <CheckCircle2 size={16} className="text-[#16A34A]" />
                  <span className="text-sm font-semibold text-[#166534]">{result.created} imported</span>
                </div>
                {result.failed > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[#FEE2E2] border border-[#FECACA]">
                    <AlertCircle size={16} className="text-[#DC2626]" />
                    <span className="text-sm font-semibold text-[#991B1B]">{result.failed} failed</span>
                  </div>
                )}
              </div>

              {failedRows.length > 0 && (
                <div className="border border-[#E2E8F0] rounded-[10px] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                      Rows that need fixing
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#F1F5F9]">
                    {failedRows.map((r) => (
                      <div key={r.row} className="px-4 py-2.5">
                        <p className="text-sm font-medium text-[#0F172A]">
                          Row {r.row}
                          {r.title ? ` · ${r.title}` : ''}
                        </p>
                        <p className="text-sm text-[#DC2626] mt-0.5">{r.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[13px] text-[#475569]">
                KRAs and KPIs aren&apos;t part of the import — open a job role and use{' '}
                <span className="font-semibold text-[#0F172A]">Edit</span> to add them.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="px-5 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                >
                  Import another file
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1 — template */}
              <div className="flex items-start gap-3 p-4 rounded-[10px] bg-[#EFF6FF] border border-[#BFDBFE]">
                <FileText size={18} className="text-[#2563EB] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    Step 1 — Download the Excel template
                  </p>
                  <p className="text-[13px] text-[#475569] mt-0.5">
                    Required columns (<span className="font-semibold text-[#2563EB]">blue header, marked&nbsp;*</span>):
                    title and department. The <strong>department</strong> and <strong>level</strong>{' '}
                    columns are <strong>dropdowns</strong>. Level defaults to{' '}
                    <strong>mid</strong> when left blank.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    disabled={building}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
                  >
                    {building ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    {building ? 'Building…' : 'Download Excel template'}
                  </button>
                </div>
              </div>

              {/* Step 2 — upload */}
              <div>
                <p className="text-sm font-semibold text-[#0F172A] mb-2">
                  Step 2 — Upload the filled file
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-[10px] border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#F8FAFC] transition-colors"
                >
                  <UploadCloud size={26} className="text-[#94A3B8]" />
                  <span className="text-sm font-medium text-[#475569]">
                    {fileName || 'Click to choose an .xlsx or .csv file'}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFile(f)
                  }}
                />
              </div>

              {parseError && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-[8px] text-sm text-[#DC2626]">
                  {parseError}
                </div>
              )}

              {rows.length > 0 && !parseError && (
                <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-[8px] text-sm text-[#166534]">
                  Ready to import <span className="font-semibold">{rows.length}</span> job role
                  {rows.length !== 1 ? 's' : ''} from{' '}
                  <span className="font-semibold">{fileName}</span>.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              {importing ? 'Importing…' : `Import${rows.length > 0 ? ` ${rows.length}` : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

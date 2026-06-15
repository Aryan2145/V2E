'use client'

import { useRef, useState } from 'react'
import {
  X,
  Download,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  bulkImportEmployees,
  type BulkImportRow,
  type BulkImportResult,
} from '@/lib/api/employees'
import { useToast } from '@/components/ui/Toast'
import type { Department, Role, EmployeeProfile } from '@/lib/types'

interface Props {
  orgId: string
  departments: Department[]
  roles: Role[]
  employees: EmployeeProfile[]
  onClose: () => void
  onImported: () => void
}

// Machine column keys, in template order.
const COLUMNS = [
  'name',
  'email',
  'password',
  'department',
  'role',
  'employment_type',
  'employee_code',
  'reporting_to',
  'date_of_joining',
  'date_of_birth',
  'marriage_date',
] as const

type Column = (typeof COLUMNS)[number]

const REQUIRED: Column[] = ['name', 'email', 'department', 'role']

// Human-friendly header text written to the template (required marked with *).
const HEADER_LABEL: Record<Column, string> = {
  name: 'name *',
  email: 'email *',
  password: 'password',
  department: 'department *',
  role: 'role *',
  employment_type: 'employment_type',
  employee_code: 'employee_code',
  reporting_to: 'reporting_to (manager name)',
  date_of_joining: 'date_of_joining',
  date_of_birth: 'date_of_birth',
  marriage_date: 'marriage_date',
}

// Map a (normalized) header cell to a column key, tolerating extra markers/aliases.
const COLUMN_ALIASES: Record<string, Column> = {
  name: 'name',
  full_name: 'name',
  email: 'email',
  password: 'password',
  department: 'department',
  dept: 'department',
  role: 'role',
  employment_type: 'employment_type',
  employee_code: 'employee_code',
  code: 'employee_code',
  reporting_to: 'reporting_to',
  reporting_to_manager_name: 'reporting_to',
  reports_to: 'reporting_to',
  manager: 'reporting_to',
  reporting_to_email: 'reporting_to',
  date_of_joining: 'date_of_joining',
  date_of_birth: 'date_of_birth',
  marriage_date: 'marriage_date',
}

function normalizeHeader(h: string): string {
  return h
    .replace(/\*/g, '')
    .replace(/\(.*?\)/g, '') // strip parenthetical notes like "(manager name)"
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

function toYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((v) => v && v.trim() !== '')))
}

// ─── CSV helpers (fallback when a .csv is uploaded) ─────────────────────────────

function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

/** Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes, CRLF. */
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

export default function ImportEmployeesModal({
  orgId,
  departments,
  roles,
  employees,
  onClose,
  onImported,
}: Props) {
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<BulkImportRow[]>([])
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [building, setBuilding] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)

  // ─── Template (.xlsx with dropdowns) ──────────────────────────────────────────
  async function downloadTemplate() {
    setBuilding(true)
    try {
      const mod: any = await import('exceljs')
      const ExcelJS = mod.default ?? mod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Employees')
      const lists = wb.addWorksheet('Lists')
      lists.state = 'veryHidden' // dropdown sources, hidden from the user

      // Option sources.
      const deptNames = uniq(departments.map((d) => d.name))
      const roleTitles = uniq(roles.map((r) => r.title))
      const people = uniq(employees.map((e) => e.user?.name ?? ''))
      deptNames.forEach((v, i) => (lists.getCell(i + 1, 1).value = v)) // col A
      roleTitles.forEach((v, i) => (lists.getCell(i + 1, 2).value = v)) // col B
      people.forEach((v, i) => (lists.getCell(i + 1, 4).value = v)) // col D

      // Header row.
      ws.addRow(COLUMNS.map((c) => HEADER_LABEL[c]))
      const headerRow = ws.getRow(1)
      headerRow.height = 22
      headerRow.eachCell((cell: any, col: number) => {
        const key = COLUMNS[col - 1]
        const required = REQUIRED.includes(key)
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: required ? 'FF2563EB' : 'FF475569' }, // blue = required, slate = optional
        }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      })
      ws.columns.forEach((c: any) => (c.width = 22))

      // Two example rows so the format is obvious (use real values where possible).
      const sampleDept = departments[0]
      const sampleRole = sampleDept
        ? roles.find((r) => r.department_id === sampleDept.id)
        : undefined
      const deptName = sampleDept?.name ?? 'Engineering'
      const roleName = sampleRole?.title ?? 'Software Engineer'
      const sampleManager = employees[0]?.user?.name ?? ''
      ws.addRow([
        'Jane Doe',
        'jane.doe@company.com',
        '',
        deptName,
        roleName,
        'full_time',
        'EMP-001',
        '',
        '2024-01-15',
        '1995-06-20',
        '',
      ])
      ws.addRow([
        'John Smith',
        'john.smith@company.com',
        '',
        deptName,
        roleName,
        'part_time',
        'EMP-002',
        sampleManager,
        '2024-03-01',
        '1990-11-02',
        '2019-12-10',
      ])

      // Dropdowns (data validation) for rows 2..LAST.
      const LAST = 300
      const colLetter: Record<Column, string> = {
        name: 'A',
        email: 'B',
        password: 'C',
        department: 'D',
        role: 'E',
        employment_type: 'F',
        employee_code: 'G',
        reporting_to: 'H',
        date_of_joining: 'I',
        date_of_birth: 'J',
        marriage_date: 'K',
      }
      const addListDV = (col: Column, formula: string) => {
        for (let r = 2; r <= LAST; r++) {
          ws.getCell(`${colLetter[col]}${r}`).dataValidation = {
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
      addListDV('department', `Lists!$A$1:$A$${Math.max(deptNames.length, 1)}`)
      addListDV('role', `Lists!$B$1:$B$${Math.max(roleTitles.length, 1)}`)
      addListDV('employment_type', '"full_time,part_time,contract"')
      addListDV('reporting_to', `Lists!$D$1:$D$${Math.max(people.length, 1)}`)

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'employee-import-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast('Could not build the template. Please try again.', 'error')
    } finally {
      setBuilding(false)
    }
  }

  // ─── Parsing ──────────────────────────────────────────────────────────────────

  /** Turn a raw header+data grid into validated import rows. */
  function gridToRows(grid: string[][]): { rows: BulkImportRow[]; error?: string } {
    if (grid.length === 0) return { rows: [], error: 'The file is empty.' }
    const header = grid[0].map(normalizeHeader)
    const idx: Partial<Record<Column, number>> = {}
    header.forEach((h, i) => {
      const col = COLUMN_ALIASES[h]
      if (col && idx[col] === undefined) idx[col] = i
    })
    if (idx.name === undefined || idx.email === undefined) {
      return {
        rows: [],
        error:
          'Could not find the required "name" and "email" columns. Download the template to see the expected format.',
      }
    }

    const parsed: BulkImportRow[] = []
    for (let r = 1; r < grid.length; r++) {
      const cells = grid[r]
      if (!cells || cells.every((c) => (c ?? '').trim() === '')) continue
      const get = (c: Column) => {
        const i = idx[c]
        return i !== undefined ? (cells[i] ?? '').trim() : ''
      }
      parsed.push({
        name: get('name'),
        email: get('email'),
        password: get('password'),
        department: get('department'),
        role: get('role'),
        employment_type: get('employment_type'),
        employee_code: get('employee_code'),
        reporting_to: get('reporting_to'),
        date_of_joining: get('date_of_joining'),
        date_of_birth: get('date_of_birth'),
        marriage_date: get('marriage_date'),
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
      if (v instanceof Date) return toYmd(v)
      if (typeof v === 'object') {
        if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('')
        if (typeof v.text === 'string') return v.text
        if ('result' in v) return v.result == null ? '' : String(v.result)
        return ''
      }
      return String(v)
    }

    const headerRow = ws.getRow(1)
    const colCount = Math.max(headerRow.cellCount, COLUMNS.length)
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

  async function handleImport() {
    if (rows.length === 0) return
    setImporting(true)
    try {
      const res = await bulkImportEmployees(orgId, rows)
      setResult(res)
      if (res.created > 0) {
        addToast(
          `Imported ${res.created} employee${res.created !== 1 ? 's' : ''}`,
          res.failed > 0 ? 'warning' : 'success',
        )
        onImported()
      } else {
        addToast('No employees were imported', 'error')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Import failed. Please try again.'
      setParseError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setRows([])
    setResult(null)
    setParseError('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const failedRows = result?.results.filter((r) => r.status === 'failed') ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-[12px] rounded-t-[16px] shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Import Employees</h2>
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
                  <span className="text-sm font-semibold text-[#166534]">
                    {result.created} imported
                  </span>
                </div>
                {result.failed > 0 && (
                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[#FEE2E2] border border-[#FECACA]">
                    <AlertCircle size={16} className="text-[#DC2626]" />
                    <span className="text-sm font-semibold text-[#991B1B]">
                      {result.failed} failed
                    </span>
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
                          {r.email ? ` · ${r.email}` : r.name ? ` · ${r.name}` : ''}
                        </p>
                        <p className="text-sm text-[#DC2626] mt-0.5">{r.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[13px] text-[#475569]">
                New accounts use the password from the sheet, or{' '}
                <span className="font-semibold text-[#0F172A]">Welcome@123</span> when the
                password column is left blank. Ask staff to change it after first sign-in.
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
                    name, email, department, role. The{' '}
                    <strong>department</strong>, <strong>role</strong>,{' '}
                    <strong>employment&nbsp;type</strong> and <strong>manager</strong> columns are
                    <strong> dropdowns</strong> filled from your org. Leave password blank to default
                    to <strong>Welcome@123</strong>.
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
                  Ready to import <span className="font-semibold">{rows.length}</span> employee
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
    </div>
  )
}

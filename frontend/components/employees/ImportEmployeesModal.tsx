'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Download,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  History,
  Undo2,
  ShieldAlert,
} from 'lucide-react'
import {
  validateImport,
  commitImport,
  listImportBatches,
  undoImport,
  type BulkImportRow,
  type ImportValidationResult,
  type ImportValidationRow,
  type BulkImportResult,
  type ImportBatchSummary,
  type UndoImportResult,
} from '@/lib/api/employees'
import { listSystemRoles, type SystemRoleLite } from '@/lib/api/permissions'
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

/** Glue for combined dropdown values, e.g. "Backend Engineer · Backend". Must match the backend. */
const VALUE_SEPARATOR = ' · '

// Machine column keys, in template order.
const COLUMNS = [
  'name',
  'email',
  'password',
  'department',
  'is_department_head',
  'role',
  'system_role',
  'employment_type',
  'employee_code',
  'reporting_to',
  'date_of_joining',
  'date_of_birth',
  'marriage_date',
] as const

type Column = (typeof COLUMNS)[number]

const REQUIRED: Column[] = ['name', 'email', 'department', 'role', 'system_role']

const HEADER_LABEL: Record<Column, string> = {
  name: 'name *',
  email: 'email *',
  password: 'password',
  department: 'department *',
  is_department_head: 'is_department_head',
  role: 'role *',
  system_role: 'system_role *',
  employment_type: 'employment_type',
  employee_code: 'employee_code',
  reporting_to: 'reporting_to',
  date_of_joining: 'date_of_joining',
  date_of_birth: 'date_of_birth',
  marriage_date: 'marriage_date',
}

const COLUMN_ALIASES: Record<string, Column> = {
  name: 'name',
  full_name: 'name',
  email: 'email',
  password: 'password',
  department: 'department',
  dept: 'department',
  is_department_head: 'is_department_head',
  is_head: 'is_department_head',
  head_of_department: 'is_department_head',
  dept_head: 'is_department_head',
  department_head: 'is_department_head',
  role: 'role',
  job_role: 'role',
  system_role: 'system_role',
  access_role: 'system_role',
  employment_type: 'employment_type',
  employee_code: 'employee_code',
  code: 'employee_code',
  reporting_to: 'reporting_to',
  reports_to: 'reporting_to',
  manager: 'reporting_to',
  date_of_joining: 'date_of_joining',
  date_of_birth: 'date_of_birth',
  marriage_date: 'marriage_date',
}

function normalizeHeader(h: string): string {
  return h
    .replace(/\*/g, '')
    .replace(/\(.*?\)/g, '')
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

const STATUS_STYLES: Record<ImportValidationRow['status'], { dot: string; text: string; label: string }> = {
  ready: { dot: 'bg-[#16A34A]', text: 'text-[#166534]', label: 'Ready' },
  duplicate: { dot: 'bg-[#DC2626]', text: 'text-[#991B1B]', label: 'Duplicate' },
  error: { dot: 'bg-[#DC2626]', text: 'text-[#991B1B]', label: 'Error' },
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

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const [systemRoles, setSystemRoles] = useState<SystemRoleLite[]>([])
  useEffect(() => {
    listSystemRoles(orgId)
      .then(({ systemRoles }) => setSystemRoles(systemRoles))
      .catch(() => setSystemRoles([]))
  }, [orgId])

  type Phase = 'upload' | 'preview' | 'result' | 'history'
  const [phase, setPhase] = useState<Phase>('upload')
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<BulkImportRow[]>([])
  const [validation, setValidation] = useState<ImportValidationResult | null>(null)
  const [commitResult, setCommitResult] = useState<BulkImportResult | null>(null)
  const [parseError, setParseError] = useState('')
  const [building, setBuilding] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [onlyProblems, setOnlyProblems] = useState(false)

  const [batches, setBatches] = useState<ImportBatchSummary[]>([])
  const [undoResult, setUndoResult] = useState<UndoImportResult | null>(null)
  const [undoingId, setUndoingId] = useState<string | null>(null)

  const deptNameById = useMemo(
    () => new Map(departments.map((d) => [d.id, d.name])),
    [departments],
  )

  // ─── Template (.xlsx with 4 reference sheets + dropdowns) ─────────────────────
  async function downloadTemplate() {
    setBuilding(true)
    try {
      const mod: any = await import('exceljs')
      const ExcelJS = mod.default ?? mod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Employees')
      const wsDept = wb.addWorksheet('Departments')
      const wsRole = wb.addWorksheet('Roles')
      const wsMgr = wb.addWorksheet('Reports To')
      const wsSys = wb.addWorksheet('System Roles')

      const refHeader = (sheet: any, headers: string[]) => {
        sheet.addRow(headers)
        const hr = sheet.getRow(1)
        hr.height = 20
        hr.eachCell((cell: any) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
        })
      }

      // Departments — Sr. No. | Department | Parent Department (sorted by name).
      refHeader(wsDept, ['Sr. No.', 'Department', 'Parent Department'])
      const deptSorted = [...departments].sort((a, b) => a.name.localeCompare(b.name))
      deptSorted.forEach((d, i) =>
        wsDept.addRow([i + 1, d.name, d.parent_department_id ? deptNameById.get(d.parent_department_id) ?? '' : '']),
      )
      wsDept.columns.forEach((c: any, i: number) => (c.width = i === 0 ? 8 : 28))

      // Roles — Sr. No. | Role | Department | Value (sorted by dept, then role).
      refHeader(wsRole, ['Sr. No.', 'Role', 'Department', 'Value (pick this in Employees)'])
      const roleRows = [...roles]
        .map((r) => ({ title: r.title, dept: deptNameById.get(r.department_id) ?? '' }))
        .sort((a, b) => a.dept.localeCompare(b.dept) || a.title.localeCompare(b.title))
      roleRows.forEach((r, i) =>
        wsRole.addRow([i + 1, r.title, r.dept, `${r.title}${VALUE_SEPARATOR}${r.dept}`]),
      )
      wsRole.columns.forEach((c: any, i: number) => (c.width = i === 0 ? 8 : i === 3 ? 36 : 26))

      // Reports To — Sr. No. | Name | Department | Role | Value (sorted by dept, then name).
      refHeader(wsMgr, ['Sr. No.', 'Name', 'Department', 'Role', 'Value (pick this in Employees)'])
      const mgrRows = employees
        .map((e) => ({
          name: e.user?.name ?? '',
          dept: deptNameById.get(e.department_id) ?? '',
          role: e.role?.title ?? '',
        }))
        .filter((m) => m.name)
        .sort((a, b) => a.dept.localeCompare(b.dept) || a.name.localeCompare(b.name))
      mgrRows.forEach((m, i) =>
        wsMgr.addRow([
          i + 1,
          m.name,
          m.dept,
          m.role,
          `${m.name}${VALUE_SEPARATOR}${m.dept}${VALUE_SEPARATOR}${m.role}`,
        ]),
      )
      wsMgr.columns.forEach((c: any, i: number) => (c.width = i === 0 ? 8 : i === 4 ? 40 : 24))

      // System Roles — Sr. No. | System Role. Preserve the API order
      // (Employee, Manager, Leadership, …, Administrator) rather than re-sorting.
      refHeader(wsSys, ['Sr. No.', 'System Role'])
      systemRoles.forEach((s, i) => wsSys.addRow([i + 1, s.name]))
      wsSys.columns.forEach((c: any, i: number) => (c.width = i === 0 ? 8 : 30))

      // Main sheet header.
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
          fgColor: { argb: required ? 'FF2563EB' : 'FF475569' },
        }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      })
      ws.columns.forEach((c: any) => (c.width = 22))

      // Example rows.
      const sampleDept = deptSorted[0]
      const sampleRole = roleRows[0]
      const deptName = sampleDept?.name ?? 'Engineering'
      const roleValue = sampleRole ? `${sampleRole.title}${VALUE_SEPARATOR}${sampleRole.dept}` : 'Software Engineer · Engineering'
      const sysName = systemRoles[0]?.name ?? 'Member'
      const mgrValue = mgrRows[0]
        ? `${mgrRows[0].name}${VALUE_SEPARATOR}${mgrRows[0].dept}${VALUE_SEPARATOR}${mgrRows[0].role}`
        : ''
      ws.addRow(['Jane Doe', 'jane.doe@company.com', '', deptName, 'Yes', roleValue, sysName, 'full_time', 'EMP-001', '', '2024-01-15', '1995-06-20', ''])
      ws.addRow(['John Smith', 'john.smith@company.com', '', deptName, 'No', roleValue, sysName, 'part_time', 'EMP-002', mgrValue, '2024-03-01', '1990-11-02', '2019-12-10'])

      // Dropdowns + date constraints for rows 2..LAST.
      const LAST = 500
      const colLetter: Record<Column, string> = {
        name: 'A',
        email: 'B',
        password: 'C',
        department: 'D',
        is_department_head: 'E',
        role: 'F',
        system_role: 'G',
        employment_type: 'H',
        employee_code: 'I',
        reporting_to: 'J',
        date_of_joining: 'K',
        date_of_birth: 'L',
        marriage_date: 'M',
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
      const addDateDV = (col: Column) => {
        for (let r = 2; r <= LAST; r++) {
          ws.getCell(`${colLetter[col]}${r}`).numFmt = 'yyyy-mm-dd'
          ws.getCell(`${colLetter[col]}${r}`).dataValidation = {
            type: 'date',
            operator: 'lessThanOrEqual',
            allowBlank: true,
            formulae: ['=TODAY()'],
            showErrorMessage: true,
            errorStyle: 'warning',
            errorTitle: 'Check the date',
            error: 'Enter a real date that is not in the future (YYYY-MM-DD).',
          }
        }
      }
      addListDV('department', `'Departments'!$B$2:$B$${deptSorted.length + 1}`)
      // Department Head is a Yes/No choice; No is the default (listed first, and
      // a blank cell is treated as No by the importer).
      addListDV('is_department_head', '"No,Yes"')
      addListDV('role', `'Roles'!$D$2:$D$${roleRows.length + 1}`)
      addListDV('system_role', `'System Roles'!$B$2:$B$${systemRoles.length + 1}`)
      addListDV('reporting_to', `'Reports To'!$E$2:$E$${mgrRows.length + 1}`)
      addListDV('employment_type', '"full_time,part_time,contract"')
      addDateDV('date_of_joining')
      addDateDV('date_of_birth')
      addDateDV('marriage_date')

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
        is_department_head: get('is_department_head'),
        role: get('role'),
        system_role: get('system_role'),
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
    const ws = wb.getWorksheet('Employees') ?? wb.worksheets[0]
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

  async function runValidation(rows: BulkImportRow[]) {
    setValidating(true)
    try {
      const res = await validateImport(orgId, rows)
      setValidation(res)
      setPhase('preview')
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not validate the file. Please try again.'
      setParseError(Array.isArray(msg) ? msg.join(', ') : msg)
    } finally {
      setValidating(false)
    }
  }

  function handleFile(file: File) {
    setParseError('')
    setValidation(null)
    setCommitResult(null)
    setParsedRows([])
    setFileName(file.name)

    const finish = (grid: string[][]) => {
      const { rows: parsed, error } = gridToRows(grid)
      if (error) {
        setParseError(error)
        return
      }
      setParsedRows(parsed)
      runValidation(parsed)
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

  // ─── Failed-rows export ───────────────────────────────────────────────────────

  async function downloadFailures() {
    if (!validation) return
    const failedRows = validation.rows.filter((r) => r.status !== 'ready')
    if (failedRows.length === 0) return
    try {
      const mod: any = await import('exceljs')
      const ExcelJS = mod.default ?? mod
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Fix these')
      ws.addRow([...COLUMNS.map((c) => HEADER_LABEL[c]), 'reason_for_failure'])
      const hr = ws.getRow(1)
      hr.eachCell((cell: any, col: number) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: col === COLUMNS.length + 1 ? 'FFDC2626' : 'FF475569' },
        }
      })
      for (const vr of failedRows) {
        const orig = parsedRows[vr.row - 2] ?? {}
        const reason = vr.issues
          .filter((i) => i.severity === 'error')
          .map((i) => i.message)
          .join('; ')
        ws.addRow([...COLUMNS.map((c) => (orig as any)[c] ?? ''), reason])
      }
      ws.columns.forEach((c: any) => (c.width = 22))
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'employee-import-failures.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast('Could not build the failures file.', 'error')
    }
  }

  // ─── Commit ───────────────────────────────────────────────────────────────────

  async function handleImport() {
    setConfirmOpen(false)
    setImporting(true)
    try {
      const res = await commitImport(orgId, parsedRows, fileName)
      setCommitResult(res)
      setPhase('result')
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

  // ─── History + undo ───────────────────────────────────────────────────────────

  async function openHistory() {
    setPhase('history')
    setUndoResult(null)
    try {
      setBatches(await listImportBatches(orgId))
    } catch {
      setBatches([])
    }
  }

  async function handleUndo(batchId: string) {
    setUndoingId(batchId)
    try {
      const res = await undoImport(orgId, batchId)
      setUndoResult(res)
      addToast(
        res.undone > 0 ? `Removed ${res.undone} imported employee${res.undone !== 1 ? 's' : ''}` : 'Nothing was removed',
        res.kept.length > 0 ? 'warning' : 'success',
      )
      onImported()
      setBatches(await listImportBatches(orgId))
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Undo failed.'
      addToast(Array.isArray(msg) ? msg.join(', ') : msg, 'error')
    } finally {
      setUndoingId(null)
    }
  }

  function resetToUpload() {
    setPhase('upload')
    setParsedRows([])
    setValidation(null)
    setCommitResult(null)
    setParseError('')
    setFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const visibleRows = useMemo(() => {
    if (!validation) return []
    return onlyProblems ? validation.rows.filter((r) => r.status !== 'ready' || r.issues.length > 0) : validation.rows
  }, [validation, onlyProblems])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-[12px] rounded-t-[16px] shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            {(phase === 'preview' || phase === 'history') && (
              <button
                onClick={phase === 'history' ? resetToUpload : () => setPhase('upload')}
                className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-[18px] font-semibold text-[#0F172A]">
              {phase === 'preview' ? 'Review before importing' : phase === 'history' ? 'Import history' : 'Import Employees'}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {phase === 'upload' && (
              <button
                onClick={openHistory}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[13px] font-medium text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
              >
                <History size={15} /> History
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* ── Upload ── */}
          {phase === 'upload' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-[10px] bg-[#EFF6FF] border border-[#BFDBFE]">
                <FileText size={18} className="text-[#2563EB] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">Step 1 — Download the Excel template</p>
                  <p className="text-[13px] text-[#475569] mt-0.5">
                    Required columns (<span className="font-semibold text-[#2563EB]">blue header, marked *</span>): name,
                    email, department, role, system_role. The <strong>department</strong>, <strong>role</strong>,{' '}
                    <strong>system role</strong>, <strong>manager</strong> and <strong>employment type</strong> columns
                    are <strong>dropdowns</strong> sourced from the reference sheets. Dates use a date picker and can’t be
                    in the future. Leave password blank to default to <strong>Welcome@123</strong>.
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

              <div>
                <p className="text-sm font-semibold text-[#0F172A] mb-2">Step 2 — Upload the filled file to review</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-[10px] border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#F8FAFC] transition-colors"
                >
                  {validating ? (
                    <Loader2 size={26} className="text-[#2563EB] animate-spin" />
                  ) : (
                    <UploadCloud size={26} className="text-[#94A3B8]" />
                  )}
                  <span className="text-sm font-medium text-[#475569]">
                    {validating ? 'Checking your file…' : fileName || 'Click to choose an .xlsx or .csv file'}
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
            </>
          )}

          {/* ── Preview ── */}
          {phase === 'preview' && validation && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <SummaryChip color="green" label={`${validation.ready} ready`} />
                {validation.duplicates > 0 && <SummaryChip color="red" label={`${validation.duplicates} duplicate`} />}
                {validation.errors > 0 && <SummaryChip color="red" label={`${validation.errors} error`} />}
                {validation.warnings > 0 && <SummaryChip color="amber" label={`${validation.warnings} warning`} />}
                <span className="ml-auto text-xs text-[#64748B]">from {fileName}</span>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-[13px] text-[#475569] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyProblems}
                    onChange={(e) => setOnlyProblems(e.target.checked)}
                    className="rounded border-[#CBD5E1]"
                  />
                  Show only rows with problems
                </label>
                {validation.rows.some((r) => r.status !== 'ready') && (
                  <button
                    onClick={downloadFailures}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2563EB] hover:underline"
                  >
                    <Download size={14} /> Download failures to fix
                  </button>
                )}
              </div>

              <div className="border border-[#E2E8F0] rounded-[10px] overflow-hidden">
                <div className="max-h-[46vh] overflow-auto">
                  <table className="w-full text-[13px]">
                    <thead className="bg-[#F8FAFC] sticky top-0">
                      <tr className="text-left text-[#64748B]">
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Name</th>
                        <th className="px-3 py-2 font-semibold">Department</th>
                        <th className="px-3 py-2 font-semibold">Role</th>
                        <th className="px-3 py-2 font-semibold">System role</th>
                        <th className="px-3 py-2 font-semibold">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {visibleRows.map((r, i) => {
                        const s = STATUS_STYLES[r.status]
                        // Zebra striping + a clearly visible divider so two
                        // adjacent rows never blur together; problem rows keep a
                        // solid (not faded) red tint, with red preserved on hover.
                        const rowBg =
                          r.status !== 'ready'
                            ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2]'
                            : `${i % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'} hover:bg-[#EEF2F8]`
                        return (
                          <tr key={r.row} className={`${rowBg} transition-colors`}>
                            <td className="px-3 py-2 text-[#94A3B8]">{r.row}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1.5 font-semibold ${s.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                {s.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-[#0F172A]">{r.name || '—'}</div>
                              <div className="text-[#94A3B8]">{r.email || '—'}</div>
                            </td>
                            <td className="px-3 py-2 text-[#475569]">{r.resolved.department || '—'}</td>
                            <td className="px-3 py-2 text-[#475569]">{r.resolved.role || '—'}</td>
                            <td className="px-3 py-2 text-[#475569]">{r.resolved.system_role || '—'}</td>
                            <td className="px-3 py-2">
                              {r.issues.length === 0 ? (
                                <span className="text-[#94A3B8]">—</span>
                              ) : (
                                <ul className="space-y-0.5">
                                  {r.issues.map((iss, k) => (
                                    <li
                                      key={k}
                                      className={`flex items-start gap-1 ${iss.severity === 'error' ? 'text-[#DC2626]' : 'text-[#B45309]'}`}
                                    >
                                      {iss.severity === 'error' ? (
                                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                                      ) : (
                                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                      )}
                                      <span>{iss.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A]">
                <ShieldAlert size={16} className="text-[#B45309] mt-0.5 shrink-0" />
                <p className="text-[13px] text-[#92400E]">
                  Importing creates live user accounts and is <strong>not automatically reversible</strong> — please check
                  the rows above thoroughly. Only the <strong>{validation.ready} ready</strong> row
                  {validation.ready !== 1 ? 's' : ''} will be imported; the rest are skipped (download them to fix and
                  re-upload). A short-lived undo is available right after import.
                </p>
              </div>
            </>
          )}

          {/* ── Result ── */}
          {phase === 'result' && commitResult && (
            <ResultView
              result={commitResult}
              onUndo={() => commitResult.batch_id && handleUndo(commitResult.batch_id)}
              undoing={undoingId === commitResult.batch_id}
              undoResult={undoResult}
            />
          )}

          {/* ── History ── */}
          {phase === 'history' && (
            <HistoryView
              batches={batches}
              onUndo={handleUndo}
              undoingId={undoingId}
              undoResult={undoResult}
            />
          )}
        </div>

        {/* Footer */}
        {phase === 'preview' && validation && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
            <span className="mr-auto text-[12px] text-[#94A3B8] hidden sm:flex items-center gap-1.5">
              <ShieldAlert size={13} className="text-[#B45309]" /> This action can’t be undone automatically — review first.
            </span>
            <button
              type="button"
              onClick={() => setPhase('upload')}
              className="px-5 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              Choose another file
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={validation.ready === 0 || importing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              {importing ? 'Importing…' : `Import ${validation.ready} ready`}
            </button>
          </div>
        )}

        {phase === 'result' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
            <button
              onClick={resetToUpload}
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
        )}
      </div>

      {/* Confirm popup */}
      {confirmOpen && validation && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-[12px] shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FEF2F2] flex items-center justify-center shrink-0">
                <ShieldAlert size={20} className="text-[#DC2626]" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[#0F172A]">Import {validation.ready} employees?</h3>
                <p className="text-[13px] text-[#475569] mt-1">
                  This creates live accounts and <strong>cannot be undone automatically</strong>. A guarded undo is
                  available for a short window afterward, but it can only remove people who haven’t started accumulating
                  data. Make sure you’ve reviewed the rows.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-[8px] text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
              >
                Go back
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors"
              >
                Yes, import now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────────

function SummaryChip({ color, label }: { color: 'green' | 'red' | 'amber'; label: string }) {
  const styles = {
    green: 'bg-[#DCFCE7] border-[#BBF7D0] text-[#166534]',
    red: 'bg-[#FEE2E2] border-[#FECACA] text-[#991B1B]',
    amber: 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]',
  }[color]
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-[8px] border text-xs font-semibold ${styles}`}>{label}</span>
}

function ResultView({
  result,
  onUndo,
  undoing,
  undoResult,
}: {
  result: BulkImportResult
  onUndo: () => void
  undoing: boolean
  undoResult: UndoImportResult | null
}) {
  const failed = result.results.filter((r) => r.status === 'failed')
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
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
        {result.batch_id && result.created > 0 && !undoResult && (
          <button
            onClick={onUndo}
            disabled={undoing}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm font-semibold text-[#B91C1C] bg-white border border-[#FECACA] hover:bg-[#FEF2F2] disabled:opacity-60 transition-colors"
          >
            {undoing ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Undo this import
          </button>
        )}
      </div>

      {undoResult && <UndoSummary undoResult={undoResult} />}

      {failed.length > 0 && (
        <div className="border border-[#E2E8F0] rounded-[10px] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Rows that need fixing</p>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-[#F1F5F9]">
            {failed.map((r) => (
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
        <span className="font-semibold text-[#0F172A]">Welcome@123</span> when the password column is blank. Ask staff to
        change it after first sign-in.
      </p>
    </div>
  )
}

function UndoSummary({ undoResult }: { undoResult: UndoImportResult }) {
  return (
    <div className="border border-[#E2E8F0] rounded-[10px] p-4 space-y-2">
      <p className="text-sm font-semibold text-[#0F172A]">
        Removed {undoResult.undone} employee{undoResult.undone !== 1 ? 's' : ''}.
      </p>
      {undoResult.kept.length > 0 && (
        <>
          <p className="text-[13px] text-[#B45309]">
            Kept {undoResult.kept.length} — they already had activity and were left untouched:
          </p>
          <ul className="space-y-1">
            {undoResult.kept.map((k) => (
              <li key={k.email} className="text-[13px] text-[#475569]">
                <span className="font-medium text-[#0F172A]">{k.name}</span> — {k.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function HistoryView({
  batches,
  onUndo,
  undoingId,
  undoResult,
}: {
  batches: ImportBatchSummary[]
  onUndo: (batchId: string) => void
  undoingId: string | null
  undoResult: UndoImportResult | null
}) {
  if (batches.length === 0) {
    return <p className="text-sm text-[#94A3B8] py-8 text-center">No imports yet.</p>
  }
  return (
    <div className="space-y-3">
      {undoResult && <UndoSummary undoResult={undoResult} />}
      <div className="border border-[#E2E8F0] rounded-[10px] divide-y divide-[#F1F5F9]">
        {batches.map((b) => (
          <div key={b.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F172A] truncate">
                {b.file_name || 'Untitled import'}
                {b.status !== 'committed' && (
                  <span className="ml-2 text-[11px] font-semibold text-[#94A3B8] uppercase">{b.status.replace('_', ' ')}</span>
                )}
              </p>
              <p className="text-xs text-[#64748B] mt-0.5">
                {new Date(b.created_at).toLocaleString()} · by {b.imported_by} · {b.created_count} created
                {b.failed_count > 0 ? `, ${b.failed_count} failed` : ''} · {b.remaining} still present
              </p>
            </div>
            {b.can_undo ? (
              <button
                onClick={() => onUndo(b.id)}
                disabled={undoingId === b.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[13px] font-semibold text-[#B91C1C] bg-white border border-[#FECACA] hover:bg-[#FEF2F2] disabled:opacity-60 transition-colors shrink-0"
              >
                {undoingId === b.id ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                Undo
              </button>
            ) : (
              <span className="text-[11px] text-[#94A3B8] shrink-0">
                {b.status === 'committed' ? 'Undo window passed' : 'Undone'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

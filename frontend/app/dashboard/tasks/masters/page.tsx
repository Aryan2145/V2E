'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { ticketsApi } from '@/lib/api/tickets'
import type {
  TaskMasterConfig,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  ChecklistTemplate,
} from '@/lib/types/tasks'
import type {
  TicketMasterConfig,
  TicketType,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketTemplate,
  TicketReassignmentMode,
  TicketStatusType,
  TicketTemplateType,
} from '@/lib/types/tickets'
import { Plus, Pencil, Trash2, Save, X, Settings2, Tag, BarChart, Activity, List, Users, Ticket as TicketIcon, CheckSquare } from 'lucide-react'
import apiClient from '@/lib/api/client'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#374151] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white'
const selectCls = 'w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white'

function Spinner() {
  return (
    <div className="h-40 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─── Task Masters Tabs ────────────────────────────────────────────────────────

type TaskMasterTab = 'config' | 'categories' | 'priorities' | 'statuses' | 'checklists' | 'assignee_visibility'

function ConfigTab({ orgId }: { orgId: string }) {
  const [config, setConfig] = useState<TaskMasterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    tasksApi.getConfig(orgId).then(setConfig).catch(() => null).finally(() => setLoading(false))
  }, [orgId])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      const updated = await tasksApi.updateConfig(orgId, config)
      setConfig(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  if (loading) return <Spinner />
  if (!config) return <p className="text-sm text-[#475569]">Could not load configuration.</p>

  return (
    <div className="space-y-6 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Default Reminder Days Before">
          <input type="number" min={0} value={config.default_reminder_days_before}
            onChange={(e) => setConfig({ ...config, default_reminder_days_before: parseInt(e.target.value) || 0 })}
            className={inputCls} />
        </FormField>
        <FormField label="Reopen Window (minutes)">
          <input type="number" min={0} value={config.reopen_window_minutes}
            onChange={(e) => setConfig({ ...config, reopen_window_minutes: parseInt(e.target.value) || 0 })}
            className={inputCls} />
        </FormField>
        <FormField label="Escalation Levels">
          <input type="number" min={0} value={config.escalation_levels}
            onChange={(e) => setConfig({ ...config, escalation_levels: parseInt(e.target.value) || 0 })}
            className={inputCls} />
        </FormField>
      </div>
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors">
        <Save size={15} />
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}
      </button>
    </div>
  )
}

function CategoriesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TaskCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', color: '#2563EB' })
  const [editForm, setEditForm] = useState({ name: '', description: '', color: '#2563EB' })
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(() => {
    setLoading(true)
    tasksApi.getCategories(orgId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const item = await tasksApi.createCategory(orgId, { name: form.name.trim(), description: form.description.trim() || undefined, color: form.color, is_active: true })
      setItems((prev) => [...prev, item])
      setForm({ name: '', description: '', color: '#2563EB' })
      setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleEdit(id: string) {
    if (!editForm.name.trim()) return
    setSubmitting(true)
    try {
      const updated = await tasksApi.updateCategory(orgId, id, { name: editForm.name.trim(), description: editForm.description.trim() || undefined, color: editForm.color })
      setItems((prev) => prev.map((i) => i.id === id ? updated : i))
      setEditingId(null)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    await tasksApi.deleteCategory(orgId, id).catch(() => null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} categor{items.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors">
          <Plus size={14} /> Add Category
        </button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Category name" className={inputCls} /></FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
              </div>
            </FormField>
          </div>
          <FormField label="Description (optional)"><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." className={inputCls} /></FormField>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No categories yet.</div>}
      <div className="space-y-2">
        {items.map((item) => editingId === item.id ? (
          <div key={item.id} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name"><input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={inputCls} /></FormField>
              <FormField label="Color">
                <div className="flex gap-2 items-center">
                  <input type="color" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                  <input type="text" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className={inputCls} />
                </div>
              </FormField>
            </div>
            <FormField label="Description"><input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={inputCls} /></FormField>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(item.id)} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
              {item.description && <p className="text-xs text-[#475569] truncate">{item.description}</p>}
            </div>
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, description: item.description ?? '', color: item.color }) }} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PrioritiesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TaskPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ label: '', color: '#DC2626', order_index: 0 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    tasksApi.getPriorities(orgId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!form.label.trim()) return
    setSubmitting(true)
    try {
      const item = await tasksApi.createPriority(orgId, { label: form.label.trim(), color: form.color, order_index: form.order_index, is_active: true })
      setItems((prev) => [...prev, item].sort((a, b) => a.order_index - b.order_index))
      setForm({ label: '', color: '#DC2626', order_index: 0 })
      setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} priorit{items.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Priority</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Label"><input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. High" className={inputCls} /></FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
              </div>
            </FormField>
            <FormField label="Order"><input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} className={inputCls} /></FormField>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No priorities yet.</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="flex-1 text-sm font-semibold text-[#0F172A]">{item.label}</span>
            <span className="text-xs text-[#475569]">Order: {item.order_index}</span>
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ label: '', type: 'in_progress', color: '#0891B2', order_index: 0, is_default: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    tasksApi.getStatuses(orgId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!form.label.trim()) return
    setSubmitting(true)
    try {
      const item = await tasksApi.createStatus(orgId, { label: form.label.trim(), type: form.type, color: form.color, order_index: form.order_index, is_default: form.is_default, is_active: true })
      setItems((prev) => [...prev, item].sort((a, b) => a.order_index - b.order_index))
      setForm({ label: '', type: 'in_progress', color: '#0891B2', order_index: 0, is_default: false })
      setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} status{items.length !== 1 ? 'es' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Status</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Label"><input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. In Review" className={inputCls} /></FormField>
            <FormField label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={selectCls}>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
              </div>
            </FormField>
            <FormField label="Order"><input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} className={inputCls} /></FormField>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-[#2563EB] w-4 h-4" />
            <span className="text-sm text-[#1E293B]">Set as default status</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No statuses yet.</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="flex-1 text-sm font-semibold text-[#0F172A]">{item.label}</span>
            <span className="text-xs text-[#475569] capitalize">{item.type.replace('_', ' ')}</span>
            {item.is_default && <span className="text-[11px] font-medium rounded-[999px] px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">Default</span>}
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChecklistTemplatesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateItems, setTemplateItems] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    tasksApi.getChecklistTemplates(orgId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!templateName.trim()) return
    const cleanItems = templateItems.filter((t) => t.trim())
    if (cleanItems.length === 0) return
    setSubmitting(true)
    try {
      const item = await tasksApi.createChecklistTemplate(orgId, { name: templateName.trim(), items: cleanItems.map((t, i) => ({ title: t.trim(), order_index: i })) })
      setItems((prev) => [...prev, item])
      setTemplateName(''); setTemplateItems(['']); setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} template{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Template</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <FormField label="Template Name"><input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Onboarding Checklist" className={inputCls} /></FormField>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Items</label>
            {templateItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="text" value={item} onChange={(e) => setTemplateItems((prev) => prev.map((v, i) => i === idx ? e.target.value : v))} placeholder={`Item ${idx + 1}`} className={inputCls} />
                <button onClick={() => setTemplateItems((prev) => prev.filter((_, i) => i !== idx))} className="w-8 h-[38px] flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setTemplateItems((prev) => [...prev, ''])} className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors mt-1"><Plus size={13} /> Add item</button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No checklist templates yet.</div>}
      <div className="space-y-3">
        {items.map((t) => (
          <div key={t.id} className="bg-white border border-[#E2E8F0] rounded-[8px] p-4">
            <p className="text-sm font-semibold text-[#0F172A] mb-2">{t.name}</p>
            <div className="space-y-1">
              {(t.items ?? []).map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded border border-[#CBD5E1] shrink-0" />
                  <span className="text-xs text-[#475569]">{item.title}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#94A3B8] mt-2">{(t.items ?? []).length} item{(t.items ?? []).length !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const VISIBILITY_MODES = [
  { id: 'hierarchy_and_dept', title: 'Hierarchy + Department', description: 'Users below in reporting structure AND users in same department', icon: '🏢' },
  { id: 'hierarchy_only', title: 'Hierarchy Only', description: 'Only users below the assigner in the reporting structure', icon: '📊' },
  { id: 'dept_only', title: 'Department Only', description: 'Only users in the same department as the assigner', icon: '🏠' },
  { id: 'custom', title: 'Custom Rules', description: 'Fully configure who appears using include/exclude rules', icon: '⚙️' },
]
const ALL_ROLES = ['org_admin', 'hr_manager', 'employee']

function AssigneeVisibilityTab({ orgId }: { orgId: string }) {
  const [config, setConfig] = useState<TaskMasterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [mode, setMode] = useState('hierarchy_and_dept')
  const [configRoles, setConfigRoles] = useState<string[]>(['org_admin', 'hr_manager'])
  const [customRules, setCustomRules] = useState({ include_departments: [] as string[], exclude_departments: [] as string[], include_roles: [] as string[], exclude_roles: [] as string[], allow_cross_dept: false, allow_outside_hierarchy: false })

  useEffect(() => {
    setLoading(true)
    Promise.all([
      tasksApi.getConfig(orgId),
      apiClient.get(`/api/v1/org/${orgId}/departments`).then((r) => r.data?.data ?? r.data ?? []).catch(() => []),
    ]).then(([cfg, depts]) => {
      setConfig(cfg)
      setMode(cfg.assignee_visibility_mode ?? 'hierarchy_and_dept')
      setConfigRoles((cfg.assignee_visibility_config_roles as string[]) ?? ['org_admin', 'hr_manager'])
      const rules = (cfg.assignee_custom_rules as typeof customRules) ?? {}
      setCustomRules({ include_departments: rules.include_departments ?? [], exclude_departments: rules.exclude_departments ?? [], include_roles: rules.include_roles ?? [], exclude_roles: rules.exclude_roles ?? [], allow_cross_dept: rules.allow_cross_dept ?? false, allow_outside_hierarchy: rules.allow_outside_hierarchy ?? false })
      setDepartments(Array.isArray(depts) ? depts : [])
    }).catch(() => null).finally(() => setLoading(false))
  }, [orgId])

  async function handleSave() {
    setSaving(true)
    try {
      await tasksApi.updateAssigneeVisibility(orgId, { assignee_visibility_mode: mode, assignee_custom_rules: mode === 'custom' ? customRules as unknown as Record<string, unknown> : undefined, assignee_visibility_config_roles: configRoles })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  function toggleMs<T extends string>(arr: T[], value: T): T[] { return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-[#374151] mb-3">Visibility Mode</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VISIBILITY_MODES.map((vm) => (
            <button key={vm.id} type="button" onClick={() => setMode(vm.id)} className={`flex items-start gap-3 p-4 rounded-[10px] border-2 text-left transition-all ${mode === vm.id ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'}`}>
              <span className="text-xl shrink-0">{vm.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${mode === vm.id ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{vm.title}</p>
                <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">{vm.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
      {mode === 'custom' && (
        <div className="border border-[#E2E8F0] rounded-[10px] p-5 space-y-5 bg-[#F8FAFC]">
          <p className="text-sm font-semibold text-[#0F172A]">Custom Rules</p>
          {(['include_departments', 'exclude_departments'] as const).map((key) => (
            <div key={key}>
              <label className="block text-xs font-medium text-[#374151] mb-2 capitalize">{key.replace('_', ' ').replace('departments', 'Departments')}</label>
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <button key={d.id} type="button" onClick={() => setCustomRules({ ...customRules, [key]: toggleMs(customRules[key], d.id) })}
                    className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-colors ${customRules[key].includes(d.id) ? (key === 'include_departments' ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-[#DC2626] text-white border-[#DC2626]') : 'bg-white text-[#475569] border-[#CBD5E1]'}`}>
                    {d.name}
                  </button>
                ))}
                {departments.length === 0 && <p className="text-xs text-[#94A3B8]">No departments configured</p>}
              </div>
            </div>
          ))}
          {[{ key: 'allow_cross_dept' as const, label: 'Allow cross-department assignees' }, { key: 'allow_outside_hierarchy' as const, label: 'Allow assignees outside reporting hierarchy' }].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <button type="button" onClick={() => setCustomRules({ ...customRules, [key]: !customRules[key] })} className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${customRules[key] ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'}`} role="switch" aria-checked={customRules[key]}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${customRules[key] ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-[#1E293B]">{label}</span>
            </div>
          ))}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-[#374151] mb-2">Who can change these settings</label>
        <div className="flex gap-2">
          {ALL_ROLES.map((r) => (
            <button key={r} type="button" onClick={() => setConfigRoles(toggleMs(configRoles, r))} className={`px-3 py-1.5 rounded-[6px] text-xs font-medium border capitalize transition-colors ${configRoles.includes(r) ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB]'}`}>{r.replace('_', ' ')}</button>
          ))}
        </div>
      </div>
      <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors">
        <Save size={15} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}

// ─── Ticket Masters Tabs ──────────────────────────────────────────────────────

type TicketMasterTab = 'config' | 'types' | 'categories' | 'priorities' | 'statuses' | 'templates'

function TktConfigTab({ orgId }: { orgId: string }) {
  const [config, setConfig] = useState<TicketMasterConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ticketsApi.getConfig(orgId).then(setConfig).catch(() => null).finally(() => setLoading(false))
  }, [orgId])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    try {
      const updated = await ticketsApi.updateConfig(orgId, config)
      setConfig(updated); setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  if (loading) return <Spinner />
  if (!config) return <p className="text-sm text-[#475569]">Could not load configuration.</p>

  const modeOptions: { value: TicketReassignmentMode; label: string; desc: string }[] = [
    { value: 'both', label: 'Both', desc: 'Assignee and admins/managers can reassign' },
    { value: 'assignee_only', label: 'Assignee Only', desc: 'Only the current assignee can reassign' },
    { value: 'admin_manager_only', label: 'Admin / HR Manager Only', desc: 'Only org_admin and hr_manager can reassign' },
  ]

  return (
    <div className="space-y-6 max-w-xl">
      <FormField label="Reassignment Mode">
        <div className="space-y-2">
          {modeOptions.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setConfig({ ...config, reassignment_mode: opt.value })}
              className={`w-full flex items-start gap-3 p-3 rounded-[8px] border-2 text-left transition-all ${config.reassignment_mode === opt.value ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] hover:border-[#CBD5E1]'}`}>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${config.reassignment_mode === opt.value ? 'border-[#2563EB] bg-[#2563EB]' : 'border-[#CBD5E1]'}`} />
              <div>
                <p className={`text-sm font-semibold ${config.reassignment_mode === opt.value ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{opt.label}</p>
                <p className="text-xs text-[#475569]">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Default Escalation Levels">
        <input type="number" min={0} max={5} value={config.default_escalation_levels}
          onChange={(e) => setConfig({ ...config, default_escalation_levels: parseInt(e.target.value) || 0 })}
          className={inputCls} />
      </FormField>

      <div className="space-y-3">
        {[
          { key: 'require_raiser_confirmation' as const, label: 'Require raiser confirmation before closing', desc: 'Ticket stays in "Resolved" until the raiser confirms their issue is fixed' },
          { key: 'enable_rating' as const, label: 'Enable ticket rating', desc: 'Raiser can rate the resolution quality (1–5 stars) after ticket is closed' },
        ].map(({ key, label, desc }) => (
          <div key={key} className={`flex items-start gap-3 p-3 rounded-[8px] border-2 cursor-pointer transition-all ${config[key] ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0]'}`} onClick={() => setConfig({ ...config, [key]: !config[key] })}>
            <div className={`relative w-9 h-5 rounded-full mt-0.5 shrink-0 transition-colors duration-200 ${config[key] ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${config[key] ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${config[key] ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{label}</p>
              <p className="text-xs text-[#475569] mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors">
        <Save size={15} /> {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}
      </button>
    </div>
  )
}

function TktTypesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const emptyForm = { name: '', icon: '🎫', color: '#2563EB', default_sla_days: 3, description: '' }
  const [form, setForm] = useState({ ...emptyForm })
  const [editForm, setEditForm] = useState({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    ticketsApi.listTypes(orgId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const item = await ticketsApi.createType(orgId, { name: form.name.trim(), icon: form.icon, color: form.color, default_sla_days: form.default_sla_days, description: form.description.trim() || undefined, is_active: true })
      setItems((prev) => [...prev, item]); setForm({ ...emptyForm }); setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleEdit(id: string) {
    if (!editForm.name.trim()) return
    setSubmitting(true)
    try {
      const updated = await ticketsApi.updateType(orgId, id, { name: editForm.name.trim(), icon: editForm.icon, color: editForm.color, default_sla_days: editForm.default_sla_days, description: editForm.description.trim() || undefined })
      setItems((prev) => prev.map((i) => i.id === id ? updated : i)); setEditingId(null)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deactivate this type?')) return
    await ticketsApi.deleteType(orgId, id).catch(() => null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function TypeForm({ f, setF, onSave, onCancel, label }: { f: typeof emptyForm; setF: (v: typeof emptyForm) => void; onSave: () => void; onCancel: () => void; label: string }) {
    return (
      <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name"><input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Issue" className={inputCls} /></FormField>
          <FormField label="Icon (emoji)"><input type="text" value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} className={inputCls} /></FormField>
          <FormField label="Color">
            <div className="flex gap-2 items-center">
              <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
              <input type="text" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className={inputCls} />
            </div>
          </FormField>
          <FormField label="Default SLA Days"><input type="number" min={1} value={f.default_sla_days} onChange={(e) => setF({ ...f, default_sla_days: parseInt(e.target.value) || 1 })} className={inputCls} /></FormField>
        </div>
        <FormField label="Description (optional)"><input type="text" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Brief description..." className={inputCls} /></FormField>
        <div className="flex gap-2">
          <button onClick={onSave} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Saving...' : label}</button>
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
        </div>
      </div>
    )
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} type{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Type</button>
      </div>
      {creating && <TypeForm f={form} setF={setForm} onSave={handleCreate} onCancel={() => setCreating(false)} label="Create" />}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No ticket types yet. Click "Add Type" to create one.</div>}
      <div className="space-y-2">
        {items.map((item) => editingId === item.id ? (
          <TypeForm key={item.id} f={editForm} setF={setEditForm} onSave={() => handleEdit(item.id)} onCancel={() => setEditingId(null)} label="Save" />
        ) : (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{item.icon}</span>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
              {item.description && <p className="text-xs text-[#475569] truncate">{item.description}</p>}
            </div>
            <span className="text-xs text-[#475569]">SLA: {item.default_sla_days}d</span>
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, icon: item.icon, color: item.color, default_sla_days: item.default_sla_days, description: item.description ?? '' }) }} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TktCategoriesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TicketCategory[]>([])
  const [types, setTypes] = useState<TicketType[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const emptyForm = { name: '', color: '#0891B2', ticket_type_id: '', default_sla_days: '', description: '' }
  const [form, setForm] = useState({ ...emptyForm })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([ticketsApi.listCategories(orgId), ticketsApi.listTypes(orgId)])
      .then(([cats, tys]) => { setItems(cats); setTypes(tys) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const item = await ticketsApi.createCategory(orgId, {
        name: form.name.trim(),
        color: form.color,
        ticket_type_id: form.ticket_type_id || undefined,
        default_sla_days: form.default_sla_days ? parseInt(form.default_sla_days) : undefined,
        description: form.description.trim() || undefined,
        is_active: true,
      })
      setItems((prev) => [...prev, item]); setForm({ ...emptyForm }); setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    await ticketsApi.deleteCategory(orgId, id).catch(() => null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} categor{items.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Category</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Network" className={inputCls} /></FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
              </div>
            </FormField>
            <FormField label="Ticket Type (optional)">
              <select value={form.ticket_type_id} onChange={(e) => setForm({ ...form, ticket_type_id: e.target.value })} className={selectCls}>
                <option value="">All types</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </FormField>
            <FormField label="SLA Override (days, optional)"><input type="number" min={1} value={form.default_sla_days} onChange={(e) => setForm({ ...form, default_sla_days: e.target.value })} placeholder="Inherits from type" className={inputCls} /></FormField>
          </div>
          <FormField label="Description (optional)"><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} /></FormField>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No categories yet.</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
              {item.ticket_type && <p className="text-xs text-[#94A3B8]">{item.ticket_type.icon} {item.ticket_type.name}</p>}
            </div>
            {item.default_sla_days && <span className="text-xs text-[#475569]">SLA: {item.default_sla_days}d</span>}
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
            <button onClick={() => handleDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TktPrioritiesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TicketPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ label: '', color: '#DC2626', sla_days: '', order_index: 0 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    ticketsApi.listPriorities(orgId).then(setItems).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!form.label.trim()) return
    setSubmitting(true)
    try {
      const item = await ticketsApi.createPriority(orgId, { label: form.label.trim(), color: form.color, sla_days: form.sla_days ? parseInt(form.sla_days) : undefined, order_index: form.order_index, is_active: true })
      setItems((prev) => [...prev, item].sort((a, b) => a.order_index - b.order_index))
      setForm({ label: '', color: '#DC2626', sla_days: '', order_index: 0 }); setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this priority?')) return
    await ticketsApi.deletePriority(orgId, id).catch(() => null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} priorit{items.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Priority</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Label"><input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Critical" className={inputCls} /></FormField>
            <FormField label="SLA Days (optional)"><input type="number" min={1} value={form.sla_days} onChange={(e) => setForm({ ...form, sla_days: e.target.value })} placeholder="Override SLA" className={inputCls} /></FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
              </div>
            </FormField>
            <FormField label="Order"><input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} className={inputCls} /></FormField>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No priorities yet.</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="flex-1 text-sm font-semibold text-[#0F172A]">{item.label}</span>
            {item.sla_days && <span className="text-xs text-[#475569]">SLA: {item.sla_days}d</span>}
            <span className="text-xs text-[#475569]">Order: {item.order_index}</span>
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
            <button onClick={() => handleDelete(item.id)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

function TktStatusesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TicketStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ label: '', type: 'open' as TicketStatusType, color: '#2563EB', order_index: 0, is_default: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    ticketsApi.listStatuses(orgId).then((s) => setItems(s.sort((a, b) => a.order_index - b.order_index))).catch(() => setItems([])).finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!form.label.trim()) return
    setSubmitting(true)
    try {
      const item = await ticketsApi.createStatus(orgId, { label: form.label.trim(), type: form.type, color: form.color, order_index: form.order_index, is_default: form.is_default, is_active: true })
      setItems((prev) => [...prev, item].sort((a, b) => a.order_index - b.order_index))
      setForm({ label: '', type: 'open', color: '#2563EB', order_index: 0, is_default: false }); setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  const statusTypes: TicketStatusType[] = ['open', 'assigned', 'in_progress', 'resolved', 'closed_resolved', 'closed_unresolved']

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} status{items.length !== 1 ? 'es' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Status</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Label"><input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Pending Review" className={inputCls} /></FormField>
            <FormField label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TicketStatusType })} className={selectCls}>
                {statusTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[38px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
              </div>
            </FormField>
            <FormField label="Order"><input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} className={inputCls} /></FormField>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="accent-[#2563EB] w-4 h-4" />
            <span className="text-sm text-[#1E293B]">Set as default status</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No statuses yet.</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="flex-1 text-sm font-semibold text-[#0F172A]">{item.label}</span>
            <span className="text-xs text-[#475569] capitalize">{item.type.replace(/_/g, ' ')}</span>
            {item.is_default && <span className="text-[11px] font-medium rounded-[999px] px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">Default</span>}
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Inactive'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TktTemplatesTab({ orgId }: { orgId: string }) {
  const [items, setItems] = useState<TicketTemplate[]>([])
  const [types, setTypes] = useState<TicketType[]>([])
  const [categories, setCategories] = useState<TicketCategory[]>([])
  const [priorities, setPriorities] = useState<TicketPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const emptyForm = { name: '', template_type: 'simple' as TicketTemplateType, ticket_type_id: '', category_id: '', priority_id: '', title_template: '', description_template: '', sla_days: '' }
  const [form, setForm] = useState({ ...emptyForm })
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([ticketsApi.listTemplates(orgId), ticketsApi.listTypes(orgId), ticketsApi.listCategories(orgId), ticketsApi.listPriorities(orgId)])
      .then(([tmpl, tys, cats, pris]) => { setItems(tmpl); setTypes(tys); setCategories(cats); setPriorities(pris) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [orgId])

  async function handleCreate() {
    if (!form.name.trim() || !form.title_template.trim()) return
    setSubmitting(true)
    try {
      const item = await ticketsApi.createTemplate(orgId, {
        name: form.name.trim(),
        template_type: form.template_type,
        ticket_type_id: form.ticket_type_id || undefined,
        category_id: form.category_id || undefined,
        priority_id: form.priority_id || undefined,
        title_template: form.title_template.trim(),
        description_template: form.description_template.trim() || undefined,
        sla_days: form.sla_days ? parseInt(form.sla_days) : undefined,
        checklist_items: checklistItems.filter((c) => c.trim()).map((c) => ({ title: c.trim() })),
        is_active: true,
      })
      setItems((prev) => [item, ...prev]); setForm({ ...emptyForm }); setChecklistItems([]); setCreating(false)
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this template? It will no longer appear for new tickets.')) return
    await ticketsApi.archiveTemplate(orgId, id).catch(() => null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} template{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"><Plus size={14} /> Add Template</button>
      </div>
      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Template Name"><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. VPN Access Request" className={inputCls} /></FormField>
            <FormField label="Type">
              <div className="flex gap-2">
                {(['simple', 'full'] as TicketTemplateType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, template_type: t })} className={`flex-1 py-[9px] rounded-[8px] text-sm font-semibold border-2 transition-colors ${form.template_type === t ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E2E8F0] text-[#475569]'}`}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                ))}
              </div>
            </FormField>
            <FormField label="Ticket Type (optional)">
              <select value={form.ticket_type_id} onChange={(e) => setForm({ ...form, ticket_type_id: e.target.value })} className={selectCls}>
                <option value="">Any type</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </FormField>
            <FormField label="Category (optional)">
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={selectCls}>
                <option value="">Any category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Priority (optional)">
              <select value={form.priority_id} onChange={(e) => setForm({ ...form, priority_id: e.target.value })} className={selectCls}>
                <option value="">Any priority</option>
                {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </FormField>
            <FormField label="SLA Override (days, optional)"><input type="number" min={1} value={form.sla_days} onChange={(e) => setForm({ ...form, sla_days: e.target.value })} placeholder="Inherits from type/category" className={inputCls} /></FormField>
          </div>
          <FormField label="Title Template *"><input type="text" value={form.title_template} onChange={(e) => setForm({ ...form, title_template: e.target.value })} placeholder="Pre-filled ticket title" className={inputCls} /></FormField>
          <FormField label="Description Template (optional)">
            <textarea value={form.description_template} onChange={(e) => setForm({ ...form, description_template: e.target.value })} rows={2} placeholder="Pre-filled description..." className={`${inputCls} resize-none`} />
          </FormField>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Checklist Items</label>
            {checklistItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input type="text" value={item} onChange={(e) => setChecklistItems((prev) => prev.map((v, i) => i === idx ? e.target.value : v))} placeholder={`Item ${idx + 1}`} className={inputCls} />
                <button onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== idx))} className="w-8 h-[38px] flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setChecklistItems((prev) => [...prev, ''])} className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors mt-1"><Plus size={13} /> Add item</button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">{submitting ? 'Creating...' : 'Create'}</button>
            <button onClick={() => { setCreating(false); setChecklistItems([]) }} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">Cancel</button>
          </div>
        </div>
      )}
      {items.length === 0 && !creating && <div className="text-center py-12 text-[#475569] text-sm">No templates yet.</div>}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.template_type === 'full' ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'}`}>{item.template_type}</span>
              </div>
              <p className="text-xs text-[#94A3B8] truncate">{item.title_template}</p>
            </div>
            {item.checklist_items.length > 0 && <span className="text-xs text-[#475569]">{item.checklist_items.length} items</span>}
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>{item.is_active ? 'Active' : 'Archived'}</span>
            {item.is_active && (
              <button onClick={() => handleArchive(item.id)} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors" title="Archive"><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const taskTabs: { key: TaskMasterTab; label: string; icon: React.ReactNode }[] = [
  { key: 'config', label: 'Config', icon: <Settings2 size={15} /> },
  { key: 'categories', label: 'Categories', icon: <Tag size={15} /> },
  { key: 'priorities', label: 'Priorities', icon: <BarChart size={15} /> },
  { key: 'statuses', label: 'Statuses', icon: <Activity size={15} /> },
  { key: 'checklists', label: 'Checklist Templates', icon: <List size={15} /> },
  { key: 'assignee_visibility', label: 'Assignee Visibility', icon: <Users size={15} /> },
]

const ticketTabs: { key: TicketMasterTab; label: string; icon: React.ReactNode }[] = [
  { key: 'config', label: 'Configuration', icon: <Settings2 size={15} /> },
  { key: 'types', label: 'Types', icon: <TicketIcon size={15} /> },
  { key: 'categories', label: 'Categories', icon: <Tag size={15} /> },
  { key: 'priorities', label: 'Priorities', icon: <BarChart size={15} /> },
  { key: 'statuses', label: 'Statuses', icon: <Activity size={15} /> },
  { key: 'templates', label: 'Templates', icon: <CheckSquare size={15} /> },
]

export default function MastersPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [masterSection, setMasterSection] = useState<'tasks' | 'tickets'>('tasks')
  const [taskTab, setTaskTab] = useState<TaskMasterTab>('config')
  const [ticketTab, setTicketTab] = useState<TicketMasterTab>('config')

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
      </div>
    )
  }

  const activeTabs = masterSection === 'tasks' ? taskTabs : ticketTabs

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Masters</h1>
        <p className="mt-1 text-[15px] text-[#475569]">Configure system settings for tasks and tickets.</p>
      </div>

      {/* Top-level switcher */}
      <div className="flex gap-2 p-1 bg-[#F1F5F9] rounded-[10px] w-fit">
        {([['tasks', 'Task Masters'], ['tickets', 'Ticket Masters']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMasterSection(key)}
            className={[
              'px-4 py-2 rounded-[8px] text-sm font-semibold transition-colors',
              masterSection === key ? 'bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(0,0,0,0.1)]' : 'text-[#475569] hover:text-[#0F172A]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {/* Tab bar */}
        <div className="flex border-b border-[#E2E8F0] overflow-x-auto">
          {activeTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => masterSection === 'tasks' ? setTaskTab(t.key as TaskMasterTab) : setTicketTab(t.key as TicketMasterTab)}
              className={[
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
                (masterSection === 'tasks' ? taskTab : ticketTab) === t.key
                  ? 'text-[#2563EB] border-[#2563EB]'
                  : 'text-[#475569] border-transparent hover:text-[#0F172A]',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {masterSection === 'tasks' && (
            <>
              {taskTab === 'config' && <ConfigTab orgId={orgId} />}
              {taskTab === 'categories' && <CategoriesTab orgId={orgId} />}
              {taskTab === 'priorities' && <PrioritiesTab orgId={orgId} />}
              {taskTab === 'statuses' && <StatusesTab orgId={orgId} />}
              {taskTab === 'checklists' && <ChecklistTemplatesTab orgId={orgId} />}
              {taskTab === 'assignee_visibility' && <AssigneeVisibilityTab orgId={orgId} />}
            </>
          )}
          {masterSection === 'tickets' && (
            <>
              {ticketTab === 'config' && <TktConfigTab orgId={orgId} />}
              {ticketTab === 'types' && <TktTypesTab orgId={orgId} />}
              {ticketTab === 'categories' && <TktCategoriesTab orgId={orgId} />}
              {ticketTab === 'priorities' && <TktPrioritiesTab orgId={orgId} />}
              {ticketTab === 'statuses' && <TktStatusesTab orgId={orgId} />}
              {ticketTab === 'templates' && <TktTemplatesTab orgId={orgId} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

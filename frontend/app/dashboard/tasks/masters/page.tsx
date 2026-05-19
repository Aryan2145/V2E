'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type {
  TaskMasterConfig,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  ChecklistTemplate,
} from '@/lib/types/tasks'
import { Plus, Pencil, Trash2, Save, X, Settings2, Tag, BarChart, Activity, List } from 'lucide-react'

type MasterTab = 'config' | 'categories' | 'priorities' | 'statuses' | 'checklists'

// ─── Inline form helpers ──────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#374151] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

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
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
  if (!config) return <p className="text-sm text-[#475569]">Could not load configuration.</p>

  return (
    <div className="space-y-6 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Default Reminder Days Before">
          <input
            type="number"
            min={0}
            value={config.default_reminder_days_before}
            onChange={(e) => setConfig({ ...config, default_reminder_days_before: parseInt(e.target.value) || 0 })}
            className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
          />
        </FormField>
        <FormField label="Reopen Window (minutes)">
          <input
            type="number"
            min={0}
            value={config.reopen_window_minutes}
            onChange={(e) => setConfig({ ...config, reopen_window_minutes: parseInt(e.target.value) || 0 })}
            className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
          />
        </FormField>
        <FormField label="Escalation Levels">
          <input
            type="number"
            min={0}
            value={config.escalation_levels}
            onChange={(e) => setConfig({ ...config, escalation_levels: parseInt(e.target.value) || 0 })}
            className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
          />
        </FormField>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
      >
        <Save size={15} />
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Configuration'}
      </button>
    </div>
  )
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

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
      const item = await tasksApi.createCategory(orgId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color,
        is_active: true,
      })
      setItems((prev) => [...prev, item])
      setForm({ name: '', description: '', color: '#2563EB' })
      setCreating(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(id: string) {
    if (!editForm.name.trim()) return
    setSubmitting(true)
    try {
      const updated = await tasksApi.updateCategory(orgId, id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        color: editForm.color,
      })
      setItems((prev) => prev.map((i) => i.id === id ? updated : i))
      setEditingId(null)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    await tasksApi.deleteCategory(orgId, id).catch(() => null)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} categor{items.length !== 1 ? 'ies' : 'y'}</p>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={14} />
          Add Category
        </button>
      </div>

      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Category name"
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              />
            </FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-[42px] rounded-[6px] border border-[#CBD5E1] cursor-pointer"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                />
              </div>
            </FormField>
          </div>
          <FormField label="Description (optional)">
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description..."
              className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
            />
          </FormField>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">
              {submitting ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !creating && (
        <div className="text-center py-12 text-[#475569] text-sm">No categories yet.</div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          editingId === item.id ? (
            <div key={item.id} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Name">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                  />
                </FormField>
                <FormField label="Color">
                  <div className="flex gap-2 items-center">
                    <input type="color" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="w-10 h-[42px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                    <input type="text" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
                  </div>
                </FormField>
              </div>
              <FormField label="Description">
                <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
              </FormField>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(item.id)} disabled={submitting} className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">
                  {submitting ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditingId(null)} className="px-4 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[8px] px-4 py-3 flex items-center gap-3">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A]">{item.name}</p>
                {item.description && <p className="text-xs text-[#475569] truncate">{item.description}</p>}
              </div>
              <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, description: item.description ?? '', color: item.color }) }}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

// ─── Priorities Tab ───────────────────────────────────────────────────────────

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
      const item = await tasksApi.createPriority(orgId, {
        label: form.label.trim(),
        color: form.color,
        order_index: form.order_index,
        is_active: true,
      })
      setItems((prev) => [...prev, item].sort((a, b) => a.order_index - b.order_index))
      setForm({ label: '', color: '#DC2626', order_index: 0 })
      setCreating(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} priorit{items.length !== 1 ? 'ies' : 'y'}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors">
          <Plus size={14} />
          Add Priority
        </button>
      </div>

      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Label">
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. High" className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
            </FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[42px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
              </div>
            </FormField>
            <FormField label="Order Index">
              <input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
            </FormField>
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
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
              {item.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Statuses Tab ─────────────────────────────────────────────────────────────

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
      const item = await tasksApi.createStatus(orgId, {
        label: form.label.trim(),
        type: form.type,
        color: form.color,
        order_index: form.order_index,
        is_default: form.is_default,
        is_active: true,
      })
      setItems((prev) => [...prev, item].sort((a, b) => a.order_index - b.order_index))
      setForm({ label: '', type: 'in_progress', color: '#0891B2', order_index: 0, is_default: false })
      setCreating(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} status{items.length !== 1 ? 'es' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors">
          <Plus size={14} />
          Add Status
        </button>
      </div>

      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Label">
              <input type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. In Review" className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
            </FormField>
            <FormField label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white">
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </FormField>
            <FormField label="Color">
              <div className="flex gap-2 items-center">
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-10 h-[42px] rounded-[6px] border border-[#CBD5E1] cursor-pointer" />
                <input type="text" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
              </div>
            </FormField>
            <FormField label="Order Index">
              <input type="number" value={form.order_index} onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })} className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
            </FormField>
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
            {item.is_default && (
              <span className="text-[11px] font-medium rounded-[999px] px-2 py-0.5 bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">Default</span>
            )}
            <span className={`text-[11px] font-medium rounded-[999px] px-2 py-0.5 ${item.is_active ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}`}>
              {item.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Checklist Templates Tab ──────────────────────────────────────────────────

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

  function updateItem(idx: number, val: string) {
    setTemplateItems((prev) => prev.map((v, i) => i === idx ? val : v))
  }

  function removeItem(idx: number) {
    setTemplateItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleCreate() {
    if (!templateName.trim()) return
    const cleanItems = templateItems.filter((t) => t.trim())
    if (cleanItems.length === 0) return
    setSubmitting(true)
    try {
      const item = await tasksApi.createChecklistTemplate(orgId, {
        name: templateName.trim(),
        items: cleanItems.map((t, i) => ({ title: t.trim(), order_index: i })),
      })
      setItems((prev) => [...prev, item])
      setTemplateName('')
      setTemplateItems([''])
      setCreating(false)
    } catch {
      // ignore
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="h-40 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#475569]">{items.length} template{items.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] transition-colors">
          <Plus size={14} />
          Add Template
        </button>
      </div>

      {creating && (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-4 space-y-3">
          <FormField label="Template Name">
            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Onboarding Checklist" className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white" />
          </FormField>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Items</label>
            {templateItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => updateItem(idx, e.target.value)}
                  placeholder={`Item ${idx + 1}`}
                  className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
                />
                <button onClick={() => removeItem(idx)} className="w-8 h-[38px] flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setTemplateItems((prev) => [...prev, ''])}
              className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors mt-1"
            >
              <Plus size={13} />
              Add item
            </button>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const tabs: { key: MasterTab; label: string; icon: React.ReactNode }[] = [
  { key: 'config', label: 'Config', icon: <Settings2 size={15} /> },
  { key: 'categories', label: 'Categories', icon: <Tag size={15} /> },
  { key: 'priorities', label: 'Priorities', icon: <BarChart size={15} /> },
  { key: 'statuses', label: 'Statuses', icon: <Activity size={15} /> },
  { key: 'checklists', label: 'Checklist Templates', icon: <List size={15} /> },
]

export default function MastersPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [activeTab, setActiveTab] = useState<MasterTab>('config')

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Task Masters</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Configure task system settings, categories, priorities, statuses and checklist templates.
        </p>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {/* Tabs */}
        <div className="flex border-b border-[#E2E8F0] overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={[
                'flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2',
                activeTab === t.key
                  ? 'text-[#2563EB] border-[#2563EB]'
                  : 'text-[#475569] border-transparent hover:text-[#0F172A]',
              ].join(' ')}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'config' && <ConfigTab orgId={orgId} />}
          {activeTab === 'categories' && <CategoriesTab orgId={orgId} />}
          {activeTab === 'priorities' && <PrioritiesTab orgId={orgId} />}
          {activeTab === 'statuses' && <StatusesTab orgId={orgId} />}
          {activeTab === 'checklists' && <ChecklistTemplatesTab orgId={orgId} />}
        </div>
      </div>
    </div>
  )
}

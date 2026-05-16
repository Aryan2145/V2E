'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth/context'
import {
  getConversations, createConversation, getMessages, sendMessage, markRead,
} from '@/lib/api/messaging'
import { getEmployees } from '@/lib/api/employees'
import type { Conversation, Message } from '@/lib/types/communication'
import type { EmployeeProfile } from '@/lib/types'
import { MessageSquare, Plus, Send, X, Users, Search } from 'lucide-react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = 'http://localhost:3001'

export default function MessagesPage() {
  const { user } = useAuth()
  const orgId = user?.organization_id ?? ''
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewConv, setShowNewConv] = useState(false)
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [convType, setConvType] = useState<'direct' | 'group'>('direct')
  const [groupName, setGroupName] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; timeout: ReturnType<typeof setTimeout> }>>({})
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load conversations
  useEffect(() => {
    if (!orgId) return
    getConversations(orgId).then(setConversations)
  }, [orgId])

  // Load employees for new conversation dialog
  useEffect(() => {
    if (!orgId || !showNewConv) return
    getEmployees(orgId).then(setEmployees)
  }, [orgId, showNewConv])

  // Socket.io connection
  useEffect(() => {
    if (!user?.id) return
    const socket = io(`${SOCKET_URL}/chat`, {
      auth: { userId: user.id },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('newMessage', (msg: Message) => {
      setMessages(prev => [...prev, msg])
      setConversations(prev => prev.map(c =>
        c.id === msg.conversation_id ? { ...c, last_message: msg, updated_at: msg.created_at } : c
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    })

    socket.on('typing', ({ userId: uid, userName, isTyping }: { userId: string; userName: string; isTyping: boolean }) => {
      if (uid === user.id) return
      setTypingUsers(prev => {
        if (!isTyping) {
          const next = { ...prev }
          if (next[uid]?.timeout) clearTimeout(next[uid].timeout)
          delete next[uid]
          return next
        }
        if (prev[uid]?.timeout) clearTimeout(prev[uid].timeout)
        const timeout = setTimeout(() => {
          setTypingUsers(p => { const n = { ...p }; delete n[uid]; return n })
        }, 3000)
        return { ...prev, [uid]: { name: userName, timeout } }
      })
    })

    socket.on('messageEdited', (updated: Message) => {
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
    })

    socket.on('messageDeleted', ({ msgId }: { msgId: string }) => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true, body: '' } : m))
    })

    return () => { socket.disconnect() }
  }, [user?.id])

  // Join room and load messages when active conversation changes
  useEffect(() => {
    if (!activeConvId || !orgId || !socketRef.current) return
    socketRef.current.emit('join', { convId: activeConvId, orgId })
    getMessages(orgId, activeConvId).then(msgs => {
      setMessages(msgs)
      markRead(orgId, activeConvId)
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c))
    })

    return () => {
      socketRef.current?.emit('leave', { convId: activeConvId })
    }
  }, [activeConvId, orgId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!orgId || !activeConvId || !messageInput.trim() || sending) return
    const body = messageInput.trim()
    setMessageInput('')
    setSending(true)
    try {
      await sendMessage(orgId, activeConvId, { body })
    } finally {
      setSending(false)
    }
  }, [orgId, activeConvId, messageInput, sending])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function emitTyping(isTyping: boolean) {
    if (!activeConvId || !socketRef.current) return
    socketRef.current.emit('typing', { convId: activeConvId, userName: user?.name ?? '', isTyping })
  }

  function handleInputChange(val: string) {
    setMessageInput(val)
    emitTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2000)
  }

  async function handleCreateConversation() {
    if (!orgId || selectedUsers.length === 0) return
    const conv = await createConversation(orgId, {
      type: convType,
      user_ids: selectedUsers,
      name: convType === 'group' ? groupName.trim() || undefined : undefined,
    })
    setConversations(prev => {
      const exists = prev.find(c => c.id === conv.id)
      return exists ? prev : [conv, ...prev]
    })
    setActiveConvId(conv.id)
    setShowNewConv(false)
    setSelectedUsers([])
    setGroupName('')
    setConvType('direct')
  }

  const activeConv = conversations.find(c => c.id === activeConvId)
  const typingList = Object.values(typingUsers).map(t => t.name)
  const filteredEmployees = employees.filter(e =>
    e.user_id !== user?.id && (
      !empSearch || e.user?.name?.toLowerCase().includes(empSearch.toLowerCase())
    )
  )

  return (
    <div className="flex h-[calc(100vh-56px)] bg-[#F8FAFC]">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-[#E2E8F0] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0F172A]">Messages</h2>
          <button
            onClick={() => setShowNewConv(true)}
            className="w-8 h-8 rounded-[6px] bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center hover:bg-[#DBEAFE] transition-colors"
            title="New conversation"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <MessageSquare size={32} className="text-[#CBD5E1] mb-2" />
              <p className="text-sm text-[#475569]">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => {
              const isActive = conv.id === activeConvId
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={[
                    'w-full text-left px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors flex gap-3 items-start',
                    isActive ? 'bg-[#EFF6FF]' : '',
                  ].join(' ')}
                >
                  <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {conv.type === 'group' ? <Users size={16} /> : (conv.display_name?.charAt(0).toUpperCase() ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#0F172A] truncate">{conv.display_name ?? conv.name ?? 'Conversation'}</span>
                      {(conv.unread_count ?? 0) > 0 && (
                        <span className="ml-1 bg-[#2563EB] text-white text-xs font-bold rounded-full px-1.5 py-0.5 shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                        {conv.last_message.is_deleted ? <em>Message deleted</em> : conv.last_message.body}
                      </p>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeConvId && activeConv ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-5 py-3 border-b border-[#E2E8F0] bg-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-sm font-bold">
              {activeConv.type === 'group' ? <Users size={15} /> : (activeConv.display_name?.charAt(0).toUpperCase() ?? '?')}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{activeConv.display_name ?? activeConv.name ?? 'Conversation'}</p>
              <p className="text-xs text-[#94A3B8]">{activeConv.members.length} members</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
            {messages.map(msg => {
              const isMine = msg.sender_user_id === user?.id
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && (
                    <div className="w-7 h-7 rounded-full bg-[#475569] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1">
                      {msg.sender?.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={`max-w-[65%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                    {!isMine && <span className="text-xs font-semibold text-[#475569]">{msg.sender?.name}</span>}
                    {msg.reply_to_message && !msg.is_deleted && (
                      <div className={`text-xs text-[#475569] bg-[#F1F5F9] px-2 py-1 rounded-[6px] border-l-2 border-[#2563EB] max-w-full truncate`}>
                        {msg.reply_to_message.body}
                      </div>
                    )}
                    <div className={[
                      'px-3 py-2 rounded-[12px] text-sm',
                      isMine ? 'bg-[#2563EB] text-white rounded-tr-none' : 'bg-white border border-[#E2E8F0] text-[#1E293B] rounded-tl-none',
                      msg.is_deleted ? 'italic opacity-60' : '',
                    ].join(' ')}>
                      {msg.is_deleted ? 'This message was deleted' : msg.body}
                    </div>
                    <span className="text-[10px] text-[#94A3B8]">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
            {typingList.length > 0 && (
              <div className="text-xs text-[#94A3B8] italic">
                {typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[#E2E8F0] bg-white flex gap-2 items-end">
            <textarea
              value={messageInput}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] resize-none"
              style={{ maxHeight: 120, overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!messageInput.trim() || sending}
              className="w-9 h-9 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare size={48} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[#475569] font-medium">Select a conversation</p>
            <p className="text-sm text-[#94A3B8]">or start a new one</p>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[16px] w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#0F172A]">New Conversation</h2>
              <button onClick={() => { setShowNewConv(false); setSelectedUsers([]); setEmpSearch('') }} className="p-1.5 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['direct', 'group'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setConvType(t); setSelectedUsers([]) }}
                  className={`flex-1 py-2 rounded-[8px] text-sm font-semibold transition-colors ${convType === t ? 'bg-[#2563EB] text-white' : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'}`}
                >
                  {t === 'direct' ? 'Direct Message' : 'Group Chat'}
                </button>
              ))}
            </div>

            {convType === 'group' && (
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Group name (optional)"
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] mb-3"
              />
            )}

            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={empSearch}
                onChange={e => setEmpSearch(e.target.value)}
                placeholder="Search employees…"
                className="w-full pl-8 pr-3 py-2 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div className="max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-[8px] mb-4">
              {filteredEmployees.map(emp => {
                const uid = emp.user_id
                const selected = selectedUsers.includes(uid)
                const disabled = convType === 'direct' && selectedUsers.length === 1 && !selected
                return (
                  <button
                    key={uid}
                    disabled={disabled}
                    onClick={() => {
                      if (convType === 'direct') {
                        setSelectedUsers(selected ? [] : [uid])
                      } else {
                        setSelectedUsers(prev => selected ? prev.filter(u => u !== uid) : [...prev, uid])
                      }
                    }}
                    className={[
                      'w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-[#F1F5F9] last:border-0 transition-colors',
                      selected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]',
                      disabled ? 'opacity-40 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {emp.user?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{emp.user?.name}</p>
                      <p className="text-xs text-[#94A3B8]">{emp.user?.email}</p>
                    </div>
                    {selected && <div className="ml-auto w-4 h-4 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[10px]">✓</div>}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleCreateConversation}
              disabled={selectedUsers.length === 0}
              className="w-full bg-[#2563EB] text-white py-2.5 rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {convType === 'direct' ? 'Open Chat' : `Create Group (${selectedUsers.length} selected)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

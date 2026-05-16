import apiClient from './client';
import type { Conversation, Message } from '../types/communication';

function base(orgId: string) {
  return `/api/v1/org/${orgId}/messaging`;
}

export async function getConversations(orgId: string): Promise<Conversation[]> {
  const res = await apiClient.get(`${base(orgId)}/conversations`);
  return res.data.data;
}

export async function createConversation(
  orgId: string,
  data: { type: 'direct' | 'group'; user_ids: string[]; name?: string },
): Promise<Conversation> {
  const res = await apiClient.post(`${base(orgId)}/conversations`, data);
  return res.data.data;
}

export async function getConversation(orgId: string, convId: string): Promise<Conversation> {
  const res = await apiClient.get(`${base(orgId)}/conversations/${convId}`);
  return res.data.data;
}

export async function getMessages(orgId: string, convId: string, cursor?: string): Promise<Message[]> {
  const res = await apiClient.get(`${base(orgId)}/conversations/${convId}/messages`, {
    params: cursor ? { cursor } : {},
  });
  return res.data.data;
}

export async function sendMessage(
  orgId: string,
  convId: string,
  data: { body: string; reply_to_message_id?: string },
): Promise<Message> {
  const res = await apiClient.post(`${base(orgId)}/conversations/${convId}/messages`, data);
  return res.data.data;
}

export async function editMessage(orgId: string, convId: string, msgId: string, body: string): Promise<Message> {
  const res = await apiClient.patch(`${base(orgId)}/conversations/${convId}/messages/${msgId}`, { body });
  return res.data.data;
}

export async function deleteMessage(orgId: string, convId: string, msgId: string): Promise<void> {
  await apiClient.delete(`${base(orgId)}/conversations/${convId}/messages/${msgId}`);
}

export async function markRead(orgId: string, convId: string): Promise<void> {
  await apiClient.post(`${base(orgId)}/conversations/${convId}/read`);
}

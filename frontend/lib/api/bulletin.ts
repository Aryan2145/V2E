import apiClient from './client';
import type { BulletinBoard, BulletinPost, BulletinComment } from '../types/communication';

function base(orgId: string) {
  return `/api/v1/org/${orgId}/bulletin`;
}

// ─── Boards ───────────────────────────────────────────────────────────────────

export async function getBoards(orgId: string): Promise<BulletinBoard[]> {
  const res = await apiClient.get(`${base(orgId)}/boards`);
  return res.data.data;
}

export async function getBoard(orgId: string, boardId: string): Promise<BulletinBoard> {
  const res = await apiClient.get(`${base(orgId)}/boards/${boardId}`);
  return res.data.data;
}

export async function createBoard(orgId: string, data: Partial<BulletinBoard>): Promise<BulletinBoard> {
  const res = await apiClient.post(`${base(orgId)}/boards`, data);
  return res.data.data;
}

export async function updateBoard(orgId: string, boardId: string, data: Partial<BulletinBoard>): Promise<BulletinBoard> {
  const res = await apiClient.patch(`${base(orgId)}/boards/${boardId}`, data);
  return res.data.data;
}

export async function deleteBoard(orgId: string, boardId: string): Promise<void> {
  await apiClient.delete(`${base(orgId)}/boards/${boardId}`);
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export async function getPosts(orgId: string, boardId: string): Promise<BulletinPost[]> {
  const res = await apiClient.get(`${base(orgId)}/boards/${boardId}/posts`);
  return res.data.data;
}

export async function getPost(orgId: string, boardId: string, postId: string): Promise<BulletinPost> {
  const res = await apiClient.get(`${base(orgId)}/boards/${boardId}/posts/${postId}`);
  return res.data.data;
}

export async function createPost(orgId: string, boardId: string, data: Partial<BulletinPost>): Promise<BulletinPost> {
  const res = await apiClient.post(`${base(orgId)}/boards/${boardId}/posts`, data);
  return res.data.data;
}

export async function updatePost(orgId: string, boardId: string, postId: string, data: Partial<BulletinPost>): Promise<BulletinPost> {
  const res = await apiClient.patch(`${base(orgId)}/boards/${boardId}/posts/${postId}`, data);
  return res.data.data;
}

export async function deletePost(orgId: string, boardId: string, postId: string): Promise<void> {
  await apiClient.delete(`${base(orgId)}/boards/${boardId}/posts/${postId}`);
}

export async function togglePinPost(orgId: string, boardId: string, postId: string): Promise<BulletinPost> {
  const res = await apiClient.post(`${base(orgId)}/boards/${boardId}/posts/${postId}/pin`);
  return res.data.data;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function addComment(orgId: string, boardId: string, postId: string, body: string): Promise<BulletinComment> {
  const res = await apiClient.post(`${base(orgId)}/boards/${boardId}/posts/${postId}/comments`, { body });
  return res.data.data;
}

export async function deleteComment(orgId: string, commentId: string): Promise<void> {
  await apiClient.delete(`${base(orgId)}/comments/${commentId}`);
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function toggleReaction(orgId: string, boardId: string, postId: string, emoji: string) {
  const res = await apiClient.post(`${base(orgId)}/boards/${boardId}/posts/${postId}/react`, { emoji });
  return res.data.data;
}

export async function getReactions(orgId: string, boardId: string, postId: string) {
  const res = await apiClient.get(`${base(orgId)}/boards/${boardId}/posts/${postId}/reactions`);
  return res.data.data;
}

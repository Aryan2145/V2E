// ─── Announcements ────────────────────────────────────────────────────────────

export type AnnouncementType = 'general' | 'policy' | 'event' | 'emergency';
export type AnnouncementPriority = 'normal' | 'high' | 'urgent';
export type CommunicationScope = 'org_wide' | 'department' | 'role_based';
export type BoardInteractionMode = 'read_only' | 'comments_only' | 'comments_and_reactions';
export type ConversationType = 'direct' | 'group';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  priority: AnnouncementPriority;
  scope: CommunicationScope;
  is_pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  attachment_urls: { name: string; url: string }[];
  created_by_user_id: string;
  department_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: UserSummary;
  department: { id: string; name: string } | null;
  _count: { reads: number };
  reads?: { read_at: string }[];
}

// ─── Bulletin ─────────────────────────────────────────────────────────────────

export interface BulletinBoard {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  scope: CommunicationScope;
  interaction_mode: BoardInteractionMode;
  is_active: boolean;
  department_id?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  department: { id: string; name: string } | null;
  created_by: { id: string; name: string; email: string };
  _count: { posts: number };
}

export interface BulletinPost {
  id: string;
  bulletin_board_id: string;
  organization_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  attachment_urls: { name: string; url: string }[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  created_by: { id: string; name: string; email: string };
  _count?: { comments: number; reactions: number };
  comments?: BulletinComment[];
  reactions?: { emoji: string; user_id: string }[];
}

export interface BulletinComment {
  id: string;
  bulletin_post_id: string;
  body: string;
  created_by_user_id: string;
  created_at: string;
  created_by: { id: string; name: string; email: string };
}

// ─── Knowledge ────────────────────────────────────────────────────────────────

export interface KnowledgePost {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  scope: CommunicationScope;
  tags: string[];
  is_pinned: boolean;
  attachment_urls: { name: string; url: string }[];
  created_by_user_id: string;
  department_id?: string;
  created_at: string;
  updated_at: string;
  created_by: UserSummary;
  department: { id: string; name: string } | null;
  _count: { comments: number };
  reactions?: { emoji: string; user_id: string }[];
  comments?: KnowledgeComment[];
}

export interface KnowledgeComment {
  id: string;
  knowledge_post_id: string;
  body: string;
  parent_comment_id?: string;
  created_by_user_id: string;
  created_at: string;
  created_by: UserSummary;
  replies?: KnowledgeComment[];
}

// ─── Messaging ────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  organization_id: string;
  type: ConversationType;
  name?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  messages?: Message[];
  display_name?: string;
  last_message?: Message | null;
  unread_count?: number;
  my_membership?: ConversationMember;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  organization_id: string;
  role: string;
  last_read_at: string;
  joined_at: string;
  user: UserSummary;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  organization_id: string;
  body: string;
  is_deleted: boolean;
  attachment_urls: { name: string; url: string }[];
  reply_to_message_id?: string;
  created_at: string;
  updated_at: string;
  sender: UserSummary;
  reply_to_message?: {
    id: string;
    body: string;
    sender: UserSummary;
  } | null;
}

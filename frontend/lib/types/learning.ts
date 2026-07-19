export type ContentType = 'video' | 'document' | 'url' | 'article' | 'file';
export type LearningPathStatus = 'draft' | 'published' | 'archived';
export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed';
export type SequentialMode = 'sequential' | 'free_form';
export type CompletionType = 'manual' | 'auto_opened';
export type LearningPreviewStatus = 'none' | 'pending' | 'ready' | 'failed';
export type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'none';

export interface LearningPath {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  status: LearningPathStatus;
  mode: SequentialMode;
  role_id?: string;
  created_by_user_id: string;
  estimated_minutes?: number;
  created_at: string;
  updated_at: string;
  items?: LearningItem[];
  _count?: { items: number; assignments: number };
}

export interface LearningItem {
  id: string;
  path_id: string;
  title: string;
  description?: string;
  content_type: ContentType;
  content_url?: string;
  content_body?: string;
  order_index: number;
  estimated_minutes?: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
  is_locked?: boolean;
  progress?: LearningItemProgress;
  // Uploaded-file fields (content_type = 'file')
  file_name?: string | null;
  file_mime?: string | null;
  file_size_bytes?: number | null;
  preview_status?: LearningPreviewStatus;
  allow_download?: boolean;
}

/** Signed inline-preview payload for a material (creator or learner). */
export interface MaterialViewData {
  kind: PreviewKind;
  url: string | null;
  allow_download: boolean;
  file_name?: string | null;
  preview_status?: LearningPreviewStatus;
}

export interface LearningPathAssignment {
  id: string;
  path_id: string;
  employee_profile_id: string;
  assigned_by_user_id: string;
  assigned_at: string;
  due_date?: string;
  status: AssignmentStatus;
  completed_at?: string;
  path?: LearningPath;
  path_progress?: LearningPathProgress;
  items?: LearningItem[];
}

export interface LearningItemProgress {
  id: string;
  assignment_id: string;
  item_id: string;
  employee_profile_id: string;
  status: AssignmentStatus;
  completion_type?: CompletionType;
  started_at?: string;
  completed_at?: string;
}

export interface LearningPathProgress {
  id: string;
  assignment_id: string;
  employee_profile_id: string;
  path_id: string;
  total_items: number;
  completed_items: number;
  progress_percent: number;
  last_activity_at: string;
}

export interface OrgProgressSummary {
  total_paths: number;
  total_assignments: number;
  completed_assignments: number;
  in_progress_assignments: number;
  not_started_assignments: number;
  avg_progress_percent: number;
  paths: PathProgressSummary[];
}

export interface PathProgressSummary {
  path_id: string;
  title: string;
  status: LearningPathStatus;
  total_assignments: number;
  completed: number;
  in_progress: number;
  not_started: number;
  avg_percent: number;
}

// ─── Engagement analytics (who accessed what) ────────────────────────────────

export interface EngagementItemStat {
  item_id: string;
  title: string;
  content_type: ContentType;
  assigned: number;
  viewed: number;
  total_opens: number;
  completed: number;
}

export interface EngagementLearnerItem {
  item_id: string;
  viewed: boolean;
  views: number;
  last_viewed_at: string | null;
  completed: boolean;
}

export interface EngagementLearner {
  employee_profile_id: string;
  name: string;
  email: string | null;
  role: string | null;
  status: AssignmentStatus;
  items: EngagementLearnerItem[];
  opened_count: number;
  completed_count: number;
}

export interface PathEngagement {
  path_id: string;
  title: string;
  total_items: number;
  total_assigned: number;
  items: EngagementItemStat[];
  learners: EngagementLearner[];
}

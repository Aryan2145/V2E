export type ContentType = 'video' | 'document' | 'url' | 'article';
export type LearningPathStatus = 'draft' | 'published' | 'archived';
export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed';
export type SequentialMode = 'sequential' | 'free_form';
export type CompletionType = 'manual' | 'auto_opened';

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

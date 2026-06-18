-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'inactive', 'pending_setup');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('org_admin', 'hr_manager', 'employee');

-- CreateEnum
CREATE TYPE "BehaviorType" AS ENUM ('expected_behavior', 'unacceptable_behavior');

-- CreateEnum
CREATE TYPE "RoleLevel" AS ENUM ('junior', 'mid', 'senior', 'lead', 'head');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('active', 'inactive', 'on_leave');

-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('announcement', 'circular');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('normal', 'important', 'urgent');

-- CreateEnum
CREATE TYPE "CommunicationScope" AS ENUM ('company_wide', 'department');

-- CreateEnum
CREATE TYPE "BoardInteractionMode" AS ENUM ('read_only', 'comments_only', 'comments_and_reactions');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('direct', 'group');

-- CreateEnum
CREATE TYPE "ChatMemberRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('video', 'document', 'url', 'article');

-- CreateEnum
CREATE TYPE "LearningPathStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SequentialMode" AS ENUM ('sequential', 'free_form');

-- CreateEnum
CREATE TYPE "CompletionType" AS ENUM ('manual', 'auto_opened');

-- CreateEnum
CREATE TYPE "TaskQuadrant" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('one_time', 'recurring');

-- CreateEnum
CREATE TYPE "CompletionMode" AS ENUM ('all_must_complete', 'any_can_complete');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('assignee', 'assigner', 'cc');

-- CreateEnum
CREATE TYPE "TaskActionType" AS ENUM ('created', 'edited', 'assigned', 'reassigned', 'status_changed', 'completed', 'reopened', 'proof_attached', 'checklist_updated', 'escalated', 'reminder_sent', 'deleted', 'comment_added', 'comment_deleted', 'file_attached');

-- CreateEnum
CREATE TYPE "RecurringScheduleType" AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "RecurringEndCondition" AS ENUM ('never', 'on_date', 'after_n');

-- CreateEnum
CREATE TYPE "AssigneeExceptionScope" AS ENUM ('user', 'role', 'department');

-- CreateEnum
CREATE TYPE "AssigneeExceptionKind" AS ENUM ('widen', 'narrow');

-- CreateEnum
CREATE TYPE "BridgeDepth" AS ENUM ('head_senior', 'whole_dept');

-- CreateEnum
CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "WorkflowNature" AS ENUM ('one_time', 'recurring');

-- CreateEnum
CREATE TYPE "WorkflowRecurringType" AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "WorkflowAssigneeType" AS ENUM ('fixed_person', 'role');

-- CreateEnum
CREATE TYPE "WorkflowOverdueAction" AS ENUM ('block_next', 'proceed_anyway', 'trigger_branch');

-- CreateEnum
CREATE TYPE "WorkflowAccessType" AS ENUM ('view', 'edit', 'trigger');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('running', 'completed', 'stuck', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('pending', 'active', 'completed', 'overdue', 'skipped', 'branched');

-- CreateEnum
CREATE TYPE "WorkflowDefaultOverdue" AS ENUM ('block_next', 'proceed_anyway');

-- CreateEnum
CREATE TYPE "TicketStatusType" AS ENUM ('open', 'assigned', 'in_progress', 'resolved', 'closed_resolved', 'closed_unresolved');

-- CreateEnum
CREATE TYPE "TicketTemplateType" AS ENUM ('full', 'simple');

-- CreateEnum
CREATE TYPE "TicketReassignmentMode" AS ENUM ('assignee_only', 'admin_manager_only', 'both');

-- CreateEnum
CREATE TYPE "TicketActivityAction" AS ENUM ('created', 'assigned', 'reassigned', 'status_changed', 'accepted', 'resolved', 'closed', 'reopened', 'escalated', 'comment_added', 'comment_deleted', 'proof_attached', 'checklist_updated', 'rating_submitted', 'deleted', 'sla_breached', 'confirmation_requested', 'raiser_confirmed');

-- CreateEnum
CREATE TYPE "HolidayOnTaskAction" AS ENUM ('skip_create', 'create_anyway', 'move_to_prev_working_day', 'move_to_next_working_day');

-- CreateEnum
CREATE TYPE "HolidayPriorityLevel" AS ENUM ('individual_first', 'department_first', 'org_first');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('national', 'company', 'regional', 'team', 'personal', 'leave');

-- CreateEnum
CREATE TYPE "HolidayStatus" AS ENUM ('active', 'pending_review');

-- CreateEnum
CREATE TYPE "HolidayAuditAction" AS ENUM ('moved_forward', 'moved_backward', 'skipped', 'created_anyway');

-- CreateEnum
CREATE TYPE "HolidayEntityType" AS ENUM ('task', 'recurring_task', 'workflow_step', 'ticket');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'on_hold', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('manager', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "TaskVisibility" AS ENUM ('own_tasks_only', 'all_member_tasks');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('pending', 'in_progress', 'achieved');

-- CreateEnum
CREATE TYPE "ProjectActivityAction" AS ENUM ('created', 'member_added', 'member_removed', 'member_role_changed', 'status_changed', 'milestone_created', 'milestone_achieved', 'task_added', 'task_completed', 'task_removed', 'dependency_added', 'dependency_removed', 'comment_added', 'document_added', 'budget_updated', 'template_applied', 'deleted');

-- CreateEnum
CREATE TYPE "CompanyPolicyStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "PolicyAssignmentStatus" AS ENUM ('not_started', 'acknowledged');

-- CreateEnum
CREATE TYPE "NotificationModule" AS ENUM ('tasks', 'projects', 'workflows', 'tickets', 'communication', 'system', 'meetings', 'work_logs');

-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('read', 'write', 'edit', 'delete');

-- CreateEnum
CREATE TYPE "GoalLevel" AS ENUM ('objective', 'annual', 'quarterly');

-- CreateEnum
CREATE TYPE "GoalPerspective" AS ENUM ('financial', 'customer', 'internal_process', 'learning_growth');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('not_started', 'on_track', 'at_risk', 'achieved', 'archived');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('online', 'offline', 'hybrid');

-- CreateEnum
CREATE TYPE "MeetingMode" AS ENUM ('fixed', 'poll');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('polling', 'scheduled', 'in_progress', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "MeetingLinkType" AS ENUM ('goal', 'project', 'task', 'ticket');

-- CreateEnum
CREATE TYPE "MeetingAttendeeResponse" AS ENUM ('pending', 'accepted', 'rejected', 'reschedule_requested');

-- CreateEnum
CREATE TYPE "MeetingSlotSource" AS ENUM ('caller', 'invitee', 'system');

-- CreateEnum
CREATE TYPE "MeetingVote" AS ENUM ('available', 'unavailable', 'maybe');

-- CreateTable
CREATE TABLE "organization_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'pending_setup',
    "group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "sim_epoch" TIMESTAMP(3),
    "sim_anchor" TIMESTAMP(3),
    "sim_replayed_until" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_identities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "philosophy" TEXT,
    "vision" TEXT,
    "mission" TEXT,
    "purpose" TEXT,
    "values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culture_standards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "BehaviorType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "culture_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parent_department_id" TEXT,
    "head_user_id" TEXT,
    "position_x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position_y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignee_allow_upward" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "job_description" TEXT,
    "kra" JSONB,
    "kpi" JSONB,
    "level" "RoleLevel" NOT NULL DEFAULT 'mid',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_profiles" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "reporting_to_user_id" TEXT,
    "employee_code" TEXT,
    "date_of_joining" TIMESTAMP(3),
    "date_of_birth" TIMESTAMP(3),
    "marriage_date" TIMESTAMP(3),
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'full_time',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "status" "LearningPathStatus" NOT NULL DEFAULT 'draft',
    "mode" "SequentialMode" NOT NULL DEFAULT 'free_form',
    "role_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "estimated_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_items" (
    "id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content_type" "ContentType" NOT NULL,
    "content_url" TEXT,
    "content_body" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "estimated_minutes" INTEGER,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_assignments" (
    "id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'not_started',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "learning_path_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_item_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'not_started',
    "completion_type" "CompletionType",
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "learning_item_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_progress" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "path_id" TEXT NOT NULL,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "completed_items" INTEGER NOT NULL DEFAULT 0,
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_path_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "AnnouncementType" NOT NULL DEFAULT 'announcement',
    "scope" "CommunicationScope" NOT NULL DEFAULT 'company_wide',
    "department_id" TEXT,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'normal',
    "published_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "attachment_urls" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin_boards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "CommunicationScope" NOT NULL DEFAULT 'company_wide',
    "department_id" TEXT,
    "interaction_mode" "BoardInteractionMode" NOT NULL DEFAULT 'comments_and_reactions',
    "created_by_user_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletin_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bulletin_board_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletin_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bulletin_post_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletin_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulletin_reactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "bulletin_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulletin_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_posts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "scope" "CommunicationScope" NOT NULL DEFAULT 'company_wide',
    "department_id" TEXT,
    "tags" JSONB,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "attachment_urls" JSONB,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_post_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_reactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "knowledge_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "avatar_url" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ChatMemberRole" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB,
    "reply_to_message_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_creation_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager","employee"]',
    "task_edit_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager"]',
    "task_delete_roles" JSONB NOT NULL DEFAULT '["org_admin"]',
    "default_reminder_days_before" INTEGER NOT NULL DEFAULT 1,
    "default_reminder_frequency" TEXT NOT NULL DEFAULT 'once',
    "reopen_window_minutes" INTEGER NOT NULL DEFAULT 10,
    "escalation_levels" INTEGER NOT NULL DEFAULT 2,
    "archive_view_roles" JSONB NOT NULL DEFAULT '["org_admin"]',
    "assignee_visibility_mode" TEXT NOT NULL DEFAULT 'hierarchy_and_dept',
    "assignee_custom_rules" JSONB,
    "assignee_visibility_config_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager"]',
    "assignee_master_override" BOOLEAN NOT NULL DEFAULT false,
    "assignee_full_visibility_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager"]',
    "assignee_full_visibility_users" JSONB NOT NULL DEFAULT '[]',
    "assignee_exclude_departments" JSONB NOT NULL DEFAULT '[]',
    "assignee_exclude_roles" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignee_visibility_exceptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope" "AssigneeExceptionScope" NOT NULL,
    "scope_user_id" TEXT,
    "scope_role" TEXT,
    "scope_department_id" TEXT,
    "kind" "AssigneeExceptionKind" NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignee_visibility_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignee_visibility_exception_members" (
    "id" TEXT NOT NULL,
    "exception_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "assignee_visibility_exception_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignee_cross_dept_bridges" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_department_id" TEXT NOT NULL,
    "to_department_id" TEXT NOT NULL,
    "depth" "BridgeDepth" NOT NULL DEFAULT 'head_senior',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignee_cross_dept_bridges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignee_visibility_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" JSONB,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignee_visibility_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#2563EB',
    "created_by_user_id" TEXT NOT NULL,
    "visible_to_departments" JSONB NOT NULL DEFAULT '[]',
    "visible_to_roles" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_priorities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563EB',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#2563EB',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "priority_id" TEXT,
    "status_id" TEXT NOT NULL,
    "quadrant" "TaskQuadrant" NOT NULL DEFAULT 'Q2',
    "type" "TaskType" NOT NULL DEFAULT 'one_time',
    "created_by_user_id" TEXT NOT NULL,
    "department_id" TEXT,
    "completion_mode" "CompletionMode" NOT NULL DEFAULT 'any_can_complete',
    "proof_required" BOOLEAN NOT NULL DEFAULT false,
    "proof_url" TEXT,
    "proof_submitted_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopen_expires_at" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "recurring_template_id" TEXT,
    "workflow_instance_step_id" TEXT,
    "goal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "is_cc" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_checklist_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "remind_at" TIMESTAMP(3) NOT NULL,
    "type" "ReminderType" NOT NULL DEFAULT 'assignee',
    "is_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_escalations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "escalate_to_user_id" TEXT NOT NULL,
    "escalated_at" TIMESTAMP(3),
    "is_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activity_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "performed_by_user_id" TEXT NOT NULL,
    "action" "TaskActionType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB,
    "reply_to_comment_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quadrant" "TaskQuadrant" NOT NULL DEFAULT 'Q2',
    "category_id" TEXT,
    "priority_id" TEXT,
    "has_multiple_schedules" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "completion_mode" "CompletionMode" NOT NULL DEFAULT 'any_can_complete',
    "proof_required" BOOLEAN NOT NULL DEFAULT false,
    "assignee_user_ids" JSONB NOT NULL DEFAULT '[]',
    "cc_user_ids" JSONB NOT NULL DEFAULT '[]',
    "department_id" TEXT,
    "linked_goal_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_schedule_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "recurring_template_id" TEXT NOT NULL,
    "schedule_type" "RecurringScheduleType" NOT NULL,
    "every" INTEGER NOT NULL DEFAULT 1,
    "days" JSONB NOT NULL DEFAULT '[]',
    "month_days" JSONB NOT NULL DEFAULT '[]',
    "yearly_dates" JSONB NOT NULL DEFAULT '[]',
    "time" TEXT NOT NULL DEFAULT '09:00',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_condition" "RecurringEndCondition" NOT NULL DEFAULT 'never',
    "end_date" TIMESTAMP(3),
    "end_after" INTEGER,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_archives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "original_task_id" TEXT NOT NULL,
    "task_snapshot" JSONB NOT NULL,
    "deleted_by_user_id" TEXT NOT NULL,
    "deletion_reason" TEXT,
    "deleted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignee_frequencies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "assigner_user_id" TEXT NOT NULL,
    "assignee_user_id" TEXT NOT NULL,
    "frequency_count" INTEGER NOT NULL DEFAULT 1,
    "last_assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_assignee_frequencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_creation_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager"]',
    "default_overdue_action" "WorkflowDefaultOverdue" NOT NULL DEFAULT 'block_next',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_ids" JSONB NOT NULL DEFAULT '[]',
    "created_by_user_id" TEXT NOT NULL,
    "status" "WorkflowTemplateStatus" NOT NULL DEFAULT 'draft',
    "show_workflow_on_task_card" BOOLEAN NOT NULL DEFAULT true,
    "workflow_nature" "WorkflowNature" NOT NULL DEFAULT 'one_time',
    "recurring_type" "WorkflowRecurringType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_template_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignee_type" "WorkflowAssigneeType" NOT NULL DEFAULT 'fixed_person',
    "assignee_user_id" TEXT,
    "assignee_role" TEXT,
    "assigner_user_id" TEXT NOT NULL,
    "deadline_config" JSONB NOT NULL,
    "proof_required" BOOLEAN NOT NULL DEFAULT false,
    "priority_id" TEXT,
    "category_id" TEXT,
    "checklist_items" JSONB NOT NULL DEFAULT '[]',
    "if_overdue_action" "WorkflowOverdueAction" NOT NULL DEFAULT 'block_next',
    "branch_step_id" TEXT,
    "is_branch_step" BOOLEAN NOT NULL DEFAULT false,
    "parent_branch_step_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_template_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_access" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_type" "WorkflowAccessType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instances" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "triggered_by_user_id" TEXT,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "current_step_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_instance_steps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_instance_id" TEXT NOT NULL,
    "workflow_step_id" TEXT NOT NULL,
    "task_id" TEXT,
    "assigned_to_user_id" TEXT NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMP(3),
    "task_created_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "branch_taken" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_instance_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_round_robin_trackers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_template_id" TEXT NOT NULL,
    "workflow_step_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "last_assigned_user_id" TEXT NOT NULL,
    "assignment_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_round_robin_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_instance_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_creation_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager","employee"]',
    "reassignment_mode" "TicketReassignmentMode" NOT NULL DEFAULT 'both',
    "require_raiser_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "enable_rating" BOOLEAN NOT NULL DEFAULT false,
    "default_escalation_levels" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_types" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "default_sla_days" INTEGER NOT NULL,
    "auto_assign_user_id" TEXT,
    "auto_assign_role" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_categories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL,
    "ticket_type_id" TEXT,
    "default_sla_days" INTEGER,
    "auto_assign_user_id" TEXT,
    "auto_assign_role" TEXT,
    "visible_to_departments" JSONB NOT NULL DEFAULT '[]',
    "visible_to_roles" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_priorities" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sla_days" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_type" "TicketTemplateType" NOT NULL DEFAULT 'simple',
    "ticket_type_id" TEXT,
    "category_id" TEXT,
    "priority_id" TEXT,
    "title_template" TEXT NOT NULL,
    "description_template" TEXT,
    "auto_assign_user_id" TEXT,
    "auto_assign_role" TEXT,
    "sla_days" INTEGER,
    "checklist_items" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_statuses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "TicketStatusType" NOT NULL,
    "color" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ticket_type_id" TEXT NOT NULL,
    "category_id" TEXT,
    "priority_id" TEXT,
    "status_id" TEXT NOT NULL,
    "template_id" TEXT,
    "raised_by_user_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "assigned_at" TIMESTAMP(3),
    "sla_days" INTEGER NOT NULL,
    "sla_due_at" TIMESTAMP(3) NOT NULL,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "accepted_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "requires_raiser_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "raiser_confirmed_at" TIMESTAMP(3),
    "rating" INTEGER,
    "rating_comment" TEXT,
    "rated_at" TIMESTAMP(3),
    "proof_required" BOOLEAN NOT NULL DEFAULT false,
    "proof_url" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_checklists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_escalations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "escalate_to_user_id" TEXT NOT NULL,
    "escalated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_archives" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "original_ticket_id" TEXT NOT NULL,
    "raised_by_user_id" TEXT NOT NULL,
    "ticket_snapshot" JSONB NOT NULL,
    "deleted_by_user_id" TEXT NOT NULL,
    "deletion_reason" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_activity_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "performed_by_user_id" TEXT NOT NULL,
    "action" "TicketActivityAction" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB NOT NULL DEFAULT '[]',
    "reply_to_comment_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_round_robin_trackers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "last_assigned_user_id" TEXT NOT NULL,
    "assignment_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_round_robin_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "country_code" TEXT,
    "holiday_on_task_action" "HolidayOnTaskAction" NOT NULL DEFAULT 'move_to_next_working_day',
    "priority_level" "HolidayPriorityLevel" NOT NULL DEFAULT 'individual_first',
    "pending_review_deadline_days" INTEGER NOT NULL DEFAULT 7,
    "auto_apply_if_not_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "org_holiday_manage_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager"]',
    "dept_holiday_manage_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager","manager"]',
    "individual_holiday_manage_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_working_days" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "working_days" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_working_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_holidays" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "HolidayType" NOT NULL,
    "source" TEXT,
    "is_recurring_yearly" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "status" "HolidayStatus" NOT NULL DEFAULT 'active',
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "entity_type" "HolidayEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_title" TEXT NOT NULL,
    "original_date" DATE NOT NULL,
    "adjusted_date" DATE,
    "action_taken" "HolidayAuditAction" NOT NULL,
    "holiday_name" TEXT NOT NULL,
    "holiday_date" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_working_days" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "working_days" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_working_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_holidays" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "HolidayType" NOT NULL,
    "is_recurring_yearly" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "status" "HolidayStatus" NOT NULL DEFAULT 'active',
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_working_days" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "working_days" JSONB NOT NULL DEFAULT '[1,2,3,4,5]',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_working_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "individual_holidays" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "HolidayType" NOT NULL,
    "is_recurring_yearly" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "individual_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_creation_roles" JSONB NOT NULL DEFAULT '["org_admin","hr_manager","employee"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_template_milestones" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_template_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_template_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_template_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority_id" TEXT,
    "checklist_items" JSONB NOT NULL DEFAULT '[]',
    "default_assignee_user_id" TEXT,
    "default_assignee_role" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "estimated_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_template_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "status_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "project_manager_user_id" TEXT NOT NULL,
    "template_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "planned_budget" DOUBLE PRECISION,
    "actual_spent" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "completion_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "total_milestones" INTEGER NOT NULL DEFAULT 0,
    "achieved_milestones" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'viewer',
    "task_visibility" "TaskVisibility" NOT NULL DEFAULT 'own_tasks_only',
    "added_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "due_date" DATE,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'pending',
    "achieved_at" TIMESTAMP(3),
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "completion_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "task_id" TEXT,
    "template_task_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_task_dependencies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "depends_on_task_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_task_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_comments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB NOT NULL DEFAULT '[]',
    "reply_to_comment_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_activity_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "performed_by_user_id" TEXT NOT NULL,
    "action" "ProjectActivityAction" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_policies" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "CompanyPolicyStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_policy_items" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "content_type" "ContentType" NOT NULL,
    "content_url" TEXT,
    "content_body" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_policy_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_policy_assignments" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "employee_profile_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PolicyAssignmentStatus" NOT NULL DEFAULT 'not_started',
    "acknowledged_at" TIMESTAMP(3),

    CONSTRAINT "company_policy_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module" "NotificationModule" NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_masters" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_toggles" JSONB NOT NULL DEFAULT '{}',
    "overdue_followup_days" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_rights" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "resource" TEXT NOT NULL,
    "can_read" BOOLEAN NOT NULL DEFAULT false,
    "can_write" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_rights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_label" TEXT,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "level" "GoalLevel" NOT NULL,
    "parent_goal_id" TEXT,
    "perspective" "GoalPerspective",
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "department_id" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'not_started',
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "deletion_reason" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_measures" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_value" TEXT NOT NULL,
    "current_value" TEXT,
    "unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_measures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "online_link" TEXT,
    "online_password" TEXT,
    "location" TEXT,
    "mode" "MeetingMode" NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'scheduled',
    "link_type" "MeetingLinkType",
    "link_entity_id" TEXT,
    "agenda" TEXT,
    "minutes" TEXT,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "poll_window_start" TIMESTAMP(3),
    "poll_window_end" TIMESTAMP(3),
    "poll_duration_min" INTEGER,
    "created_by_user_id" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "deletion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_attendees" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_organizer" BOOLEAN NOT NULL DEFAULT false,
    "response" "MeetingAttendeeResponse" NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "reschedule_at" TIMESTAMP(3),
    "reschedule_note" TEXT,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attended_in_at" TIMESTAMP(3),
    "attended_out_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_slots" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "source" "MeetingSlotSource" NOT NULL,
    "proposed_by_user_id" TEXT,
    "system_rank" INTEGER,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_slot_votes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "vote" "MeetingVote" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_slot_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_action_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "due_date" TIMESTAMP(3),
    "linked_task_id" TEXT,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_decisions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "decided_on" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "affects_link_type" "MeetingLinkType",
    "affects_entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_private_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_private_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_updates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "stuck" TEXT,
    "decisions" TEXT,
    "day_summary" TEXT,
    "planning_tomorrow" TEXT,
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "daily_update_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_log_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_demands" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigner_user_id" TEXT NOT NULL,
    "assignee_user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_demand_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "schedule_type" "RecurringScheduleType" NOT NULL,
    "every" INTEGER NOT NULL DEFAULT 1,
    "days" JSONB NOT NULL DEFAULT '[]',
    "month_days" JSONB NOT NULL DEFAULT '[]',
    "yearly_dates" JSONB NOT NULL DEFAULT '[]',
    "time" TEXT NOT NULL DEFAULT '09:00',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_condition" "RecurringEndCondition" NOT NULL DEFAULT 'never',
    "end_date" TIMESTAMP(3),
    "end_after" INTEGER,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_demand_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_submissions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "demand_id" TEXT NOT NULL,
    "writer_user_id" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "period_label" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3),
    "daily_update_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_log_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_remarks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_urls" JSONB,
    "reply_to_remark_id" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_reader_grants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "reader_user_id" TEXT NOT NULL,
    "writer_user_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_log_reader_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_settings" (
    "organization_id" TEXT NOT NULL,
    "managers_read_reports" BOOLEAN NOT NULL DEFAULT true,
    "writer_user_ids" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_settings_pkey" PRIMARY KEY ("organization_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_groups_slug_key" ON "organization_groups"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "org_identities_organization_id_key" ON "org_identities"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_profiles_organization_id_user_id_key" ON "employee_profiles"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_assignments_path_id_employee_profile_id_key" ON "learning_path_assignments"("path_id", "employee_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_item_progress_assignment_id_item_id_key" ON "learning_item_progress"("assignment_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_progress_assignment_id_key" ON "learning_path_progress"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_user_id_key" ON "announcement_reads"("announcement_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bulletin_reactions_bulletin_post_id_user_id_emoji_key" ON "bulletin_reactions"("bulletin_post_id", "user_id", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_reactions_knowledge_post_id_user_id_emoji_key" ON "knowledge_reactions"("knowledge_post_id", "user_id", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_members_conversation_id_user_id_key" ON "conversation_members"("conversation_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_masters_organization_id_key" ON "task_masters"("organization_id");

-- CreateIndex
CREATE INDEX "assignee_visibility_exceptions_organization_id_scope_idx" ON "assignee_visibility_exceptions"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "assignee_visibility_exception_members_exception_id_idx" ON "assignee_visibility_exception_members"("exception_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignee_visibility_exception_members_exception_id_user_id_key" ON "assignee_visibility_exception_members"("exception_id", "user_id");

-- CreateIndex
CREATE INDEX "assignee_cross_dept_bridges_organization_id_from_department_idx" ON "assignee_cross_dept_bridges"("organization_id", "from_department_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignee_cross_dept_bridges_organization_id_from_department_key" ON "assignee_cross_dept_bridges"("organization_id", "from_department_id", "to_department_id");

-- CreateIndex
CREATE INDEX "assignee_visibility_audit_logs_organization_id_created_at_idx" ON "assignee_visibility_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "tasks_goal_id_idx" ON "tasks"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignees_task_id_user_id_key" ON "task_assignees"("task_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_assignee_frequencies_organization_id_assigner_user_id__key" ON "task_assignee_frequencies"("organization_id", "assigner_user_id", "assignee_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_masters_organization_id_key" ON "workflow_masters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_access_workflow_template_id_user_id_access_type_key" ON "workflow_access"("workflow_template_id", "user_id", "access_type");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_round_robin_trackers_workflow_template_id_workflow_key" ON "workflow_round_robin_trackers"("workflow_template_id", "workflow_step_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_masters_organization_id_key" ON "ticket_masters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_organization_id_ticket_number_key" ON "tickets"("organization_id", "ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_round_robin_trackers_scope_type_scope_id_role_key" ON "ticket_round_robin_trackers"("scope_type", "scope_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_masters_organization_id_key" ON "holiday_masters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_working_days_organization_id_key" ON "org_working_days"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_working_days_organization_id_department_id_key" ON "department_working_days"("organization_id", "department_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_masters_organization_id_key" ON "project_masters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_task_dependencies_task_id_depends_on_task_id_key" ON "project_task_dependencies"("task_id", "depends_on_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_policy_assignments_policy_id_employee_profile_id_key" ON "company_policy_assignments"("policy_id", "employee_profile_id");

-- CreateIndex
CREATE INDEX "notifications_organization_id_user_id_is_read_idx" ON "notifications"("organization_id", "user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_organization_id_user_id_created_at_idx" ON "notifications"("organization_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_user_id_event_type_entity_id_idx" ON "notifications"("organization_id", "user_id", "event_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_masters_organization_id_key" ON "notification_masters"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_organization_id_user_id_idx" ON "push_subscriptions"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_rights_organization_id_role_resource_key" ON "access_rights"("organization_id", "role", "resource");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_resource_created_at_idx" ON "audit_logs"("organization_id", "resource", "created_at");

-- CreateIndex
CREATE INDEX "goals_organization_id_level_idx" ON "goals"("organization_id", "level");

-- CreateIndex
CREATE INDEX "goals_parent_goal_id_idx" ON "goals"("parent_goal_id");

-- CreateIndex
CREATE INDEX "goal_measures_goal_id_idx" ON "goal_measures"("goal_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_status_scheduled_start_idx" ON "meetings"("organization_id", "status", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_attendees_meeting_id_user_id_key" ON "meeting_attendees"("meeting_id", "user_id");

-- CreateIndex
CREATE INDEX "meeting_slots_meeting_id_idx" ON "meeting_slots"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_slot_votes_slot_id_user_id_key" ON "meeting_slot_votes"("slot_id", "user_id");

-- CreateIndex
CREATE INDEX "meeting_action_items_organization_id_owner_user_id_idx" ON "meeting_action_items"("organization_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "meeting_decisions_organization_id_decided_on_idx" ON "meeting_decisions"("organization_id", "decided_on");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_private_notes_meeting_id_user_id_key" ON "meeting_private_notes"("meeting_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_updates_organization_id_user_id_log_date_key" ON "daily_updates"("organization_id", "user_id", "log_date");

-- CreateIndex
CREATE UNIQUE INDEX "work_log_submissions_demand_id_due_date_key" ON "work_log_submissions"("demand_id", "due_date");

-- CreateIndex
CREATE INDEX "work_log_remarks_organization_id_target_type_target_id_idx" ON "work_log_remarks"("organization_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_log_reader_grants_organization_id_reader_user_id_write_key" ON "work_log_reader_grants"("organization_id", "reader_user_id", "writer_user_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "organization_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_identities" ADD CONSTRAINT "org_identities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culture_standards" ADD CONSTRAINT "culture_standards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_department_id_fkey" FOREIGN KEY ("parent_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_reporting_to_user_id_fkey" FOREIGN KEY ("reporting_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_items" ADD CONSTRAINT "learning_items_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_assignments" ADD CONSTRAINT "learning_path_assignments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_assignments" ADD CONSTRAINT "learning_path_assignments_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_item_progress" ADD CONSTRAINT "learning_item_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "learning_path_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_item_progress" ADD CONSTRAINT "learning_item_progress_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "learning_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_progress" ADD CONSTRAINT "learning_path_progress_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "learning_path_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_boards" ADD CONSTRAINT "bulletin_boards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_boards" ADD CONSTRAINT "bulletin_boards_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_boards" ADD CONSTRAINT "bulletin_boards_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_posts" ADD CONSTRAINT "bulletin_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_posts" ADD CONSTRAINT "bulletin_posts_bulletin_board_id_fkey" FOREIGN KEY ("bulletin_board_id") REFERENCES "bulletin_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_posts" ADD CONSTRAINT "bulletin_posts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_comments" ADD CONSTRAINT "bulletin_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_comments" ADD CONSTRAINT "bulletin_comments_bulletin_post_id_fkey" FOREIGN KEY ("bulletin_post_id") REFERENCES "bulletin_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_comments" ADD CONSTRAINT "bulletin_comments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_reactions" ADD CONSTRAINT "bulletin_reactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_reactions" ADD CONSTRAINT "bulletin_reactions_bulletin_post_id_fkey" FOREIGN KEY ("bulletin_post_id") REFERENCES "bulletin_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulletin_reactions" ADD CONSTRAINT "bulletin_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_posts" ADD CONSTRAINT "knowledge_posts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_posts" ADD CONSTRAINT "knowledge_posts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_posts" ADD CONSTRAINT "knowledge_posts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_comments" ADD CONSTRAINT "knowledge_comments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_comments" ADD CONSTRAINT "knowledge_comments_knowledge_post_id_fkey" FOREIGN KEY ("knowledge_post_id") REFERENCES "knowledge_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_comments" ADD CONSTRAINT "knowledge_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "knowledge_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_comments" ADD CONSTRAINT "knowledge_comments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_reactions" ADD CONSTRAINT "knowledge_reactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_reactions" ADD CONSTRAINT "knowledge_reactions_knowledge_post_id_fkey" FOREIGN KEY ("knowledge_post_id") REFERENCES "knowledge_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_reactions" ADD CONSTRAINT "knowledge_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_message_id_fkey" FOREIGN KEY ("reply_to_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignee_visibility_exception_members" ADD CONSTRAINT "assignee_visibility_exception_members_exception_id_fkey" FOREIGN KEY ("exception_id") REFERENCES "assignee_visibility_exceptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "task_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "task_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "task_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_checklists" ADD CONSTRAINT "task_checklists_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_reminders" ADD CONSTRAINT "task_reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_escalations" ADD CONSTRAINT "task_escalations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity_logs" ADD CONSTRAINT "task_activity_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_reply_to_comment_id_fkey" FOREIGN KEY ("reply_to_comment_id") REFERENCES "task_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_schedule_entries" ADD CONSTRAINT "recurring_schedule_entries_recurring_template_id_fkey" FOREIGN KEY ("recurring_template_id") REFERENCES "recurring_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_access" ADD CONSTRAINT "workflow_access_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_instance_steps" ADD CONSTRAINT "workflow_instance_steps_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_round_robin_trackers" ADD CONSTRAINT "workflow_round_robin_trackers_workflow_template_id_fkey" FOREIGN KEY ("workflow_template_id") REFERENCES "workflow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_notifications" ADD CONSTRAINT "workflow_notifications_workflow_instance_id_fkey" FOREIGN KEY ("workflow_instance_id") REFERENCES "workflow_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_templates" ADD CONSTRAINT "ticket_templates_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "ticket_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "ticket_priorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "ticket_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ticket_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_checklists" ADD CONSTRAINT "ticket_checklists_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_escalations" ADD CONSTRAINT "ticket_escalations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_activity_logs" ADD CONSTRAINT "ticket_activity_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_reply_to_comment_id_fkey" FOREIGN KEY ("reply_to_comment_id") REFERENCES "ticket_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_template_milestones" ADD CONSTRAINT "project_template_milestones_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_template_tasks" ADD CONSTRAINT "project_template_tasks_project_template_id_fkey" FOREIGN KEY ("project_template_id") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_template_tasks" ADD CONSTRAINT "project_template_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_template_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "project_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_task_dependencies" ADD CONSTRAINT "project_task_dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_comments" ADD CONSTRAINT "project_comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_documents" ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_activity_logs" ADD CONSTRAINT "project_activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_policies" ADD CONSTRAINT "company_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_policy_items" ADD CONSTRAINT "company_policy_items_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "company_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_policy_assignments" ADD CONSTRAINT "company_policy_assignments_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "company_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_policy_assignments" ADD CONSTRAINT "company_policy_assignments_employee_profile_id_fkey" FOREIGN KEY ("employee_profile_id") REFERENCES "employee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_measures" ADD CONSTRAINT "goal_measures_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_slot_votes" ADD CONSTRAINT "meeting_slot_votes_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "meeting_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_action_items" ADD CONSTRAINT "meeting_action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_decisions" ADD CONSTRAINT "meeting_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_private_notes" ADD CONSTRAINT "meeting_private_notes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_notes" ADD CONSTRAINT "work_log_notes_daily_update_id_fkey" FOREIGN KEY ("daily_update_id") REFERENCES "daily_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_demand_schedules" ADD CONSTRAINT "work_log_demand_schedules_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "work_log_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_submissions" ADD CONSTRAINT "work_log_submissions_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "work_log_demands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_remarks" ADD CONSTRAINT "work_log_remarks_reply_to_remark_id_fkey" FOREIGN KEY ("reply_to_remark_id") REFERENCES "work_log_remarks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

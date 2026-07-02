import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';
import { NotificationsService } from '../notifications/notifications.service';

/** 25 MB cap, matching the product decision for document attachments. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Allowed file types (documents, images, archives + common video/audio), keyed
 * by lowercase extension. We validate on extension
 * (reliable across browsers) and keep the browser-provided MIME for display/download.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'zip',
  'mp4',
  'webm',
  'mov',
  'mp3',
]);

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Lowercase file extension (no dot), or '' when none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Shared size/type validation for document attachments (tasks + recurring templates). */
export function validateAttachmentFile(file: UploadedFile | undefined): void {
  if (!file) throw new BadRequestException('No file was provided.');
  if (file.size <= 0) throw new BadRequestException('File is empty.');
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new BadRequestException('File exceeds the 25 MB limit.');
  }
  const ext = extensionOf(file.originalname);
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
    throw new BadRequestException(
      `File type ".${ext || 'unknown'}" is not allowed. Allowed: ${Array.from(ALLOWED_ATTACHMENT_EXTENSIONS).join(', ')}.`,
    );
  }
}

@Injectable()
export class TaskAttachmentsService {
  private readonly logger = new Logger(TaskAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
    private readonly notifications: NotificationsService,
  ) {}

  private async assertTask(orgId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organization_id: orgId, is_deleted: false },
      select: { id: true },
    });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
  }

  /** Attach a document to a task (commentId null) or one of its comments. */
  async upload(
    orgId: string,
    userId: string,
    taskId: string,
    file: UploadedFile | undefined,
    commentId?: string,
  ) {
    validateAttachmentFile(file);
    await this.assertTask(orgId, taskId);

    if (commentId) {
      const comment = await this.prisma.taskComment.findFirst({
        where: { id: commentId, organization_id: orgId, task_id: taskId, is_deleted: false },
        select: { id: true },
      });
      if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);
    }

    const f = file as UploadedFile;
    const key = `org/${orgId}/tasks/${taskId}/${randomUUID()}.${extensionOf(f.originalname)}`;
    await this.r2.putObject(key, f.buffer, f.mimetype || 'application/octet-stream');

    // The object is now in R2 but not yet tracked in the DB. If the row insert
    // fails, delete the just-uploaded object so we never strand an orphan file.
    let attachment;
    try {
      attachment = await this.prisma.taskAttachment.create({
        data: {
          organization_id: orgId,
          task_id: taskId,
          comment_id: commentId ?? null,
          file_name: f.originalname,
          mime_type: f.mimetype || 'application/octet-stream',
          size_bytes: f.size,
          storage_key: key,
          uploaded_by_user_id: userId,
        },
      });
    } catch (err) {
      await this.r2.deleteObject(key); // best-effort; never throws
      throw err;
    }

    // Everything below runs AFTER the attachment is committed — activity trail
    // and notifications are best-effort and must never fail the upload itself.
    try {
      await this.prisma.taskActivityLog.create({
        data: {
          organization_id: orgId,
          task_id: taskId,
          performed_by_user_id: userId,
          action: 'file_attached',
          metadata: { attachment_id: attachment.id, file_name: f.originalname, comment_id: commentId ?? null },
        },
      });

      // Files added straight to the task (not via a comment — comments notify on their
      // own) should ping everyone on the task except the uploader.
      if (!commentId) {
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: {
            title: true,
            created_by_user_id: true,
            assignees: { select: { user_id: true } },
          },
        });
        if (task) {
          const uploaderName = await this.notifications.userName(userId);
          const recipients = [
            task.created_by_user_id,
            ...task.assignees.map((a) => a.user_id),
          ].filter((uid) => uid !== userId);
          await this.notifications.emit({
            orgId,
            module: 'tasks',
            event_type: 'task_attachment_added',
            recipients,
            title: `${uploaderName} attached a file`,
            body: `“${f.originalname}”\non “${task.title}”`,
            link: `/dashboard/tasks/${taskId}`,
            entity: { type: 'task', id: taskId },
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Post-upload activity/notify failed for attachment ${attachment.id}: ${(err as Error).message}`);
    }

    // Post-commit enrichment read — fall back to the raw row on a transient.
    return this.enrich(attachment.id).catch(() => ({ ...attachment, uploaded_by_name: null }));
  }

  /** Task-level attachments (not tied to a comment), newest first. */
  async listForTask(orgId: string, taskId: string) {
    await this.assertTask(orgId, taskId);
    const rows = await this.prisma.taskAttachment.findMany({
      where: { organization_id: orgId, task_id: taskId, comment_id: null, is_deleted: false },
      orderBy: { created_at: 'desc' },
    });
    return this.attachUploaderNames(rows);
  }

  /**
   * Every attachment on the task — those added at creation time / on the task itself
   * AND those shared inside comments — newest first. Each row keeps its `comment_id`
   * so the UI can show where it came from, plus the uploader's name.
   */
  async listAllForTask(orgId: string, taskId: string) {
    await this.assertTask(orgId, taskId);
    const rows = await this.prisma.taskAttachment.findMany({
      where: { organization_id: orgId, task_id: taskId, is_deleted: false },
      orderBy: { created_at: 'desc' },
    });
    return this.attachUploaderNames(rows);
  }

  /** A short-lived signed URL that streams the file with its original name. */
  async getDownloadUrl(orgId: string, taskId: string, attachmentId: string) {
    const att = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, organization_id: orgId, task_id: taskId, is_deleted: false },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    const url = await this.r2.getSignedDownloadUrl(att.storage_key, att.file_name);
    return { url, file_name: att.file_name };
  }

  /** Soft-delete + purge from R2. Only the uploader may remove their attachment. */
  async remove(orgId: string, userId: string, taskId: string, attachmentId: string) {
    const att = await this.prisma.taskAttachment.findFirst({
      where: { id: attachmentId, organization_id: orgId, task_id: taskId, is_deleted: false },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    if (att.uploaded_by_user_id !== userId) {
      throw new ForbiddenException('You can only remove attachments you uploaded.');
    }

    await this.prisma.taskAttachment.update({
      where: { id: attachmentId },
      data: { is_deleted: true, deleted_at: new Date() },
    });
    await this.r2.deleteObject(att.storage_key);
    return { message: 'Attachment removed' };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async enrich(id: string) {
    const row = await this.prisma.taskAttachment.findUniqueOrThrow({ where: { id } });
    const [enriched] = await this.attachUploaderNames([row]);
    return enriched;
  }

  private async attachUploaderNames<T extends { uploaded_by_user_id: string }>(rows: T[]) {
    const ids = Array.from(new Set(rows.map((r) => r.uploaded_by_user_id)));
    const users = ids.length
      ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({ ...r, uploaded_by_name: nameById.get(r.uploaded_by_user_id) ?? null }));
  }
}

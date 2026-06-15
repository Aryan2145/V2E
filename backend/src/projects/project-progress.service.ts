import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProjectProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async recalculateProjectProgress(projectId: string): Promise<void> {
    const projectTasks = await this.prisma.projectTask.findMany({
      where: { project_id: projectId },
    });

    const taskIds = projectTasks.filter((pt) => pt.task_id).map((pt) => pt.task_id as string);

    const completedStatuses = await this.prisma.taskStatus.findMany({
      where: { type: 'completed' },
      select: { id: true },
    });
    const completedStatusIds = new Set(completedStatuses.map((s) => s.id));

    let completedTasks = 0;
    if (taskIds.length > 0) {
      const tasks = await this.prisma.task.findMany({
        where: { id: { in: taskIds }, is_deleted: false },
        select: { id: true, status_id: true },
      });
      completedTasks = tasks.filter((t) => completedStatusIds.has(t.status_id)).length;
    }

    const total = projectTasks.length;
    const completionPercentage = total > 0 ? (completedTasks / total) * 100 : 0;

    // Recalculate per milestone
    const milestones = await this.prisma.projectMilestone.findMany({
      where: { project_id: projectId },
    });

    let achievedMilestones = 0;

    for (const milestone of milestones) {
      const milestoneTasks = projectTasks.filter((pt) => pt.milestone_id === milestone.id);
      const milestoneTaskIds = milestoneTasks.filter((pt) => pt.task_id).map((pt) => pt.task_id as string);
      const milestoneTotal = milestoneTasks.length;

      let milestoneCompleted = 0;
      if (milestoneTaskIds.length > 0) {
        const mTasks = await this.prisma.task.findMany({
          where: { id: { in: milestoneTaskIds }, is_deleted: false },
          select: { id: true, status_id: true },
        });
        milestoneCompleted = mTasks.filter((t) => completedStatusIds.has(t.status_id)).length;
      }

      const milestonePercent = milestoneTotal > 0 ? (milestoneCompleted / milestoneTotal) * 100 : 0;
      const allDone = milestoneTotal > 0 && milestoneCompleted === milestoneTotal;

      let newStatus = milestone.status;
      let achievedAt = milestone.achieved_at;

      if (allDone && milestone.status !== 'achieved') {
        newStatus = 'achieved';
        achievedAt = new Date();

        // Notify the project team that this milestone is done.
        const proj = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { organization_id: true, name: true, members: { select: { user_id: true } } },
        });
        if (proj) {
          await this.notifications.emit({
            orgId: proj.organization_id,
            module: 'projects',
            event_type: 'milestone_completed',
            recipients: proj.members.map((m) => m.user_id),
            title: 'Milestone achieved',
            body: `Milestone "${milestone.name}" in project "${proj.name}" is complete.`,
            link: `/dashboard/projects/${projectId}`,
            entity: { type: 'milestone', id: milestone.id },
            dedupe: true,
          });
        }
      } else if (!allDone && milestone.status === 'achieved') {
        newStatus = 'in_progress';
        achievedAt = null;
      } else if (!allDone && milestoneCompleted > 0 && milestone.status === 'pending') {
        newStatus = 'in_progress';
      }

      if (newStatus === 'achieved') achievedMilestones++;

      await this.prisma.projectMilestone.update({
        where: { id: milestone.id },
        data: {
          total_tasks: milestoneTotal,
          completed_tasks: milestoneCompleted,
          completion_percentage: milestonePercent,
          status: newStatus,
          achieved_at: achievedAt,
        },
      });
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        total_tasks: total,
        completed_tasks: completedTasks,
        completion_percentage: completionPercentage,
        total_milestones: milestones.length,
        achieved_milestones: achievedMilestones,
      },
    });
  }
}

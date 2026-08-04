import { ForbiddenException, Injectable } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { LEAF_BY_KEY } from './permission-registry';

export interface EligibleSubjectItem {
  userId: string;
  name: string;
  email?: string | null;
  department?: string | null;
  eligible: boolean;
  reason?: string;
}

/**
 * Shared SUBJECT-eligibility enforcement. Every create/assign path calls one of the
 * assert* methods BEFORE persisting (fail loud), and every picker reads the same
 * annotated list so greying-out is uniform across modules. Composes with — does not
 * replace — AssigneeVisibilityService (hierarchical actor scope).
 */
@Injectable()
export class SubjectEligibilityService {
  constructor(private readonly permissions: PermissionsService) {}

  private labelFor(subjectKey: string): string {
    return LEAF_BY_KEY.get(subjectKey)?.label ?? 'This action';
  }

  /** Throw ForbiddenException(reason) if `userId` may not be a subject of `subjectKey`. */
  async assertEligible(orgId: string, subjectKey: string, userId: string): Promise<void> {
    const res = await this.permissions.isEligibleSubject(orgId, subjectKey, userId, this.labelFor(subjectKey));
    if (!res.eligible) {
      throw new ForbiddenException(res.reason ?? `Not eligible for ${this.labelFor(subjectKey)}`);
    }
  }

  /** Throw naming the first ineligible user. No-op for an empty list. */
  async assertAllEligible(orgId: string, subjectKey: string, userIds: string[]): Promise<void> {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return;
    const map = await this.permissions.resolveEligibleSubjects(orgId, subjectKey, ids, this.labelFor(subjectKey));
    for (const id of ids) {
      const res = map.get(id);
      if (res && !res.eligible) {
        throw new ForbiddenException(res.reason ?? `A selected person is not eligible for ${this.labelFor(subjectKey)}`);
      }
    }
  }

  /** Split candidates into eligible / ineligible (with reasons). */
  async filterEligible(
    orgId: string,
    subjectKey: string,
    candidateUserIds: string[],
  ): Promise<{ eligible: string[]; ineligible: { userId: string; reason: string }[] }> {
    const map = await this.permissions.resolveEligibleSubjects(
      orgId,
      subjectKey,
      candidateUserIds,
      this.labelFor(subjectKey),
    );
    const eligible: string[] = [];
    const ineligible: { userId: string; reason: string }[] = [];
    for (const id of candidateUserIds) {
      const res = map.get(id);
      if (res?.eligible) eligible.push(id);
      else ineligible.push({ userId: id, reason: res?.reason ?? 'Not eligible' });
    }
    return { eligible, ineligible };
  }

  /** Annotate a candidate list with eligibility for picker rendering. */
  async annotate<T extends { userId: string }>(
    orgId: string,
    subjectKey: string,
    candidates: T[],
  ): Promise<(T & { eligible: boolean; reason?: string })[]> {
    const map = await this.permissions.resolveEligibleSubjects(
      orgId,
      subjectKey,
      candidates.map((c) => c.userId),
      this.labelFor(subjectKey),
    );
    return candidates.map((c) => {
      const res = map.get(c.userId);
      return { ...c, eligible: res?.eligible ?? true, reason: res?.eligible ? undefined : res?.reason };
    });
  }
}

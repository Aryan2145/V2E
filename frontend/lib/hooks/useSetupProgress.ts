'use client';

import { useState, useEffect } from 'react';
import { getOrgIdentity } from '../api/org-identity';
import { getCultureStandards } from '../api/culture';
import { getDepartments } from '../api/departments';
import { getRoles } from '../api/roles';
import { getEmployees } from '../api/employees';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SetupStep {
  id: string;
  label: string;
  completed: boolean;
  href: string;
}

export interface SetupProgress {
  steps: SetupStep[];
  completionPercent: number;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useSetupProgress(orgId: string): SetupProgress & { isLoading: boolean } {
  const [steps, setSteps] = useState<SetupStep[]>([
    { id: 'identity', label: 'Organisation Identity', completed: false, href: `/org/${orgId}/identity` },
    { id: 'culture', label: 'Culture Standards', completed: false, href: `/org/${orgId}/culture` },
    { id: 'orgChart', label: 'Org Chart', completed: false, href: `/org/${orgId}/org-chart` },
    { id: 'roles', label: 'Roles', completed: false, href: `/org/${orgId}/roles` },
    { id: 'employees', label: 'Employees', completed: false, href: `/org/${orgId}/employees` },
  ]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    async function fetchProgress() {
      setIsLoading(true);

      const results = await Promise.allSettled([
        getOrgIdentity(orgId),
        getCultureStandards(orgId),
        getDepartments(orgId),
        getRoles(orgId),
        getEmployees(orgId),
      ]);

      const [identityResult, cultureResult, departmentsResult, rolesResult, employeesResult] =
        results;

      const identityCompleted =
        identityResult.status === 'fulfilled' &&
        !!(identityResult.value?.philosophy || identityResult.value?.vision);

      const cultureCompleted =
        cultureResult.status === 'fulfilled' &&
        Array.isArray(cultureResult.value) &&
        cultureResult.value.length >= 1;

      const orgChartCompleted =
        departmentsResult.status === 'fulfilled' &&
        Array.isArray(departmentsResult.value) &&
        departmentsResult.value.length >= 1;

      const rolesCompleted =
        rolesResult.status === 'fulfilled' &&
        Array.isArray(rolesResult.value) &&
        rolesResult.value.length >= 1;

      const employeesCompleted =
        employeesResult.status === 'fulfilled' &&
        Array.isArray(employeesResult.value) &&
        employeesResult.value.length >= 1;

      setSteps([
        { id: 'identity', label: 'Organisation Identity', completed: identityCompleted, href: `/org/${orgId}/identity` },
        { id: 'culture', label: 'Culture Standards', completed: cultureCompleted, href: `/org/${orgId}/culture` },
        { id: 'orgChart', label: 'Org Chart', completed: orgChartCompleted, href: `/org/${orgId}/org-chart` },
        { id: 'roles', label: 'Roles', completed: rolesCompleted, href: `/org/${orgId}/roles` },
        { id: 'employees', label: 'Employees', completed: employeesCompleted, href: `/org/${orgId}/employees` },
      ]);

      setIsLoading(false);
    }

    fetchProgress();
  }, [orgId]);

  const completedCount = steps.filter((s) => s.completed).length;
  const completionPercent = steps.length > 0
    ? Math.round((completedCount / steps.length) * 100)
    : 0;

  return { steps, completionPercent, isLoading };
}

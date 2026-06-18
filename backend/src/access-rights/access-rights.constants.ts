/**
 * Foundational Access Rights — registry of software-wide resources that an admin
 * can configure READ/WRITE/EDIT/DELETE permissions for, per role.
 *
 * Add a module key here to make it manageable in the Access Rights admin UI.
 * `access_rights` is the meta-resource: holding EDIT on it = "can manage access rights".
 */
export const ACCESS_RIGHTS_RESOURCE = 'access_rights';

export interface AccessResource {
  key: string;
  label: string;
  description: string;
}

export const ACCESS_RESOURCES: AccessResource[] = [
  { key: 'goals', label: 'Goals', description: 'Objectives, annual and quarterly goals' },
  { key: 'meetings', label: 'Meetings', description: 'Governance meetings, agendas, action items and decisions' },
  {
    key: ACCESS_RIGHTS_RESOURCE,
    label: 'Access Rights',
    description: 'Configure who can do what across the software (meta-permission)',
  },
];

/** Roles that can be configured. org_admin is implicit-all and never stored. */
export const CONFIGURABLE_ROLES = ['hr_manager', 'employee'] as const;

const MODULES = {
  DASHBOARD: 'dashboard',
  NOTES: 'notes',
  TASKS: 'tasks',
  KANBAN: 'kanban',
  ANALYTICS: 'analytics',
  SEARCH: 'search',
  CHAT: 'chat',
  DAILY_NOTES: 'daily-notes',
  CATEGORIES: 'categories',
  PROFILE: 'profile',
  EXPORT: 'export',
  ADMIN_USERS: 'admin-users'
};

const ROLE_PERMISSIONS = {
  admin: Object.values(MODULES),
  manager: [
    MODULES.DASHBOARD,
    MODULES.NOTES,
    MODULES.TASKS,
    MODULES.KANBAN,
    MODULES.ANALYTICS,
    MODULES.SEARCH,
    MODULES.CHAT,
    MODULES.DAILY_NOTES,
    MODULES.CATEGORIES,
    MODULES.PROFILE,
    MODULES.EXPORT
  ],
  employee: [
    MODULES.DASHBOARD,
    MODULES.NOTES,
    MODULES.TASKS,
    MODULES.KANBAN,
    MODULES.SEARCH,
    MODULES.CHAT,
    MODULES.DAILY_NOTES,
    MODULES.CATEGORIES,
    MODULES.PROFILE,
    MODULES.EXPORT
  ]
};

const normalizeRole = (role) => {
  const value = `${role || ''}`.trim().toLowerCase();

  if (value === 'admin' || value === 'manager' || value === 'employee') {
    return value;
  }

  if (value === 'user') {
    return 'employee';
  }

  return 'employee';
};

const getRolePermissions = (role) => ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS.employee;

const hasModuleAccess = (role, moduleName) => getRolePermissions(role).includes(moduleName);

module.exports = {
  MODULES,
  ROLE_PERMISSIONS,
  normalizeRole,
  getRolePermissions,
  hasModuleAccess
};

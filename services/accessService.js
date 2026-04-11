const mongoose = require('mongoose');
const { normalizeRole, getRolePermissions, hasModuleAccess } = require('../config/permissions');

const toObjectId = (value) => {
  if (!value) {
    return null;
  }

  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
};

const getUserContext = (user = {}) => ({
  ...user,
  role: normalizeRole(user.role)
});

const getEntityId = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'object' && value._id) {
    return `${value._id}`;
  }

  return `${value}`;
};

const canAccessModule = (user, moduleName) => hasModuleAccess(getUserContext(user).role, moduleName);

const getVisibleUserFilter = (user, field = 'user') => {
  const context = getUserContext(user);

  if (context.role === 'admin' || context.role === 'manager') {
    return {};
  }

  return { [field]: toObjectId(context._id) };
};

const getTaskAccessFilter = (user) => {
  const context = getUserContext(user);

  if (context.role === 'admin' || context.role === 'manager') {
    return {};
  }

  const userId = toObjectId(context._id);
  return {
    $or: [
      { createdBy: userId },
      { assignedTo: userId }
    ]
  };
};

const canManageUserRoles = (user) => getUserContext(user).role === 'admin';

const canManageTask = (user, task) => {
  const context = getUserContext(user);
  if (context.role === 'admin' || context.role === 'manager') {
    return true;
  }

  return (
    getEntityId(task.createdBy) === `${context._id}` ||
    getEntityId(task.assignedTo) === `${context._id}`
  );
};

module.exports = {
  getUserContext,
  getRolePermissions,
  canAccessModule,
  getVisibleUserFilter,
  getTaskAccessFilter,
  canManageUserRoles,
  canManageTask
};

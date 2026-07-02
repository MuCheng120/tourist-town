'use strict';

module.exports = (allowedRole) => {
  return async function roleCheck(ctx, next) {
    const { role } = ctx.state.user || {};

    if (!allowedRole) {
      await next();
      return;
    }

    if (role !== allowedRole) {
      ctx.status = 403;
      ctx.body = {
        code: 403,
        message: '权限不足，无法访问该接口',
      };
      return;
    }

    if (allowedRole === 'merchant') {
      ctx.merchant = {
        id: ctx.state.user.id,
        role: ctx.state.user.role,
      };
    }
    if (allowedRole === 'admin') {
      ctx.admin = {
        id: ctx.state.user.id,
        role: ctx.state.user.role,
      };
    }

    await next();
  };
};

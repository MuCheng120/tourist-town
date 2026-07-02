'use strict';

module.exports = () => {
  return async function jwtAuth(ctx, next) {
    const rawAuth = ctx.request.header.authorization || ctx.request.header.Authorization || '';
    const token = rawAuth && rawAuth.startsWith('Bearer ') ? rawAuth.slice(7) : rawAuth;

    // 记录进入 jwtAuth 时的基础信息，便于排查 401
    ctx.logger.info('[jwtAuth] incoming request', {
      url: ctx.url,
      method: ctx.method,
      hasAuthHeader: !!rawAuth,
      hasToken: !!token,
    });

    if (!token) {
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: '未提供认证令牌',
      };
      return;
    }

    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
      ctx.state.user = decoded;
      ctx.logger.info('[jwtAuth] verify success', {
        url: ctx.url,
        userId: decoded.id,
        role: decoded.role,
      });
      await next();
    } catch (err) {
      // 只有 JWT 校验错误才返回 401，下游 controller/service 抛错则继续抛出
      const isJwtError = err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError';
      if (isJwtError) {
        ctx.logger.error('[jwtAuth] verify failed', {
          url: ctx.url,
          errorName: err.name,
          errorMessage: err.message,
        });
        ctx.status = 401;
        ctx.body = {
          code: 401,
          message: '认证令牌无效或已过期',
        };
      } else {
        throw err;
      }
    }
  };
};

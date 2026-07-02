'use strict';

/**
 * 可选 JWT：有 token 时解析并设置 ctx.state.user，无 token 或解析失败时直接放行不 401。
 * 用于攻略详情等公开接口，需要根据当前用户返回 isLiked 等状态。
 */
module.exports = () => {
  return async function optionalJwt(ctx, next) {
    const rawAuth = ctx.request.header.authorization || ctx.request.header.Authorization || '';
    const token = rawAuth && rawAuth.startsWith('Bearer ') ? rawAuth.slice(7) : rawAuth;

    if (!token) {
      await next();
      return;
    }

    try {
      const decoded = ctx.app.jwt.verify(token, ctx.app.config.jwt.secret);
      ctx.state.user = decoded;
      await next();
    } catch (err) {
      // token 无效或过期也不拦截，继续处理请求，只是不设置 ctx.state.user
      await next();
    }
  };
};

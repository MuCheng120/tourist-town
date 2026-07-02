'use strict';

/**
 * 全局错误处理中间件
 * 统一捕获和处理应用中的错误
 */
module.exports = () => {
  return async function errorHandler(ctx, next) {
    try {
      await next();
    } catch (err) {
      // 记录错误日志
      ctx.logger.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        status: err.status,
        code: err.code,
        url: ctx.url,
        method: ctx.method,
        userId: ctx.state.user?.id,
      });

      // 设置响应状态码
      ctx.status = err.status || 500;

      // 根据错误类型返回不同的响应
      if (err.name === 'ValidationError') {
        // 参数验证错误
        ctx.body = {
          code: 400,
          message: '参数验证失败',
          errors: err.errors,
        };
      } else if (err.name === 'SequelizeValidationError') {
        // Sequelize 验证错误
        ctx.body = {
          code: 400,
          message: '数据验证失败',
          errors: err.errors.map(e => ({
            field: e.path,
            message: e.message,
          })),
        };
      } else if (err.name === 'SequelizeUniqueConstraintError') {
        // 唯一约束错误（如重复数据）
        ctx.body = {
          code: 409,
          message: '数据已存在',
          field: err.errors[0]?.path,
        };
      } else if (err.name === 'SequelizeForeignKeyConstraintError') {
        // 外键约束错误
        ctx.body = {
          code: 400,
          message: '关联数据不存在',
        };
      } else if (err.name === 'JsonWebTokenError') {
        // JWT Token 错误
        ctx.body = {
          code: 401,
          message: '认证令牌无效',
        };
      } else if (err.name === 'TokenExpiredError') {
        // Token 过期
        ctx.body = {
          code: 401,
          message: '认证令牌已过期，请重新登录',
        };
      } else if (
        err.name === 'SequelizeDatabaseError' ||
        (err.message && /SQL syntax|ER_|near\s*'/.test(err.message)) ||
        (err.original && err.original.message && /SQL syntax|ER_|near\s*'/.test(err.original.message)) ||
        (err.parent && err.parent.message && /SQL syntax|ER_|near\s*'/.test(err.parent.message))
      ) {
        // 数据库/SQL 错误：仅打日志，不向客户端暴露 SQL 详情
        const sqlMsg = err.original?.message || err.parent?.message || err.message;
        ctx.logger.error('DB/SQL error (masked to client):', { url: ctx.url, method: ctx.method, sqlMessage: sqlMsg });
        ctx.body = {
          code: err.status || 500,
          message: '操作失败，请稍后重试',
        };
      } else {
        // 其他未知错误
        ctx.body = {
          code: err.status || 500,
          message: err.message || '服务器内部错误',
          ...(ctx.app.config.env === 'local' && { stack: err.stack }),
        };
      }

      // 触发错误事件（可用于监控告警）
      ctx.app.emit('error', err, ctx);
    }
  };
};

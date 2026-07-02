'use strict';

/**
 * 旅游小镇小程序应用主文件
 * 用于监听应用事件
 */

module.exports = app => {
  // 监听错误事件
  app.on('error', (err, ctx) => {
    // 可以在这里集成第三方错误监控服务
    // 例如：Sentry、阿里云日志服务等
    
    // 记录严重错误
    if (err.status >= 500) {
      app.logger.error('[Critical Error]', {
        message: err.message,
        stack: err.stack,
        url: ctx?.url,
        method: ctx?.method,
        userId: ctx?.state?.user?.id,
        ip: ctx?.ip,
      });
    }
  });

  // 应用启动时的初始化
  app.beforeStart(async () => {
    app.logger.info('=================================');
    app.logger.info('🚀 旅游小镇小程序后端启动中...');
    app.logger.info('📦 环境:', app.config.env);
    app.logger.info('🔗 数据库:', app.config.sequelize.database);
    app.logger.info('=================================');
    
    // 测试数据库连接
    try {
      await app.model.query('SELECT 1');
      app.logger.info('✅ 数据库连接成功');
    } catch (error) {
      app.logger.error('❌ 数据库连接失败:', error.message);
    }
  });

  // 数据库连接成功
  app.on('db_connected', () => {
    app.logger.info('✅ 数据库已连接');
  });

  // 数据库连接断开
  app.on('db_disconnected', () => {
    app.logger.warn('⚠️  数据库连接已断开');
  });
};

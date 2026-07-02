/**
 * 缓存更新中间件
 * 在数据变更时自动更新相关缓存
 */

module.exports = options => {
  return async function cacheUpdate(ctx, next) {
    const { app, logger } = ctx;
    const cache = app.cache;

    // 保存原始方法
    const originalJson = ctx.json.bind(ctx);

    // 重写json方法，在响应后更新缓存
    ctx.json = function(data) {
      // 异步更新缓存，不阻塞响应
      setImmediate(async () => {
        try {
          const url = ctx.url;
          const method = ctx.method;

          // 景点相关缓存更新
          if (url.includes('/scenic')) {
            if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
              logger.info('[CacheUpdate] Clearing scenic cache due to data change');
              await cache.clearScenicCache();
            }
          }

          // 统计数据缓存更新（数据变更后5秒清除）
          if (url.includes('/order') && method === 'POST') {
            setTimeout(async () => {
              await cache.clearStatisticsCache();
              logger.info('[CacheUpdate] Cleared statistics cache after order created');
            }, 5000);
          }

        } catch (error) {
          logger.error('[CacheUpdate] Update cache error:', error);
        }
      });

      // 调用原始方法
      return originalJson(data);
    };

    await next();
  };
};

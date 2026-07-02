/**
 * 缓存预热定时任务
 * 每天凌晨1点执行，预加载热点数据到缓存
 */

module.exports = {
  schedule: {
    cron: '0 0 1 * * *', // 每天凌晨1点
    type: 'all',
    immediate: false,
  },

  async task() {
    const { app, logger } = this;
    logger.info('[CacheWarmup] Starting cache warmup...');

    try {
      const cacheService = app.cache;
      const scenicSpotService = app.service.scenicSpot;

      // 1. 预加载热门景点（前20个）
      const hotSpots = await scenicSpotService.getHotSpots(20);
      if (hotSpots && hotSpots.length > 0) {
        await cacheService.setHotSpots(20, hotSpots, 86400); // 缓存24小时
        logger.info(`[CacheWarmup] Loaded ${hotSpots.length} hot spots`);

        // 同时预加载每个景点的详情
        for (const spot of hotSpots) {
          const detail = await scenicSpotService.getById(spot.id);
          if (detail) {
            await cacheService.setScenicDetail(spot.id, detail, 86400);
          }
        }
        logger.info('[CacheWarmup] Loaded hot spots details');
      }

      // 2. 预加载首页轮播图
      const bannerService = app.service.banner;
      const banners = await bannerService.getActiveBanners();
      if (banners) {
        await cacheService.set('index:banners', banners, 7200); // 缓存2小时
        logger.info(`[CacheWarmup] Loaded ${banners.length} banners`);
      }

      // 3. 预加载系统公告
      const announcementService = app.service.announcement;
      const announcements = await announcementService.getActiveAnnouncements();
      if (announcements) {
        await cacheService.set('index:announcements', announcements, 3600); // 缓存1小时
        logger.info(`[CacheWarmup] Loaded ${announcements.length} announcements`);
      }

      logger.info('[CacheWarmup] Cache warmup completed successfully');
    } catch (error) {
      logger.error('[CacheWarmup] Cache warmup failed:', error);
    }
  },
};

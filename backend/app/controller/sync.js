// app/controller/sync.js
'use strict';

const Controller = require('egg').Controller;

class SyncController extends Controller {
  /**
   * 同步离线数据
   */
  async sync() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { operations = [] } = ctx.request.body;

    try {
      const results = [];

      // 处理每个离线操作
      for (const operation of operations) {
        const result = await this.syncOperation(operation, userId);
        results.push(result);
      }

      ctx.success({
        success_count: results.length,
        results,
      }, '同步成功');
    } catch (error) {
      ctx.logger.error('同步离线数据失败:', error);
      ctx.error('同步失败', 500);
    }
  }

  /**
   * 同步单个操作
   */
  async syncOperation(operation, userId) {
    const { ctx } = this;
    const { type, url, method, data } = operation;

    try {
      switch (type) {
        case 'favorite':
          // 同步收藏操作
          return await this.syncFavorite(data, userId);

        case 'comment':
          // 同步评论操作
          return await this.syncComment(data, userId);

        case 'order':
          // 同步订单操作
          return await this.syncOrder(data, userId);

        case 'behavior':
          // 同步行为日志
          return await this.syncBehavior(data, userId);

        default:
          throw new Error(`未知操作类型: ${type}`);
      }
    } catch (error) {
      ctx.logger.error(`同步操作失败 (${type}):`, error);
      return {
        type,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 同步收藏操作
   */
  async syncFavorite(data, userId) {
    const { ctx } = this;
    const { target_id, target_type, action } = data;

    if (action === 'add') {
      // 添加收藏
      await ctx.service.favorite.add(userId, target_id, target_type);
      return {
        type: 'favorite',
        success: true,
        action: 'add',
        target_id,
      };
    } else if (action === 'remove') {
      // 取消收藏
      await ctx.service.favorite.remove(userId, target_id, target_type);
      return {
        type: 'favorite',
        success: true,
        action: 'remove',
        target_id,
      };
    }
  }

  /**
   * 同步评论操作
   */
  async syncComment(data, userId) {
    const { ctx } = this;
    const { post_id, post_type, content, score } = data;

    const comment = await ctx.service.comment.create({
      user_id: userId,
      post_id,
      post_type,
      content,
      score,
    });

    return {
      type: 'comment',
      success: true,
      comment_id: comment.id,
    };
  }

  /**
   * 同步订单操作
   */
  async syncOrder(data, userId) {
    const { ctx } = this;
    const { order_no, status } = data;

    // 更新订单状态
    const order = await ctx.service.order.updateStatus(order_no, status, userId);

    return {
      type: 'order',
      success: true,
      order_no,
      status,
    };
  }

  /**
   * 同步行为日志
   */
  async syncBehavior(data, userId) {
    const { ctx } = this;
    const { page_path, target_id, target_type, action_type, stay_duration } = data;

    // 批量插入行为日志
    await ctx.service.userBehavior.batchLog([{
      user_id: userId,
      page_path,
      target_id,
      target_type,
      action_type,
      stay_duration,
    }]);

    return {
      type: 'behavior',
      success: true,
      count: 1,
    };
  }

  /**
   * 获取增量数据
   */
  async getIncrementalData() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { last_sync_time } = ctx.query;

    try {
      const lastSyncTime = last_sync_time ? new Date(last_sync_time) : new Date(Date.now() - 86400000); // 默认同步最近24小时

      // 获取增量景点数据
      const scenicSpots = await ctx.service.scenicSpot.getUpdatedSince(lastSyncTime);

      // 获取增量优惠券数据
      const coupons = await ctx.service.coupon.getAvailable(userId, lastSyncTime);

      // 获取增量公告数据
      const announcements = await ctx.service.announcement.getUpdatedSince(lastSyncTime);

      ctx.success({
        last_sync_time: new Date(),
        scenic_spots: scenicSpots,
        coupons: coupons,
        announcements: announcements,
      }, '获取增量数据成功');
    } catch (error) {
      ctx.logger.error('获取增量数据失败:', error);
      ctx.error('获取增量数据失败', 500);
    }
  }

  /**
   * 检查更新
   */
  async checkUpdate() {
    const { ctx } = this;
    const { last_sync_time } = ctx.query;

    try {
      const lastSyncTime = last_sync_time ? new Date(last_sync_time) : new Date(Date.now() - 86400000);

      // 检查是否有更新的数据
      const hasUpdate = await ctx.service.sync.hasUpdateSince(lastSyncTime);

      ctx.success({
        has_update: hasUpdate,
        last_sync_time: lastSyncTime,
        current_time: new Date(),
      }, '检查更新成功');
    } catch (error) {
      ctx.logger.error('检查更新失败:', error);
      ctx.error('检查更新失败', 500);
    }
  }
}

module.exports = SyncController;

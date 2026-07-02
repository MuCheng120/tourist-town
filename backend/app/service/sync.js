// app/service/sync.js
'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class SyncService extends Service {
  /**
   * 检查是否有更新
   */
  async hasUpdateSince(lastSyncTime) {
    const { ctx } = this;
    const { ScenicSpot, Announcement, Coupon } = ctx.model;

    // 检查景点是否有更新
    const scenicCount = await ScenicSpot.count({
      where: {
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
        status: 1,
      },
    });

    // 检查公告是否有更新
    const announcementCount = await Announcement.count({
      where: {
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
      },
    });

    // 检查优惠券是否有更新
    const couponCount = await Coupon.count({
      where: {
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
        status: 1,
      },
    });

    // 如果任一表有更新，返回true
    return scenicCount > 0 || announcementCount > 0 || couponCount > 0;
  }

  /**
   * 批量同步行为日志
   */
  async batchSyncBehaviorLogs(logs) {
    const { ctx } = this;
    const { UserBehaviorLog } = ctx.model;

    try {
      // 批量插入行为日志
      await UserBehaviorLog.bulkCreate(logs, {
        validate: true,
        individualHooks: true,
      });

      return {
        success: true,
        count: logs.length,
      };
    } catch (error) {
      ctx.logger.error('批量同步行为日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户数据的同步时间戳
   */
  async getUserSyncTimestamp(userId) {
    const { ctx } = this;
    const cacheKey = `user_sync_timestamp_${userId}`;

    // 从Redis获取同步时间戳
    const timestamp = await this.app.redis.get(cacheKey);

    if (timestamp) {
      return new Date(timestamp);
    }

    // 如果没有，返回24小时前的时间
    return new Date(Date.now() - 86400000);
  }

  /**
   * 更新用户同步时间戳
   */
  async updateUserSyncTimestamp(userId) {
    const { ctx } = this;
    const cacheKey = `user_sync_timestamp_${userId}`;
    const now = new Date();

    // 保存到Redis，有效期7天
    await this.app.redis.set(cacheKey, now.toISOString(), 'EX', 604800);

    return now;
  }

  /**
   * 获取需要同步的数据摘要
   */
  async getSyncSummary(userId, lastSyncTime) {
    const { ctx } = this;
    const { ScenicSpot, Announcement, Coupon, Order } = ctx.model;

    // 获取更新的景点数量
    const scenicCount = await ScenicSpot.count({
      where: {
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
        status: 1,
      },
    });

    // 获取更新的公告数量
    const announcementCount = await Announcement.count({
      where: {
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
      },
    });

    // 获取可用的优惠券数量
    const couponCount = await Coupon.count({
      where: {
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
        status: 1,
        expiry_date: {
          [Op.gte]: new Date(),
        },
      },
    });

    // 获取更新的订单数量
    const orderCount = await Order.count({
      where: {
        user_id: userId,
        updated_at: {
          [Op.gte]: lastSyncTime,
        },
      },
    });

    return {
      scenic_spots: scenicCount,
      announcements: announcementCount,
      coupons: couponCount,
      orders: orderCount,
      last_sync_time: lastSyncTime,
    };
  }

  /**
   * 清理旧的同步记录
   */
  async cleanOldSyncRecords() {
    const { ctx } = this;
    const { UserBehaviorLog } = ctx.model;

    // 删除90天前的行为日志
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const deletedCount = await UserBehaviorLog.destroy({
      where: {
        created_at: {
          [Op.lt]: ninetyDaysAgo,
        },
      },
    });

    ctx.logger.info(`清理了 ${deletedCount} 条旧的行为日志`);

    return deletedCount;
  }

  /**
   * 生成数据同步报告
   */
  async generateSyncReport(userId) {
    const { ctx } = this;
    const lastSyncTime = await this.getUserSyncTimestamp(userId);
    const summary = await this.getSyncSummary(userId, lastSyncTime);

    return {
      user_id: userId,
      last_sync_time: lastSyncTime,
      current_time: new Date(),
      has_update: Object.values(summary).some(count => count > 0),
      summary,
    };
  }

  /**
   * 验证同步数据完整性
   */
  async validateSyncData(data) {
    const { ctx } = this;
    const errors = [];

    // 验证景点数据
    if (data.scenic_spots) {
      for (const spot of data.scenic_spots) {
        if (!spot.id || !spot.name || !spot.location) {
          errors.push(`景点数据不完整: ${JSON.stringify(spot)}`);
        }
      }
    }

    // 验证优惠券数据
    if (data.coupons) {
      for (const coupon of data.coupons) {
        if (!coupon.id || !coupon.title || !coupon.value) {
          errors.push(`优惠券数据不完整: ${JSON.stringify(coupon)}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 压缩同步数据
   */
  async compressSyncData(data) {
    // 这里可以使用压缩算法来减小数据传输量
    // 简化版：只返回必要字段
    const compressed = {
      scenic_spots: data.scenic_spots.map(spot => ({
        id: spot.id,
        name: spot.name,
        cover_image: spot.cover_image,
        location: spot.location,
        updated_at: spot.updated_at,
      })),
      coupons: data.coupons.map(coupon => ({
        id: coupon.id,
        title: coupon.title,
        value: coupon.value,
        min_spend: coupon.min_spend,
        expiry_date: coupon.expiry_date,
        updated_at: coupon.updated_at,
      })),
      announcements: data.announcements.map(announcement => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        updated_at: announcement.updated_at,
      })),
    };

    return compressed;
  }

  /**
   * 获取同步配置
   */
  getSyncConfig() {
    return {
      max_operations_per_sync: 100, // 每次最多同步100个操作
      sync_timeout: 30000, // 同步超时时间（毫秒）
      retry_times: 3, // 失败重试次数
      batch_size: 50, // 批量操作大小
      sync_interval: 60000, // 同步间隔（毫秒）
    };
  }
}

module.exports = SyncService;

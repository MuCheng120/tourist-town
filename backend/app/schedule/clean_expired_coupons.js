'use strict';

const Subscription = require('egg').Subscription;

class CleanExpiredCoupons extends Subscription {
  static get schedule() {
    return {
      interval: '1h', // 每小时执行一次
      type: 'all',
      immediate: false,
    };
  }

  async subscribe() {
    const { logger } = this;
    try {
      const count = await this.ctx.service.coupon.cleanExpiredCoupons();
      logger.info(`清理过期优惠券定时任务执行完成，清理了 ${count} 个优惠券`);
    } catch (error) {
      logger.error('清理过期优惠券定时任务执行失败:', error);
    }
  }
}

module.exports = CleanExpiredCoupons;

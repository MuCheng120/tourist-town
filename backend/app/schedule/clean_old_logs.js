'use strict';

const Subscription = require('egg').Subscription;
const { Op } = require('sequelize');

class CleanOldLogs extends Subscription {
  static get schedule() {
    return {
      interval: '1d', // 每天执行一次
      type: 'all',
      immediate: false,
    };
  }

  async subscribe() {
    const { logger } = this;
    try {
      // 删除90天前的行为日志
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const count = await this.app.model.UserBehaviorLog.destroy({
        where: {
          created_at: { [Op.lt]: ninetyDaysAgo },
        },
      });

      logger.info(`清理旧日志定时任务执行完成，删除了 ${count} 条90天前的行为日志`);
    } catch (error) {
      logger.error('清理旧日志定时任务执行失败:', error);
    }
  }
}

module.exports = CleanOldLogs;

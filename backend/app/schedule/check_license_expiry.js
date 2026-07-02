/**
 * 定时任务：检查商户资质到期情况
 * 每天早上8点执行
 */

const Subscription = require('egg').Subscription;

class CheckLicenseExpiry extends Subscription {
  // 使用 cron 表达式定义执行时间：每天早上8点
  static get schedule() {
    return {
      cron: '0 0 8 * * *',
      type: 'all',
    };
  }

  // 订阅方法
  async subscribe() {
    const { app, service } = this;

    try {
      app.logger.info('[定时任务] 开始检查商户资质到期情况...');

      const results = await service.merchantCredit.checkLicenseExpiry();

      app.logger.info(
        `[定时任务] 资质检查完成: 警告 ${results.warningCount}个, 已过期 ${results.expiredCount}个, 已暂停 ${results.suspendedCount}个`
      );

      // 如果有需要提醒的商户，记录到日志
      if (results.warningCount > 0) {
        app.logger.warn(`[定时任务] ${results.warningCount} 个商户资质即将到期，已发送提醒`);
      }

      if (results.expiredCount > 0) {
        app.logger.warn(`[定时任务] ${results.expiredCount} 个商户资质已过期，已暂停营业`);
      }
    } catch (error) {
      app.logger.error('[定时任务] 检查商户资质到期失败:', error);
    }
  }
}

module.exports = CheckLicenseExpiry;

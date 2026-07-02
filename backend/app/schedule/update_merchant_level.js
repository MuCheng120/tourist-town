/**
 * 定时任务：更新商户信用等级
 * 每天凌晨2点执行
 */

const Subscription = require('egg').Subscription;

class UpdateMerchantLevel extends Subscription {
  // 使用 cron 表达式定义执行时间：每天凌晨2点
  static get schedule() {
    return {
      cron: '0 0 2 * * *',
      type: 'all',
    };
  }

  // 订阅方法
  async subscribe() {
    const { app, service } = this;

    try {
      app.logger.info('[定时任务] 开始更新所有商户信用等级...');

      const results = await service.merchantCredit.updateAllMerchantsCreditLevel();

      app.logger.info(
        `[定时任务] 商户信用等级更新完成: 总数 ${results.total}, 成功 ${results.success}, 失败 ${results.failed}`
      );
    } catch (error) {
      app.logger.error('[定时任务] 更新商户信用等级失败:', error);
    }
  }
}

module.exports = UpdateMerchantLevel;

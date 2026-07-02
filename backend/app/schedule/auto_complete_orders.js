'use strict';

module.exports = {
  schedule: {
    interval: '1h', // 每小时执行一次
    type: 'all', // 指定所有的 worker 都需要执行
  },
  async task(ctx) {
    const { app } = ctx;

    try {
      app.logger.info('开始执行订单自动完成定时任务');

      // 查找已签收超过7天的订单
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const orders = await app.model.Order.findAll({
        where: {
          status: 'shipped',
          ship_time: {
            [app.model.Op.lt]: sevenDaysAgo,
          },
        },
        include: [
          {
            model: app.model.Logistics,
            as: 'logistics',
            where: {
              status: '已签收',
            },
          },
        ],
      });

      if (orders.length > 0) {
        for (const order of orders) {
          try {
            // 检查是否有维权记录（这里简化处理，实际应该有refunds表）
            const hasDispute = false;

            if (!hasDispute) {
              // 自动完成订单
              await order.update({
                status: 'completed',
                completed_at: new Date(),
              });

              app.logger.info(`订单${order.id}已自动完成`);
            }
          } catch (error) {
            app.logger.error(`订单${order.id}自动完成失败:`, error);
          }
        }

        app.logger.info(`本次自动完成了${orders.length}个订单`);
      } else {
        app.logger.info('没有需要自动完成的订单');
      }
    } catch (error) {
      app.logger.error('订单自动完成定时任务执行失败:', error);
    }
  },
};

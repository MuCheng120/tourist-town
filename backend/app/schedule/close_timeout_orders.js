'use strict';

const Subscription = require('egg').Subscription;

/**
 * 关闭超时未支付订单
 * 每分钟执行一次
 */
class CloseTimeoutOrders extends Subscription {
  static get schedule() {
    return {
      interval: '1m',
      type: 'worker',
    };
  }

  async subscribe() {
    const { app } = this;

    try {
      // 15分钟前的时间
      const timeoutTime = new Date(Date.now() - 15 * 60 * 1000);

      // 查找超时未支付订单
      const timeoutOrders = await app.model.Order.findAll({
        where: {
          status: 'unpaid',
          created_at: {
            [app.Sequelize.Op.lt]: timeoutTime,
          },
        },
      });

      if (timeoutOrders.length === 0) {
        return;
      }

      app.logger.info(`发现 ${timeoutOrders.length} 个超时未支付订单`);

      // 处理每个超时订单
      for (const order of timeoutOrders) {
        const transaction = await app.model.transaction();

        try {
          // 恢复库存
          if (order.order_type === 'souvenir') {
            // 恢复商品库存
            await app.model.Product.increment('stock', {
              by: order.quantity,
              where: { id: order.product_id },
              transaction,
            });
          } else if (order.order_type === 'hotel') {
            const rtyId = order.room_type_id != null ? order.room_type_id : order.product_id;
            if (rtyId && order.check_in_date && order.check_out_date) {
              const startDate = new Date(order.check_in_date);
              const endDate = new Date(order.check_out_date);
              const dates = [];
              let currentDate = startDate;
              while (currentDate < endDate) {
                dates.push(currentDate.toISOString().split('T')[0]);
                currentDate.setDate(currentDate.getDate() + 1);
              }
              for (const date of dates) {
                await app.model.RoomStock.increment('remained_count', {
                  by: 1,
                  where: { room_type_id: rtyId, date },
                  transaction,
                });
              }
            }
          }

          // 更新订单状态
          await order.update({ status: 'cancelled' }, { transaction });

          await transaction.commit();
          app.logger.info(`订单 ${order.order_no} 已超时取消`);
        } catch (error) {
          await transaction.rollback();
          app.logger.error(`处理超时订单 ${order.order_no} 失败:`, error);
        }
      }
    } catch (error) {
      app.logger.error('关闭超时订单任务失败:', error);
    }
  }
}

module.exports = CloseTimeoutOrders;

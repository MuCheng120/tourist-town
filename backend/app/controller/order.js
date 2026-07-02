'use strict';

const Controller = require('egg').Controller;

class OrderController extends Controller {
  /**
   * 创建订单
   */
  async create() {
    const { ctx } = this;

    try {
      const order = await ctx.service.order.createOrder(ctx.request.body);
      ctx.body = {
        code: 200,
        message: '创建成功',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '创建失败',
      };
    }
  }

  /**
   * 获取订单列表（用户端）
   */
  async list() {
    const { ctx } = this;

    try {
      const result = await ctx.service.order.getOrderList(ctx.query);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 管理员：获取全部订单列表
   */
  async adminList() {
    const { ctx } = this;

    try {
      const result = await ctx.service.order.getOrderListAdmin(ctx.query);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 获取订单详情
   */
  async detail() {
    const { ctx } = this;

    try {
      const order = await ctx.service.order.getOrderDetail(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 支付订单
   */
  async pay() {
    const { ctx } = this;

    try {
      const order = await ctx.service.order.payOrder(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '支付成功',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '支付失败',
      };
    }
  }

  /**
   * 取消订单
   */
  async cancel() {
    const { ctx } = this;

    try {
      await ctx.service.order.cancelOrder(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '取消成功',
        data: {},
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '取消失败',
      };
    }
  }

  /**
   * 删除订单记录（软删除）
   */
  async delete() {
    const { ctx } = this;

    try {
      await ctx.service.order.deleteOrder(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '已删除',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '删除失败',
      };
    }
  }

  /**
   * 申请退款
   */
  async refund() {
    const { ctx } = this;

    try {
      const { reason, evidence_images } = ctx.request.body || {};
      await ctx.service.order.refundOrder(ctx.params.id, {
        reason,
        evidence_images,
      });
      ctx.body = {
        code: 200,
        message: '退款申请已提交',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '退款失败',
      };
    }
  }

  /**
   * 完成订单
   */
  async complete() {
    const { ctx } = this;

    try {
      const order = await ctx.service.order.completeOrder(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '订单已完成',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 管理员：酒店订单确认入住完成
   */
  async adminCompleteHotel() {
    const { ctx } = this;
    try {
      const order = await ctx.service.order.completeHotelOrderByAdmin(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '已确认入住完成',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 管理员批准退款（处理争议）
   */
  async approveRefund() {
    const { ctx } = this;

    try {
      const { reason } = ctx.request.body;
      const order = await ctx.service.order.approveRefund(ctx.params.id, reason);
      ctx.body = {
        code: 200,
        message: '退款已批准',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 管理员拒绝退款
   */
  async rejectRefund() {
    const { ctx } = this;

    try {
      const { reason } = ctx.request.body;
      const order = await ctx.service.order.rejectRefund(ctx.params.id, reason);
      ctx.body = {
        code: 200,
        message: '退款已拒绝',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 管理员强制核销/完成订单
   */
  async forceComplete() {
    const { ctx } = this;

    try {
      const { reason } = ctx.request.body;
      const order = await ctx.service.order.forceCompleteOrder(ctx.params.id, reason);
      ctx.body = {
        code: 200,
        message: '订单已强制完成',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 管理员扫码核销（景点门票等，按核销码核销，不限制商家）
   */
  async verifyByCode() {
    const { ctx } = this;

    try {
      const { code } = ctx.request.body || {};
      if (!code || !String(code).trim()) {
        ctx.body = { code: 400, message: '请提供核销码' };
        return;
      }
      const result = await ctx.service.order.verifyByCode(String(code).trim());
      ctx.body = {
        code: 200,
        message: '核销成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '核销失败',
      };
    }
  }

  /**
   * 模拟支付（用于演示和测试）
   */
  async mockPay() {
    const { ctx } = this;

    try {
      const { id } = ctx.params;
      const order = await ctx.service.order.payOrder(id);
      
      ctx.body = {
        code: 200,
        message: '模拟支付成功',
        data: order,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '模拟支付失败',
      };
    }
  }
}

module.exports = OrderController;

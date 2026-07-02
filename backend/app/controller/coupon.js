'use strict';

const Controller = require('egg').Controller;

class CouponController extends Controller {
  /**
   * 创建优惠券
   */
  async create() {
    const { ctx } = this;
    const data = ctx.request.body;

    try {
      const result = await ctx.service.coupon.create(data);
      ctx.body = {
        code: 200,
        success: true,
        message: '创建成功',
        data: result.data,
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: error.message || '创建失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 用户领取优惠券
   */
  async receive() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      const result = await ctx.service.coupon.receive(id);
      ctx.body = {
        code: 200,
        success: true,
        message: result.message,
        data: null,
      };
    } catch (error) {
      ctx.body = {
        code: 400,
        success: false,
        message: error.message || '领取失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 获取用户优惠券列表
   */
  async getUserCoupons() {
    const { ctx } = this;
    const userId = ctx.state.user ? ctx.state.user.id : null;
    const { status, page, pageSize } = ctx.query;

    if (!userId) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '请先登录' };
      return;
    }

    try {
      const result = await ctx.service.coupon.getUserCoupons(userId, {
        status,
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
      });

      ctx.body = {
        code: 200,
        success: true,
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 400,
        success: false,
        message: error.message || '获取失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 获取可用优惠券（下单时用）
   * query: totalAmount, merchantId（选填，传了则返回平台券+该商户店铺券）
   */
  async getAvailableCoupons() {
    const { ctx } = this;
    const user = ctx.state.user;
    if (!user || !user.id) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '请先登录' };
      return;
    }
    const { totalAmount, merchantId } = ctx.query;

    try {
      const result = await ctx.service.coupon.getAvailableCoupons(user.id, {
        totalAmount: parseFloat(totalAmount),
        merchantId: merchantId !== undefined && merchantId !== '' ? merchantId : undefined,
      });

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
   * 使用优惠券（下单时调用）
   */
  async use() {
    const { ctx } = this;
    const { userCouponId, orderId } = ctx.request.body;

    try {
      const result = await ctx.service.coupon.use(userCouponId, orderId);
      ctx.body = {
        success: true,
        data: {
          discount: result.discount,
          message: result.message,
        },
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: error.message || '使用失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 领券中心列表（游客可访问，无需登录）
   * query: page, pageSize, type=platform|shop（不传或 platform 为平台券，shop 为店铺券）
   */
  async getCenter() {
    const { ctx } = this;
    const { page, pageSize, type } = ctx.query;
    try {
      const result = await ctx.service.coupon.getCenterList({
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 50,
        type: type === 'shop' ? 'shop' : 'platform',
      });
      ctx.body = { code: 200, message: '获取成功', data: result };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '获取失败' };
      ctx.status = 400;
    }
  }

  /**
   * 当前用户已领取的优惠券 ID 列表（登录后用于领券中心标记）
   */
  async getReceivedIds() {
    const { ctx } = this;
    const user = ctx.state.user;
    if (!user || !user.id) {
      ctx.status = 401;
      ctx.body = { code: 401, message: '请先登录' };
      return;
    }
    try {
      const couponIds = await ctx.service.coupon.getReceivedCouponIds(user.id);
      ctx.body = { code: 200, message: '获取成功', data: { couponIds } };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '获取失败' };
      ctx.status = 400;
    }
  }

  /**
   * 获取优惠券列表（管理员/商家用）
   */
  async getList() {
    const { ctx } = this;
    const { type, status, page, pageSize } = ctx.query;

    try {
      const result = await ctx.service.coupon.getList({
        type: type || undefined,
        status: status !== undefined ? parseInt(status) : undefined,
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
      });

      ctx.body = {
        code: 200,
        success: true,
        data: result,
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: error.message || '获取失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 获取优惠券详情
   */
  async getDetail() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      const result = await ctx.service.coupon.getDetail(id);
      ctx.body = {
        code: 200,
        success: true,
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 400,
        success: false,
        message: error.message || '获取失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 更新优惠券状态（管理员用）
   */
  async updateStatus() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { status } = ctx.request.body;

    try {
      await ctx.service.coupon.updateStatus(id, status);
      ctx.body = {
        success: true,
        message: '更新成功',
      };
    } catch (error) {
      ctx.body = {
        success: false,
        message: error.message || '更新失败',
      };
      ctx.status = 400;
    }
  }

  /**
   * 商家端：本商户的商家券列表
   */
  async listForMerchant() {
    const { ctx } = this;
    const merchantId = ctx.state.user.id;
    const { status, page, pageSize } = ctx.query;
    try {
      const result = await ctx.service.coupon.getListForMerchant(merchantId, {
        status: status !== undefined && status !== '' ? parseInt(status, 10) : undefined,
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
      });
      ctx.body = { code: 200, message: '获取成功', data: result };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '获取失败' };
      ctx.status = 400;
    }
  }

  /**
   * 商家端：创建商家券
   */
  async createForMerchant() {
    const { ctx } = this;
    const merchantId = ctx.state.user.id;
    const data = ctx.request.body;
    try {
      const result = await ctx.service.coupon.createForMerchant(merchantId, data);
      ctx.body = { code: 200, success: true, message: '创建成功', data: result.data };
    } catch (error) {
      ctx.body = { success: false, message: error.message || '创建失败' };
      ctx.status = 400;
    }
  }

  /**
   * 商家端：启用/禁用本商户的商家券
   */
  async updateStatusForMerchant() {
    const { ctx } = this;
    const merchantId = ctx.state.user.id;
    const { id } = ctx.params;
    const { status } = ctx.request.body;
    try {
      await ctx.service.coupon.updateStatusForMerchant(merchantId, id, status);
      ctx.body = { code: 200, success: true, message: '更新成功' };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '操作失败' };
      ctx.status = 400;
    }
  }
}

module.exports = CouponController;

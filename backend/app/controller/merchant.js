// app/controller/merchant.js
const Controller = require('egg').Controller;

class MerchantController extends Controller {
  /**
   * 获取商家工作台统计数据
   */
  async getStats() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const { timeRange = 'day' } = ctx.query;

    try {
      const stats = await service.merchant.getStats(merchantId, timeRange);
      ctx.success(stats);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 获取商家订单列表
   */
  async getOrders() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const { status, page = 1, limit = 10 } = ctx.query;

    try {
      const orders = await service.merchant.getOrders(merchantId, {
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      ctx.success(orders);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 获取订单详情
   */
  async getOrderDetail() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = ctx.merchant.id;

    try {
      const order = await service.merchant.getOrderDetail(id, merchantId);
      ctx.success(order);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 发货
   */
  async shipOrder() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = ctx.merchant.id;
    const { company, trackingNo } = ctx.request.body;

    // 验证参数
    if (!company || !trackingNo) {
      ctx.error('请选择快递公司并填写快递单号');
      return;
    }

    try {
      const result = await service.merchant.shipOrder(id, merchantId, {
        company,
        trackingNo,
      });
      ctx.success(result, '发货成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 商户同意退款
   */
  async approveRefund() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = ctx.merchant.id;
    const { reason } = ctx.request.body || {};

    try {
      const order = await service.merchant.approveRefundByMerchant(id, merchantId, reason);
      ctx.success(order, '已同意退款');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 商户拒绝退款
   */
  async rejectRefund() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = ctx.merchant.id;
    const { reason } = ctx.request.body || {};

    try {
      const order = await service.merchant.rejectRefundByMerchant(id, merchantId, reason);
      ctx.success(order, '已拒绝退款');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 扫码核销
   */
  async verifyOrder() {
    const { ctx, service } = this;
    const { code } = ctx.request.body;
    const merchantId = ctx.merchant.id;

    if (!code) {
      ctx.error('请提供核销码');
      return;
    }

    try {
      const result = await service.merchant.verifyOrder(code, merchantId);
      ctx.success(result, '核销成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 商户查看自己商品的用户评价
   */
  async getProductComments() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const { page = 1, pageSize = 10 } = ctx.query;

    try {
      const data = await service.product.getMerchantProductComments(merchantId, {
        page: parseInt(page, 10) || 1,
        pageSize: parseInt(pageSize, 10) || 10,
      });
      ctx.success(data);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 商户回复商品评价
   */
  async replyProductComment() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const { id } = ctx.params;
    const { content } = ctx.request.body || {};

    if (!content || !String(content).trim()) {
      ctx.error('回复内容不能为空');
      return;
    }

    try {
      const reply = await service.product.replyToProductComment(merchantId, id, content);
      ctx.success(reply, '回复成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 获取店铺基本信息（商户本人编辑用）
   */
  async getShopInfo() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    try {
      const info = await service.merchant.getShopInfo(merchantId);
      ctx.success(info);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 更新店铺基本信息
   */
  async updateShopInfo() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const data = ctx.request.body || {};
    try {
      const info = await service.merchant.updateShopInfo(merchantId, data);
      ctx.success(info, '保存成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 获取商家商品列表
   */
  async getProducts() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const { page = 1, limit = 10 } = ctx.query;

    try {
      const products = await service.merchant.getProducts(merchantId, {
        page: parseInt(page),
        limit: parseInt(limit),
      });
      ctx.success(products);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 获取单个商品（编辑用）
   */
  async getProduct() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const { id } = ctx.params;

    try {
      const product = await service.merchant.getProduct(merchantId, id);
      ctx.success(product);
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 创建商品
   */
  async createProduct() {
    const { ctx, service } = this;
    const merchantId = ctx.merchant.id;
    const productData = ctx.request.body;

    try {
      const product = await service.merchant.createProduct(merchantId, productData);
      ctx.success(product, '商品创建成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 更新商品
   */
  async updateProduct() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = ctx.merchant.id;
    const productData = ctx.request.body;

    try {
      const product = await service.merchant.updateProduct(id, merchantId, productData);
      ctx.success(product, '商品更新成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }

  /**
   * 删除商品
   */
  async deleteProduct() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const merchantId = ctx.merchant.id;

    try {
      await service.merchant.deleteProduct(id, merchantId);
      ctx.success(null, '商品删除成功');
    } catch (error) {
      ctx.error(error.message);
    }
  }
}

module.exports = MerchantController;

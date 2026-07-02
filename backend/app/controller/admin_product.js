'use strict';

const Controller = require('egg').Controller;

class AdminProductController extends Controller {
  /**
   * 管理员商品列表（支持待审核/已通过/已拒绝）
   */
  async list() {
    const { ctx, service } = this;
    try {
      const data = await service.product.getAdminProductList(ctx.query || {});
      ctx.success(data);
    } catch (e) {
      ctx.error(e.message || '获取失败');
    }
  }

  /**
   * 管理员审核商品
   * body: { audit_status: 0|1|2, audit_remark?: string }
   */
  async audit() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const body = ctx.request.body || {};
    try {
      const product = await service.product.auditProduct(
        id,
        body.audit_status,
        body.audit_remark,
        ctx.state.user && ctx.state.user.id
      );
      ctx.success(product, '审核成功');
    } catch (e) {
      ctx.error(e.message || '审核失败');
    }
  }

  /**
   * 管理员设置推荐
   * body: { is_recommend: true|false|1|0 }
   */
  async recommend() {
    const { ctx, service } = this;
    const { id } = ctx.params;
    const body = ctx.request.body || {};
    try {
      const product = await service.product.setProductRecommend(
        id,
        body.is_recommend,
        ctx.state.user && ctx.state.user.id
      );
      ctx.success(product, '设置成功');
    } catch (e) {
      ctx.error(e.message || '设置失败');
    }
  }
}

module.exports = AdminProductController;


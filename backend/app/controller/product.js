'use strict';

const Controller = require('egg').Controller;

class ProductController extends Controller {
  /**
   * 获取商品列表
   */
  async list() {
    const { ctx } = this;

    try {
      const result = await ctx.service.product.getProductList(ctx.query);
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
   * 获取商品详情
   */
  async detail() {
    const { ctx } = this;

    try {
      const product = await ctx.service.product.getProductDetail(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: product,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 创建商品
   */
  async create() {
    const { ctx } = this;

    try {
      const product = await ctx.service.product.createProduct({
        ...ctx.request.body,
        merchant_id: ctx.state.user.id,
      });
      ctx.body = {
        code: 200,
        message: '创建成功',
        data: product,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '创建失败',
      };
    }
  }

  /**
   * 更新商品
   */
  async update() {
    const { ctx } = this;

    try {
      const product = await ctx.service.product.updateProduct(ctx.params.id, ctx.request.body);
      ctx.body = {
        code: 200,
        message: '更新成功',
        data: product,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '更新失败',
      };
    }
  }

  /**
   * 删除商品
   */
  async delete() {
    const { ctx } = this;

    try {
      await ctx.service.product.deleteProduct(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '删除成功',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '删除失败',
      };
    }
  }

  /**
   * 获取商品评论列表（含餐饮味道/环境/服务评分）
   */
  async getComments() {
    const { ctx } = this;
    try {
      const id = ctx.params.id;
      const { page, pageSize } = ctx.query;
      const data = await ctx.service.product.getComments(id, {
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      });
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 添加商品评论（餐饮支持味道/环境/服务三维评分，支持图片）
   */
  async addComment() {
    const { ctx } = this;
    try {
      const id = ctx.params.id;
      const userId = ctx.state.user.id;
      const body = ctx.request.body || {};
      const comment = await ctx.service.product.addComment(userId, id, {
        content: body.content,
        images: body.images,
        score: body.score,
        taste_score: body.taste_score,
        environment_score: body.environment_score,
        service_score: body.service_score,
        parent_id: body.parent_id,
        order_id: body.order_id,
      });
      ctx.body = { code: 200, message: '评论成功', data: comment };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '评论失败' };
    }
  }
}

module.exports = ProductController;

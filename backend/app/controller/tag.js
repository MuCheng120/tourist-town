'use strict';

const Controller = require('egg').Controller;

class TagController extends Controller {
  /**
   * 管理员：标签列表（发布酒店时选择标签）
   */
  async listForAdmin() {
    const { ctx } = this;
    try {
      const list = await ctx.service.tag.list();
      ctx.body = { code: 200, message: '获取成功', data: list };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 管理员：创建标签
   */
  async createForAdmin() {
    const { ctx } = this;
    try {
      const tag = await ctx.service.tag.create(ctx.request.body);
      ctx.body = { code: 200, message: '创建成功', data: tag };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '创建失败' };
    }
  }

  async updateForAdmin() {
    const { ctx } = this;
    try {
      const id = ctx.params.id;
      const tag = await ctx.service.tag.update(id, ctx.request.body);
      ctx.body = { code: 200, message: '更新成功', data: tag };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '更新失败' };
    }
  }

  async deleteForAdmin() {
    const { ctx } = this;
    try {
      await ctx.service.tag.remove(ctx.params.id);
      ctx.body = { code: 200, message: '删除成功' };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '删除失败' };
    }
  }
}

module.exports = TagController;

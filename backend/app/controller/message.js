'use strict';

const Controller = require('egg').Controller;

class MessageController extends Controller {
  async list() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const { page, pageSize, is_read } = ctx.query;
    try {
      const data = await ctx.service.message.list(userId, {
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        is_read,
      });
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }

  async markRead() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    const id = ctx.params.id;
    try {
      await ctx.service.message.markRead(userId, id);
      ctx.body = { code: 200, message: '已标记为已读' };
    } catch (e) {
      ctx.body = { code: 400, message: e.message || '操作失败' };
    }
  }

  async unreadCount() {
    const { ctx } = this;
    const userId = ctx.state.user.id;
    try {
      const count = await ctx.service.message.unreadCount(userId);
      ctx.body = { code: 200, data: { count } };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }
}

module.exports = MessageController;

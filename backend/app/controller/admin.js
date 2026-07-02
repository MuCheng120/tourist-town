'use strict';

const Controller = require('egg').Controller;

class AdminController extends Controller {
  /**
   * 创建管理员
   */
  async createAdmin() {
    const { ctx } = this;
    const { username, password, nickname } = ctx.request.body || {};
    try {
      const admin = await ctx.service.admin.createAdmin({ username, password, nickname });
      ctx.body = { code: 200, message: '创建成功', data: admin };
    } catch (e) {
      ctx.body = { code: 400, message: e.message || '创建失败' };
    }
  }

  /**
   * 管理员列表
   */
  async listAdmins() {
    const { ctx } = this;
    try {
      const list = await ctx.service.admin.listAdmins();
      ctx.body = { code: 200, message: '获取成功', data: list };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }
}

module.exports = AdminController;

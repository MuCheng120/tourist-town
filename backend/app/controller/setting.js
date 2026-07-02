'use strict';

const Controller = require('egg').Controller;

class SettingController extends Controller {
  /**
   * 获取咨询电话（公开，景点/住宿致电用）
   */
  async getContactPhone() {
    const { ctx } = this;
    try {
      const contactPhone = await ctx.service.setting.getContactPhone();
      ctx.body = { code: 200, message: '获取成功', data: { contact_phone: contactPhone } };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }

  /**
   * 管理员：获取系统设置
   */
  async getSettings() {
    const { ctx } = this;
    try {
      const data = await ctx.service.setting.getSettings();
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }

  /**
   * 管理员：更新系统设置（如咨询电话）
   */
  async updateSettings() {
    const { ctx } = this;
    const body = ctx.request.body || {};
    try {
      const data = await ctx.service.setting.updateSettings(body);
      ctx.body = { code: 200, message: '保存成功', data };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '保存失败' };
    }
  }
}

module.exports = SettingController;

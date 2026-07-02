'use strict';

const Controller = require('egg').Controller;

class LocationController extends Controller {
  /**
   * 逆地理编码：经纬度 -> 城市名（公开接口，key 存在系统设置中）
   * query: latitude, longitude
   */
  async reverseGeocode() {
    const { ctx } = this;
    try {
      const latitude = ctx.query.latitude;
      const longitude = ctx.query.longitude;
      const data = await ctx.service.location.reverseGeocode({ latitude, longitude });
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }
}

module.exports = LocationController;


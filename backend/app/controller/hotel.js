'use strict';

const Controller = require('egg').Controller;

class HotelController extends Controller {
  /**
   * 酒店列表（介绍卡片），支持按价格、评分、距离排序（需求文档）
   * query: orderBy=sort_order|rating|price|distance, order=asc|desc, latitude, longitude（按距离时必传）
   */
  async list() {
    const { ctx } = this;
    try {
      const orderBy = ctx.query.orderBy || 'distance';
      const order = ctx.query.order || (
        orderBy === 'rating' ? 'desc'
          : orderBy === 'price' ? 'asc'
            : 'asc'
      );
      const latitude = ctx.query.latitude;
      const longitude = ctx.query.longitude;
      const list = await ctx.service.hotel.getHotelList({ orderBy, order, latitude, longitude });
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: list,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 酒店详情（名称、介绍、封面、评分）
   */
  async detail() {
    const { ctx } = this;
    try {
      const hotel = await ctx.service.hotel.getHotelDetail(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: hotel,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 酒店评论列表（含评分）
   */
  async getComments() {
    const { ctx } = this;
    try {
      const data = await ctx.service.hotel.getComments(ctx.params.id, ctx.query);
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 添加酒店评论（需登录，可带评分）
   */
  async addComment() {
    const { ctx } = this;
    try {
      const body = ctx.request.body || {};
      const comment = await ctx.service.hotel.addComment(
        ctx.state.user.id,
        ctx.params.id,
        {
          ...body,
          order_id: body.order_id,
        }
      );
      ctx.body = { code: 200, message: '评论成功', data: comment };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '评论失败' };
    }
  }

  /**
   * 管理员：酒店列表（发布/管理用）
   */
  async listForAdmin() {
    const { ctx } = this;
    try {
      const status = ctx.query.status;
      const list = await ctx.service.hotel.listForAdmin({ status: status !== undefined && status !== '' ? status : undefined });
      ctx.body = { code: 200, message: '获取成功', data: list };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 管理员：酒店详情
   */
  async detailForAdmin() {
    const { ctx } = this;
    try {
      const hotel = await ctx.service.hotel.detailForAdmin(ctx.params.id);
      ctx.body = { code: 200, message: '获取成功', data: hotel };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 管理员：创建酒店
   */
  async createForAdmin() {
    const { ctx } = this;
    try {
      const hotel = await ctx.service.hotel.createHotel(ctx.request.body);
      ctx.body = { code: 200, message: '创建成功', data: hotel };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '创建失败' };
    }
  }

  /**
   * 管理员：更新酒店
   */
  async updateForAdmin() {
    const { ctx } = this;
    try {
      const hotel = await ctx.service.hotel.updateHotel(ctx.params.id, ctx.request.body);
      ctx.body = { code: 200, message: '更新成功', data: hotel };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '更新失败' };
    }
  }

  /**
   * 管理员：删除酒店
   */
  async deleteForAdmin() {
    const { ctx } = this;
    try {
      await ctx.service.hotel.deleteHotel(ctx.params.id);
      ctx.body = { code: 200, message: '删除成功' };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '删除失败' };
    }
  }
}

module.exports = HotelController;

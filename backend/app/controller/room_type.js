'use strict';

const Controller = require('egg').Controller;

class RoomTypeController extends Controller {
  /**
   * 获取房型列表
   */
  async list() {
    const { ctx } = this;

    try {
      const result = await ctx.service.roomType.getRoomTypeList(ctx.query);
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
   * 获取房型详情
   */
  async detail() {
    const { ctx } = this;

    try {
      const roomType = await ctx.service.roomType.getRoomTypeDetail(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: roomType,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 检查库存
   */
  async checkStock() {
    const { ctx } = this;

    try {
      const { id } = ctx.params;
      const { startDate, endDate } = ctx.query;
      const result = await ctx.service.roomType.checkStock(id, startDate, endDate);
      ctx.body = {
        code: 200,
        message: '查询成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '查询失败',
      };
    }
  }

  /**
   * 创建房型
   */
  async create() {
    const { ctx } = this;

    try {
      const roomType = await ctx.service.roomType.createRoomType({
        ...ctx.request.body,
        admin_id: ctx.state.user.id,
      });
      ctx.body = {
        code: 200,
        message: '创建成功',
        data: roomType,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '创建失败',
      };
    }
  }

  /**
   * 更新房型
   */
  async update() {
    const { ctx } = this;

    try {
      const roomType = await ctx.service.roomType.updateRoomType(ctx.params.id, ctx.request.body);
      ctx.body = {
        code: 200,
        message: '更新成功',
        data: roomType,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '更新失败',
      };
    }
  }

  /**
   * 删除房型
   */
  async delete() {
    const { ctx } = this;

    try {
      await ctx.service.roomType.deleteRoomType(ctx.params.id);
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
   * 批量设置库存
   */
  async batchSetStock() {
    const { ctx } = this;

    try {
      await ctx.service.roomType.batchSetStock(ctx.params.id, ctx.request.body.stockList);
      ctx.body = {
        code: 200,
        message: '设置成功',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '设置失败',
      };
    }
  }
}

module.exports = RoomTypeController;

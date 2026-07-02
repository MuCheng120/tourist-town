'use strict';

const Controller = require('egg').Controller;

class AddressController extends Controller {
  /**
   * 获取地址列表
   */
  async list() {
    const { ctx } = this;

    try {
      const list = await ctx.service.address.getAddressList();
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
   * 创建地址
   */
  async create() {
    const { ctx } = this;

    try {
      const address = await ctx.service.address.createAddress(ctx.request.body);
      ctx.body = {
        code: 200,
        message: '添加成功',
        data: address,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '添加失败',
      };
    }
  }

  /**
   * 更新地址
   */
  async update() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      const address = await ctx.service.address.updateAddress(id, ctx.request.body);
      ctx.body = {
        code: 200,
        message: '更新成功',
        data: address,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '更新失败',
      };
    }
  }

  /**
   * 删除地址
   */
  async delete() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      await ctx.service.address.deleteAddress(id);
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
   * 设置默认地址
   */
  async setDefault() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      const address = await ctx.service.address.setDefault(id);
      ctx.body = {
        code: 200,
        message: '设置成功',
        data: address,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '设置失败',
      };
    }
  }

  /**
   * 获取默认地址
   */
  async getDefault() {
    const { ctx } = this;

    try {
      const address = await ctx.service.address.getDefaultAddress();
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: address,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 获取地址详情
   */
  async detail() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      const address = await ctx.service.address.getAddressDetail(id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: address,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }
}

module.exports = AddressController;

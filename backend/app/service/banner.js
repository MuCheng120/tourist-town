'use strict';
const Service = require('egg').Service;

class BannerService extends Service {
  /**
   * 获取Banner列表
   */
  async list({ page = 1, limit = 10, status }) {
    const { ctx } = this;
    const where = {};
    if (status !== undefined) {
      where.status = status;
    }

    const { count, rows } = await ctx.model.Banner.findAndCountAll({
      where,
      order: [[ 'sortOrder', 'ASC' ], [ 'createdAt', 'DESC' ]],
      offset: (page - 1) * limit,
      limit,
    });

    return {
      total: count,
      list: rows,
      page,
      limit,
    };
  }

  /**
   * 获取显示中的Banner列表（用于首页展示）
   */
  async getActiveBanners() {
    const { ctx } = this;
    return await ctx.model.Banner.findAll({
      where: { status: 1 },
      order: [[ 'sortOrder', 'ASC' ], [ 'createdAt', 'DESC' ]],
    });
  }

  /**
   * 获取Banner详情
   */
  async detail(id) {
    const { ctx } = this;
    const banner = await ctx.model.Banner.findByPk(id);
    if (!banner) {
      ctx.throw(404, 'Banner不存在');
    }
    return banner;
  }

  /**
   * 创建Banner
   */
  async create(data) {
    const { ctx } = this;
    return await ctx.model.Banner.create(data);
  }

  /**
   * 更新Banner
   */
  async update(id, data) {
    const { ctx } = this;
    const banner = await ctx.model.Banner.findByPk(id);
    if (!banner) {
      ctx.throw(404, 'Banner不存在');
    }
    return await banner.update(data);
  }

  /**
   * 删除Banner
   */
  async delete(id) {
    const { ctx } = this;
    const banner = await ctx.model.Banner.findByPk(id);
    if (!banner) {
      ctx.throw(404, 'Banner不存在');
    }
    await banner.destroy();
    return { message: '删除成功' };
  }
}

module.exports = BannerService;

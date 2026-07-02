'use strict';
const Service = require('egg').Service;

class AnnouncementService extends Service {
  /**
   * 获取公告列表
   */
  async list({ page = 1, limit = 10, status }) {
    const { ctx } = this;
    const where = {};
    if (status !== undefined) {
      where.status = status;
    }

    const { count, rows } = await ctx.model.Announcement.findAndCountAll({
      where,
      order: [[ 'createdAt', 'DESC' ]],
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
   * 获取公告详情
   */
  async detail(id) {
    const { ctx } = this;
    const announcement = await ctx.model.Announcement.findByPk(id);
    if (!announcement) {
      ctx.throw(404, '公告不存在');
    }
    return announcement;
  }

  /**
   * 创建公告
   */
  async create(data) {
    const { ctx } = this;
    return await ctx.model.Announcement.create(data);
  }

  /**
   * 更新公告
   */
  async update(id, data) {
    const { ctx } = this;
    const announcement = await ctx.model.Announcement.findByPk(id);
    if (!announcement) {
      ctx.throw(404, '公告不存在');
    }
    return await announcement.update(data);
  }

  /**
   * 删除公告
   */
  async delete(id) {
    const { ctx } = this;
    const announcement = await ctx.model.Announcement.findByPk(id);
    if (!announcement) {
      ctx.throw(404, '公告不存在');
    }
    await announcement.destroy();
    return { message: '删除成功' };
  }
}

module.exports = AnnouncementService;

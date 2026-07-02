'use strict';
const Controller = require('egg').Controller;

class AnnouncementController extends Controller {
  /**
   * 获取公告列表
   */
  async list() {
    const { ctx } = this;
    const { page, limit, status } = ctx.query;
    
    const result = await ctx.service.announcement.list({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      status: status !== undefined ? parseInt(status) : undefined,
    });

    ctx.body = {
      code: 200,
      message: 'success',
      data: result,
    };
  }

  /**
   * 获取公告详情
   */
  async detail() {
    const { ctx } = this;
    const { id } = ctx.params;
    
    const announcement = await ctx.service.announcement.detail(id);
    
    ctx.body = {
      code: 200,
      message: 'success',
      data: announcement,
    };
  }

  /**
   * 创建公告
   */
  async create() {
    const { ctx } = this;
    const { title, content, status } = ctx.request.body;

    // 验证必填字段
    if (!title) {
      ctx.body = { code: 400, message: '公告标题不能为空' };
      return;
    }

    const announcement = await ctx.service.announcement.create({
      title,
      content,
      status: status !== undefined ? parseInt(status) : 1,
    });

    ctx.body = {
      code: 200,
      message: '创建成功',
      data: announcement,
    };
  }

  /**
   * 更新公告
   */
  async update() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { title, content, status } = ctx.request.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) updateData.status = parseInt(status);

    const announcement = await ctx.service.announcement.update(id, updateData);

    ctx.body = {
      code: 200,
      message: '更新成功',
      data: announcement,
    };
  }

  /**
   * 删除公告
   */
  async delete() {
    const { ctx } = this;
    const { id } = ctx.params;

    const result = await ctx.service.announcement.delete(id);

    ctx.body = {
      code: 200,
      message: result.message,
    };
  }
}

module.exports = AnnouncementController;

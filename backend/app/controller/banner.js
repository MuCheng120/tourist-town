'use strict';
const Controller = require('egg').Controller;

class BannerController extends Controller {
  /**
   * 获取Banner列表
   */
  async list() {
    const { ctx } = this;
    const { page, limit, status } = ctx.query;
    
    const result = await ctx.service.banner.list({
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
   * 获取显示中的Banner列表（用于首页展示）
   */
  async activeList() {
    const { ctx } = this;
    
    const banners = await ctx.service.banner.getActiveBanners();

    ctx.body = {
      code: 200,
      message: 'success',
      data: banners,
    };
  }

  /**
   * 获取Banner详情
   */
  async detail() {
    const { ctx } = this;
    const { id } = ctx.params;
    
    const banner = await ctx.service.banner.detail(id);
    
    ctx.body = {
      code: 200,
      message: 'success',
      data: banner,
    };
  }

  /**
   * 创建Banner
   */
  async create() {
    const { ctx } = this;
    const { title, image, linkType, linkValue, sortOrder, status } = ctx.request.body;

    // 验证必填字段
    if (!image) {
      ctx.body = { code: 400, message: 'Banner图片不能为空' };
      return;
    }

    const banner = await ctx.service.banner.create({
      title,
      image,
      linkType: linkType || 'none',
      linkValue,
      sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : 0,
      status: status !== undefined ? parseInt(status) : 1,
    });

    ctx.body = {
      code: 200,
      message: '创建成功',
      data: banner,
    };
  }

  /**
   * 更新Banner
   */
  async update() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { title, image, linkType, linkValue, sortOrder, status } = ctx.request.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (image !== undefined) updateData.image = image;
    if (linkType !== undefined) updateData.linkType = linkType;
    if (linkValue !== undefined) updateData.linkValue = linkValue;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder);
    if (status !== undefined) updateData.status = parseInt(status);

    const banner = await ctx.service.banner.update(id, updateData);

    ctx.body = {
      code: 200,
      message: '更新成功',
      data: banner,
    };
  }

  /**
   * 删除Banner
   */
  async delete() {
    const { ctx } = this;
    const { id } = ctx.params;

    const result = await ctx.service.banner.delete(id);

    ctx.body = {
      code: 200,
      message: result.message,
    };
  }
}

module.exports = BannerController;

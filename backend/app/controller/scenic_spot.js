'use strict';

const Controller = require('egg').Controller;

class ScenicSpotController extends Controller {
  isValidHHmm(value) {
    return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());
  }

  isValidOpenRange(value) {
    return /^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());
  }

  validateTicketTypes(ticketTypes) {
    if (ticketTypes == null) return { ok: true, value: null };
    if (!Array.isArray(ticketTypes)) return { ok: false, message: '票种明细格式错误' };
    const normalized = [];
    for (let i = 0; i < ticketTypes.length; i++) {
      const item = ticketTypes[i] || {};
      const name = String(item.name || '').trim();
      const rawPrice = item.price;
      const price = rawPrice !== '' && rawPrice != null ? parseFloat(rawPrice) : NaN;
      if (!name) continue;
      if (Number.isNaN(price) || price < 0) {
        return { ok: false, message: `票种【${name}】价格不合法` };
      }
      normalized.push({
        type: String(item.type || `custom_${i + 1}`).trim(),
        name,
        price,
        remark: String(item.remark || '').trim(),
      });
    }
    return { ok: true, value: normalized };
  }
  /**
   * 获取景点列表
   */
  async list() {
    const { ctx } = this;
    const { page, pageSize, status, sortBy, is_recommend, keyword } = ctx.query;
    const filters = {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      status: status !== undefined ? parseInt(status) : undefined,
      sortBy: sortBy || 'default',
      is_recommend: is_recommend !== undefined ? parseInt(is_recommend) : undefined,
      keyword: keyword ? String(keyword).trim() : undefined,
    };

    try {
      // 有关键词时不使用缓存
      let result;
      if (filters.keyword) {
        result = await ctx.service.scenicSpot.list(filters);
      } else {
        result = await ctx.service.cache.getScenicList(filters.page, filters.pageSize, { status: filters.status, sortBy: filters.sortBy, is_recommend: filters.is_recommend });
        if (!result) {
          result = await ctx.service.scenicSpot.list(filters);
          await ctx.service.cache.setScenicList(filters.page, filters.pageSize, { status: filters.status, sortBy: filters.sortBy, is_recommend: filters.is_recommend }, result, 600);
        }
      }

      // 返回标准格式
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
   * 管理员：获取景点列表（不使用前台缓存）
   */
  async listForAdmin() {
    const { ctx } = this;
    const { page, pageSize, status, sortBy, is_recommend, keyword } = ctx.query;
    const filters = {
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20,
      status: status !== undefined && status !== '' ? parseInt(status, 10) : undefined,
      sortBy: sortBy || 'default',
      is_recommend: is_recommend !== undefined && is_recommend !== '' ? parseInt(is_recommend, 10) : undefined,
      keyword: keyword ? String(keyword).trim() : undefined,
    };
    try {
      const result = await ctx.service.scenicSpot.listForAdmin(filters);
      ctx.body = { code: 200, message: '获取成功', data: result };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 按热度排序的景点列表
   */
  async listByHot() {
    const { ctx } = this;
    const { page, pageSize } = ctx.query;
    const filters = {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      status: 1,
      sortBy: 'hot',
    };

    try {
      const result = await ctx.service.scenicSpot.listByHot(filters);
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
   * 按距离排序的景点列表
   */
  async listByDistance() {
    const { ctx } = this;
    const { userLat, userLng, page, pageSize, order } = ctx.query;
    
    if (!userLat || !userLng) {
      ctx.body = {
        code: 400,
        message: '请提供用户位置信息（userLat和userLng）',
      };
      return;
    }

    const filters = {
      userLat: parseFloat(userLat),
      userLng: parseFloat(userLng),
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
      status: 1,
      order: (String(order || '').toLowerCase() === 'desc') ? 'desc' : 'asc',
    };

    try {
      const result = await ctx.service.scenicSpot.listByDistance(filters);
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
   * 获取景点详情
   */
  async detail() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      // 尝试从缓存获取
      let result = await ctx.service.cache.getScenicDetail(id);
      
      if (!result) {
        // 缓存未命中，从数据库获取
        result = await ctx.service.scenicSpot.detail(id);
        // 设置缓存，有效期1小时
        if (result.success) {
          await ctx.service.cache.setScenicDetail(id, result, 3600);
        }
      }

      // 增加访问计数
      await ctx.service.cache.incrementVisit(`scenic:${id}`);

      // 返回标准格式
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
   * 创建景点（管理员）
   * 支持数据表字段：address, open_time, price, open_status, stop_sale_time, stop_entry_time, ticket_types
   * 注意：P1 起仅接收新字段 address/open_time/price
   */
  async create() {
    const { ctx } = this;
    const body = ctx.request.body;
    const {
      name,
      cover_image,
      images,
      address,
      open_time,
      open_status,
      stop_sale_time,
      stop_entry_time,
      ticket_types,
      price,
      latitude,
      longitude,
      description,
      daily_capacity,
      tags,
      is_recommend,
    } = body;

    const data = {
      name,
      cover_image,
      images,
      address,
      open_time,
      open_status: open_status || 'open',
      stop_sale_time: stop_sale_time || null,
      stop_entry_time: stop_entry_time || null,
      ticket_types: ticket_types || null,
      price: price != null ? parseFloat(price) : 0,
      latitude: latitude != null ? parseFloat(latitude) : null,
      longitude: longitude != null ? parseFloat(longitude) : null,
      description,
      daily_capacity: daily_capacity != null ? parseInt(daily_capacity, 10) : 100,
      tags: tags || [],
      status: 1,
      is_recommend: is_recommend ? 1 : 0,
    };

    try {
      if (!name || !String(name).trim()) {
        ctx.body = { code: 400, message: '景点名称不能为空' };
        return;
      }
      if (!address || !String(address).trim()) {
        ctx.body = { code: 400, message: '景点地址不能为空' };
        return;
      }
      if (latitude == null || longitude == null) {
        ctx.body = { code: 400, message: '请提供景点经纬度' };
        return;
      }
      if (Number.isNaN(data.latitude) || data.latitude < -90 || data.latitude > 90) {
        ctx.body = { code: 400, message: '纬度范围应为-90~90' };
        return;
      }
      if (Number.isNaN(data.longitude) || data.longitude < -180 || data.longitude > 180) {
        ctx.body = { code: 400, message: '经度范围应为-180~180' };
        return;
      }
      if (price == null || Number.isNaN(data.price) || data.price < 0) {
        ctx.body = { code: 400, message: '门票价格必须为大于等于0的数字' };
        return;
      }
      if (data.open_time && !this.isValidOpenRange(data.open_time)) {
        ctx.body = { code: 400, message: '开放时间格式应为 HH:mm-HH:mm' };
        return;
      }
      if (data.stop_sale_time && !this.isValidHHmm(data.stop_sale_time)) {
        ctx.body = { code: 400, message: '停止售票时间格式应为 HH:mm' };
        return;
      }
      if (data.stop_entry_time && !this.isValidHHmm(data.stop_entry_time)) {
        ctx.body = { code: 400, message: '停止入园时间格式应为 HH:mm' };
        return;
      }
      const ticketValidation = this.validateTicketTypes(ticket_types);
      if (!ticketValidation.ok) {
        ctx.body = { code: 400, message: ticketValidation.message };
        return;
      }
      data.ticket_types = ticketValidation.value;
      const result = await ctx.service.scenicSpot.create(data);
      await ctx.service.cache.clearScenicCache();
      ctx.body = { code: 200, message: '创建成功', data: result };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '创建失败' };
    }
  }

  /**
   * 更新景点（管理员）
   * 支持数据表字段：address, open_time, price, open_status, stop_sale_time, stop_entry_time, ticket_types 等
   */
  async update() {
    const { ctx } = this;
    const { id } = ctx.params;
    const body = ctx.request.body;
    const {
      name,
      cover_image,
      images,
      address,
      open_time,
      open_status,
      stop_sale_time,
      stop_entry_time,
      ticket_types,
      price,
      latitude,
      longitude,
      description,
      daily_capacity,
      tags,
      status,
      is_recommend,
    } = body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (cover_image !== undefined) updateData.cover_image = cover_image;
    if (images !== undefined) updateData.images = images;
    if (address !== undefined) updateData.address = address;
    if (open_time !== undefined) updateData.open_time = open_time;
    if (open_status !== undefined) updateData.open_status = open_status;
    if (stop_sale_time !== undefined) updateData.stop_sale_time = stop_sale_time;
    if (stop_entry_time !== undefined) updateData.stop_entry_time = stop_entry_time;
    if (ticket_types !== undefined) {
      const ticketValidation = this.validateTicketTypes(ticket_types);
      if (!ticketValidation.ok) {
        ctx.body = { code: 400, message: ticketValidation.message };
        return;
      }
      updateData.ticket_types = ticketValidation.value;
    }
    if (price !== undefined) updateData.price = parseFloat(price);
    if (latitude !== undefined) updateData.latitude = latitude != null ? parseFloat(latitude) : null;
    if (longitude !== undefined) updateData.longitude = longitude != null ? parseFloat(longitude) : null;
    if (description !== undefined) updateData.description = description;
    if (daily_capacity !== undefined) updateData.daily_capacity = parseInt(daily_capacity, 10);
    if (tags !== undefined) updateData.tags = tags;
    if (status !== undefined) updateData.status = status;
    if (is_recommend !== undefined) updateData.is_recommend = is_recommend ? 1 : 0;

    if (updateData.open_time !== undefined && updateData.open_time && !this.isValidOpenRange(updateData.open_time)) {
      ctx.body = { code: 400, message: '开放时间格式应为 HH:mm-HH:mm' };
      return;
    }
    if (updateData.stop_sale_time !== undefined && updateData.stop_sale_time && !this.isValidHHmm(updateData.stop_sale_time)) {
      ctx.body = { code: 400, message: '停止售票时间格式应为 HH:mm' };
      return;
    }
    if (updateData.stop_entry_time !== undefined && updateData.stop_entry_time && !this.isValidHHmm(updateData.stop_entry_time)) {
      ctx.body = { code: 400, message: '停止入园时间格式应为 HH:mm' };
      return;
    }
    if (updateData.price !== undefined && (Number.isNaN(updateData.price) || updateData.price < 0)) {
      ctx.body = { code: 400, message: '门票价格必须为大于等于0的数字' };
      return;
    }
    if (updateData.latitude !== undefined && updateData.latitude !== null && (Number.isNaN(updateData.latitude) || updateData.latitude < -90 || updateData.latitude > 90)) {
      ctx.body = { code: 400, message: '纬度范围应为-90~90' };
      return;
    }
    if (updateData.longitude !== undefined && updateData.longitude !== null && (Number.isNaN(updateData.longitude) || updateData.longitude < -180 || updateData.longitude > 180)) {
      ctx.body = { code: 400, message: '经度范围应为-180~180' };
      return;
    }

    const result = await ctx.service.scenicSpot.update(id, updateData);

    if (result) {
      await ctx.service.cache.clearScenicCache();
    }

    ctx.body = result ? { code: 200, message: '更新成功', data: result } : { code: 500, message: '更新失败' };
  }

  /**
   * 删除景点（管理员）
   */
  async delete() {
    const { ctx } = this;
    const { id } = ctx.params;

    try {
      await ctx.service.scenicSpot.delete(id);
      await ctx.service.cache.clearScenicCache();
      ctx.body = { code: 200, message: '删除成功' };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '删除失败' };
    }
  }

  /**
   * 获取景点评论
   */
  async getComments() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { page, pageSize } = ctx.query;

    const data = await ctx.service.scenicSpot.getComments(id, {
      page: parseInt(page) || 1,
      pageSize: parseInt(pageSize) || 10,
    });
    ctx.success(data, '获取评论成功');
  }

  /**
   * 添加景点评论
   */
  async addComment() {
    const { ctx } = this;
    const { id } = ctx.params;
    const userId = ctx.state.user.id;
    const { content, images, score, parent_id, reply_to_user_id, order_id } = ctx.request.body;

    try {
      // 内容安全检查
      const textCheck = await ctx.service.security.checkText(content);
      if (!textCheck.pass) {
        ctx.body = { code: 400, message: textCheck.message || '内容包含违规信息' };
        return;
      }
      const data = await ctx.service.scenicSpot.addComment(userId, id, {
        content,
        images,
        score,
        parent_id,
        reply_to_user_id,
        order_id,
        status: textCheck.needAudit ? 0 : 1,
      });
      ctx.success(data, '评论成功');
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '评论失败' };
    }
  }

  async commentEligibility() {
    const { ctx } = this;
    const { id } = ctx.params;
    const userId = ctx.state.user.id;
    try {
      const result = await ctx.service.scenicSpot.getCommentEligibility(userId, id);
      ctx.success(result, '获取成功');
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }
}

module.exports = ScenicSpotController;

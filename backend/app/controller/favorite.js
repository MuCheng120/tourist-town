'use strict';

const Controller = require('egg').Controller;

class FavoriteController extends Controller {
  /**
   * 添加收藏 POST /api/favorites
   * body: { target_type: 'hotel', target_id: 1 }
   */
  async add() {
    const { ctx } = this;
    try {
      const { target_type: targetType, target_id: targetId } = ctx.request.body;
      await ctx.service.favorite.add(ctx.state.user.id, targetId, targetType);
      ctx.body = { code: 200, message: '收藏成功' };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '收藏失败' };
    }
  }

  /**
   * 取消收藏 DELETE /api/favorites/:targetType/:targetId
   */
  async remove() {
    const { ctx } = this;
    try {
      const { targetType, targetId } = ctx.params;
      await ctx.service.favorite.remove(ctx.state.user.id, targetId, targetType);
      ctx.body = { code: 200, message: '已取消收藏' };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '取消失败' };
    }
  }

  /**
   * 是否已收藏 GET /api/favorites/check?target_type=hotel&target_id=1
   */
  async check() {
    const { ctx } = this;
    try {
      const { target_type: targetType, target_id: targetId } = ctx.query;
      const has = await ctx.service.favorite.has(ctx.state.user.id, targetId, targetType);
      ctx.body = { code: 200, data: { favorited: has } };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '查询失败' };
    }
  }

  /**
   * 我的收藏列表 GET /api/favorites?target_type=hotel&page=1&pageSize=20
   */
  async list() {
    const { ctx } = this;
    try {
      const result = await ctx.service.favorite.list(ctx.state.user.id, ctx.query);
      ctx.body = { code: 200, data: result };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '获取失败' };
    }
  }
}

module.exports = FavoriteController;

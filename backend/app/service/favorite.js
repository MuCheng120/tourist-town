'use strict';

const Service = require('egg').Service;

class FavoriteService extends Service {
  /**
   * 添加收藏
   * @param {Number} userId - 用户ID
   * @param {Number} targetId - 目标ID（酒店/景点/商品）
   * @param {String} targetType - 类型：hotel | scenic | product | post
   */
  async add(userId, targetId, targetType) {
    const { ctx } = this;
    const id = Number(targetId);
    const type = String(targetType || 'hotel').toLowerCase();
    if (!id || !type) throw new Error('参数错误');
    if (![ 'hotel', 'scenic', 'product', 'post' ].includes(type)) throw new Error('不支持的收藏类型');

    if (type === 'post') {
      const post = await ctx.model.Post.findByPk(id, { attributes: [ 'user_id' ] });
      if (post && post.user_id === userId) throw new Error('不能收藏自己的攻略');
    }

    const [ row, created ] = await ctx.model.UserFavorite.findOrCreate({
      where: { user_id: userId, target_type: type, target_id: id },
      defaults: { user_id: userId, target_type: type, target_id: id },
    });
    if (type === 'post' && created) {
      await ctx.model.Post.increment('favorite_count', { where: { id } });
    }
    return row;
  }

  /**
   * 取消收藏
   */
  async remove(userId, targetId, targetType) {
    const { ctx } = this;
    const id = Number(targetId);
    const type = String(targetType || 'hotel').toLowerCase();
    if (![ 'hotel', 'scenic', 'product', 'post' ].includes(type)) throw new Error('不支持的收藏类型');
    const n = await ctx.model.UserFavorite.destroy({
      where: { user_id: userId, target_type: type, target_id: id },
    });
    if (type === 'post' && n > 0) {
      await ctx.model.Post.decrement('favorite_count', { where: { id } });
    }
    return { deleted: n > 0 };
  }

  /**
   * 检查是否已收藏
   */
  async has(userId, targetId, targetType) {
    const { ctx } = this;
    const row = await ctx.model.UserFavorite.findOne({
      where: {
        user_id: userId,
        target_type: String(targetType || 'hotel').toLowerCase(),
        target_id: Number(targetId),
      },
    });
    return !!row;
  }

  /**
   * 我的收藏列表（支持按类型筛选，返回目标详情）
   * @param {Number} userId - 用户ID
   * @param {Object} params - { target_type, page, pageSize }
   */
  async list(userId, params = {}) {
    const { ctx } = this;
    const { target_type: targetType = 'hotel', page = 1, pageSize = 20 } = params;
    const pageNum = Number(page) || 1;
    const limit = Number(pageSize) || 20;
    const type = String(targetType).toLowerCase();
    if (![ 'hotel', 'scenic', 'product', 'post' ].includes(type)) {
      return { total: 0, page: pageNum, pageSize: limit, list: [] };
    }

    const { count, rows } = await ctx.model.UserFavorite.findAndCountAll({
      where: { user_id: userId, target_type: type },
      order: [[ 'created_at', 'DESC' ]],
      limit,
      offset: (pageNum - 1) * limit,
    });

    const ids = rows.map(r => r.target_id);
    if (ids.length === 0) return { total: count, page: pageNum, pageSize: limit, list: [] };

    let list = [];
    if (type === 'hotel') {
      const hotels = await ctx.model.Hotel.findAll({
        where: { id: ids, status: 1 },
        attributes: [ 'id', 'name', 'introduction', 'cover_image', 'rating', 'rating_count' ],
      });
      const map = new Map(hotels.map(h => [ h.id, h.toJSON() ]));
      list = ids.map(id => map.get(id)).filter(Boolean);
    } else if (type === 'post') {
      const posts = await ctx.model.Post.findAll({
        where: { id: ids, status: 1 },
        attributes: [ 'id', 'title', 'content', 'images', 'location', 'likes_count', 'comments_count', 'views_count', 'category', 'created_at' ],
        include: [
          { model: ctx.model.User, as: 'user', attributes: [ 'id', 'nickname', 'avatar' ] },
        ],
      });
      const map = new Map(posts.map(p => [ p.id, p.toJSON() ]));
      list = ids.map(id => map.get(id)).filter(Boolean);
      list.forEach(p => {
        if (p && typeof p.images === 'string') {
          try { p.images = JSON.parse(p.images); } catch (e) { p.images = []; }
        }
        if (!Array.isArray(p.images)) p.images = [];
      });
    } else if (type === 'product') {
      const products = await ctx.model.Product.findAll({
        where: { id: ids, status: 1 },
        attributes: [ 'id', 'name', 'cover_image', 'images', 'price', 'sales_count', 'product_type', 'category' ],
      });
      const map = new Map();
      products.forEach(p => {
        const data = p.toJSON();
        if (data.images && typeof data.images === 'string') {
          try { data.images = JSON.parse(data.images); } catch (e) { data.images = []; }
        }
        if (!Array.isArray(data.images)) data.images = [];
        map.set(p.id, data);
      });
      list = ids.map(id => map.get(id)).filter(Boolean);
    } else if (type === 'scenic') {
      const spots = await ctx.model.ScenicSpot.findAll({
        where: { id: ids, status: 1 },
        attributes: [ 'id', 'name', 'cover_image', 'images', 'open_time', 'price', 'rating', 'rating_count', 'description' ],
      });
      const map = new Map();
      spots.forEach(s => {
        const data = s.toJSON();
        if (data.images && typeof data.images === 'string') {
          try { data.images = JSON.parse(data.images); } catch (e) { data.images = []; }
        }
        if (!Array.isArray(data.images)) data.images = [];
        data.opening_hours = data.open_time;
        data.ticket_price = data.price;
        map.set(s.id, data);
      });
      list = ids.map(id => map.get(id)).filter(Boolean);
    }

    return { total: count, page: pageNum, pageSize: limit, list };
  }
}

module.exports = FavoriteService;

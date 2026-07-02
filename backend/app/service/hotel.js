'use strict';

const Service = require('egg').Service;

const TAG_INCLUDE_ATTRS = [ 'id', 'name', 'description' ];

function mapHotelTag(t) {
  const x = t && typeof t.toJSON === 'function' ? t.toJSON() : t;
  return {
    id: x.id,
    name: x.name,
    description: (x.description && String(x.description).trim()) || '',
  };
}

class HotelService extends Service {
  normalizePolicyInfo(policyInfo) {
    if (policyInfo == null || policyInfo === '') return null;
    if (typeof policyInfo === 'string') {
      try {
        const parsed = JSON.parse(policyInfo);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    if (typeof policyInfo === 'object') return policyInfo;
    return null;
  }

  async assertHotelOrderEligibleForTopComment(userId, hotelId, orderIdRaw) {
    const { ctx } = this;
    const oid = Number(orderIdRaw);
    const hid = Number(hotelId);
    if (!oid || Number.isNaN(oid)) {
      throw new Error('请指定要评价的订单');
    }

    const order = await ctx.model.Order.findByPk(oid, {
      include: [{
        model: ctx.model.RoomType,
        as: 'room_type',
        attributes: [ 'id', 'hotel_id' ],
      }],
    });
    if (!order) throw new Error('订单不存在');
    if (order.user_id !== userId) throw new Error('无权使用该订单评价');
    if (order.order_type !== 'hotel') throw new Error('订单类型不正确');
    if (![ 'completed', 'verified' ].includes(order.status)) {
      throw new Error('请先完成入住后再评论');
    }
    const orderHotelId = order.room_type && order.room_type.hotel_id ? Number(order.room_type.hotel_id) : 0;
    if (!orderHotelId || orderHotelId !== hid) {
      throw new Error('订单与酒店不匹配');
    }

    const dup = await ctx.model.Comment.findOne({
      where: {
        order_id: oid,
        parent_id: 0,
        post_type: 'hotel',
      },
      attributes: [ 'id' ],
    });
    if (dup) throw new Error('该订单已评价');
    return order;
  }

  /**
   * 酒店列表（用于列表页介绍卡片）
   * @param {Object} options - orderBy: 'sort_order' | 'rating' | 'price' | 'distance'，order: 'asc' | 'desc'，latitude/longitude 用于按距离排序
   */
  async getHotelList(options = {}) {
    const { ctx, app } = this;
    const { Sequelize } = app.model;
    const orderBy = options.orderBy || 'distance';
    const orderDir = (options.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const userLat = options.latitude != null ? parseFloat(options.latitude) : null;
    const userLng = options.longitude != null ? parseFloat(options.longitude) : null;
    const isDistanceSort = orderBy === 'distance' && userLat != null && userLng != null && !Number.isNaN(userLat) && !Number.isNaN(userLng);

    // 子查询：该酒店最低房型价格（供排序与“起价”展示）
    const priceSubquery = Sequelize.literal(
      `(SELECT MIN(rt.price) FROM room_types rt WHERE rt.hotel_id = hotel.id AND rt.deleted_at IS NULL AND rt.status = 1)`
    );
    const commentCountSubquery = Sequelize.literal(
      `(SELECT COUNT(*) FROM comments c WHERE c.post_id = hotel.id AND c.post_type = 'hotel' AND c.status = 1 AND c.parent_id = 0 AND c.deleted_at IS NULL)`
    );
    const favoriteCountSubquery = Sequelize.literal(
      `(SELECT COUNT(*) FROM user_favorites uf WHERE uf.target_type = 'hotel' AND uf.target_id = hotel.id)`
    );
    const baseAttrs = [
      'id', 'name', 'introduction', 'address', 'latitude', 'longitude', 'list_stock_tip',
      'cover_image', 'sort_order', 'rating', 'rating_count',
      [ priceSubquery, 'min_price' ],
      [ commentCountSubquery, 'comment_count' ],
      [ favoriteCountSubquery, 'favorite_count' ],
    ];

    if (isDistanceSort) {
      return this._getHotelListByDistance({ ctx, app, baseAttrs, userLat, userLng, orderDir });
    }

    const order = this._buildHotelListOrder(orderBy, orderDir, priceSubquery, favoriteCountSubquery);
    const rows = await ctx.model.Hotel.findAll({
      where: { status: 1 },
      order,
      attributes: baseAttrs,
      include: [
        { model: ctx.model.Tag, as: 'tags', attributes: TAG_INCLUDE_ATTRS, through: { attributes: [] }, required: false },
      ],
    });
    return rows.map(r => {
      const j = r.toJSON();
      j.comment_count = Number(j.comment_count) || 0;
      j.favorite_count = Number(j.favorite_count) || 0;
      if (j.tags) j.tags = j.tags.map(mapHotelTag);
      return j;
    });
  }

  /**
   * 按用户当前位置距离排序的酒店列表（附近酒店）
   */
  async _getHotelListByDistance({ ctx, app, baseAttrs, userLat, userLng, orderDir }) {
    // 本项目 sequelize 实例挂在 app.model（参照 scenic_spot 距离排序实现）
    const sequelize = app.model;
    const orderDirection = orderDir === 'DESC' ? 'DESC' : 'ASC';
    const sql = `
      SELECT id,
        (ST_Distance_Sphere(POINT(longitude, latitude), POINT(:userLng, :userLat)) / 1000) AS distance
      FROM hotels
      WHERE status = 1 AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY distance ${orderDirection}
    `;
    const rowsWithDistance = await sequelize.query(sql, {
      replacements: { userLat, userLng },
      type: sequelize.QueryTypes.SELECT,
    });
    const idsWithDist = Array.isArray(rowsWithDistance) ? rowsWithDistance : [];
    const ids = idsWithDist.map(r => r.id);
    const idToDistance = Object.fromEntries(idsWithDist.map(r => [ r.id, Math.round(r.distance * 100) / 100 ]));

    // 没有经纬度的酒店排在后面
    const rowsAll = await ctx.model.Hotel.findAll({
      where: { status: 1 },
      attributes: baseAttrs,
      include: [
        { model: ctx.model.Tag, as: 'tags', attributes: TAG_INCLUDE_ATTRS, through: { attributes: [] }, required: false },
      ],
    });
    
    // 按ids数组的顺序（即距离排序的顺序）构建结果
    const result = [];
    const hotelMap = new Map();
    
    // 先将所有酒店放入map中
    for (const r of rowsAll) {
      const j = r.toJSON();
      j.comment_count = Number(j.comment_count) || 0;
      j.favorite_count = Number(j.favorite_count) || 0;
      if (j.tags) j.tags = j.tags.map(mapHotelTag);
      const dist = idToDistance[j.id];
      if (dist != null) {
        j.distance = dist;
      }
      hotelMap.set(j.id, j);
    }
    
    // 按距离排序的顺序添加酒店
    for (const id of ids) {
      const hotel = hotelMap.get(id);
      if (hotel) {
        result.push(hotel);
        hotelMap.delete(id);
      }
    }
    
    // 添加剩下的没有经纬度的酒店
    for (const hotel of hotelMap.values()) {
      result.push(hotel);
    }
    
    return result;
  }

  /**
   * 根据排序方式生成 order 配置（需求：支持按价格、评分等条件筛选）
   */
  _buildHotelListOrder(orderBy, orderDir, priceSubquery, favoriteCountSubquery) {
    const { ctx } = this;
    const { Sequelize } = ctx.app.model;
    const secondary = [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]];

    switch (orderBy) {
      case 'rating':
        return [[ 'rating', orderDir ], [ Sequelize.literal('rating IS NULL'), 'ASC' ], ...secondary ];
      case 'price':
        return [
          [ priceSubquery, orderDir ],
          [ Sequelize.literal('(SELECT MIN(rt.price) FROM room_types rt WHERE rt.hotel_id = hotel.id AND rt.deleted_at IS NULL AND rt.status = 1) IS NULL'), 'ASC' ],
          ...secondary,
        ];
      default:
        return [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]];
    }
  }

  /**
   * 酒店详情（用于详情页头部）
   */
  async getHotelDetail(id) {
    const { ctx } = this;
    const hotel = await ctx.model.Hotel.findByPk(id, {
      attributes: [ 'id', 'name', 'introduction', 'policy_info', 'address', 'latitude', 'longitude', 'cover_image', 'rating', 'rating_count' ],
      include: [
        { model: ctx.model.Tag, as: 'tags', attributes: TAG_INCLUDE_ATTRS, through: { attributes: [] }, required: false },
      ],
    });
    if (!hotel) {
      throw new Error('酒店不存在');
    }
    const json = hotel.toJSON();
    if (json.tags) json.tags = json.tags.map(mapHotelTag);
    json.review_dimension_avg = await this.getReviewDimensionAverages(id);
    return json;
  }

  /**
   * 已通过的酒店首评分项均值（用于详情「住客点评」）
   * 卫生/环境/服务/设施对应 comments 各分项；仅统计有效星数（>0）的评论子集求均值
   */
  async getReviewDimensionAverages(hotelId) {
    const { ctx } = this;
    const rows = await ctx.model.Comment.findAll({
      where: {
        post_id: hotelId,
        post_type: 'hotel',
        status: 1,
        parent_id: 0,
      },
      attributes: [ 'score', 'environment_score', 'service_score', 'hygiene_score', 'facility_score' ],
      raw: true,
    });
    if (!rows.length) {
      return { overall: null, hygiene: null, environment: null, service: null, facility: null };
    }
    const round2 = v => Math.round(Number(v) * 100) / 100;
    const avg = pick => {
      const vals = rows.map(pick).filter(v => v != null && Number(v) > 0).map(Number);
      if (!vals.length) return null;
      return round2(vals.reduce((a, b) => a + b, 0) / vals.length);
    };
    const overall = avg(r => r.score);
    return {
      overall,
      hygiene: avg(r => r.hygiene_score),
      environment: avg(r => r.environment_score),
      service: avg(r => r.service_score),
      facility: avg(r => r.facility_score),
    };
  }

  /**
   * 获取酒店评论列表（含评分）
   */
  async getComments(hotelId, { page = 1, pageSize = 10 } = {}) {
    const { ctx } = this;
    const hotel = await ctx.model.Hotel.findByPk(hotelId);
    if (!hotel) throw new Error('酒店不存在');
    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const sizeNum = Number(pageSize) > 0 ? Number(pageSize) : 10;

    const { count, rows } = await ctx.model.Comment.findAndCountAll({
      where: {
        post_id: hotelId,
        post_type: 'hotel',
        status: 1,
        parent_id: 0,
      },
      include: [
        { model: ctx.model.User, as: 'user', attributes: [ 'id', 'nickname', 'avatar' ] },
        {
          model: ctx.model.Comment,
          as: 'replies',
          where: { status: 1 },
          required: false,
          include: [
            { model: ctx.model.User, as: 'user', attributes: [ 'id', 'nickname', 'avatar' ] },
            { model: ctx.model.User, as: 'reply_to_user', attributes: [ 'id', 'nickname' ] },
          ],
        },
      ],
      limit: sizeNum,
      offset: (pageNum - 1) * sizeNum,
      order: [[ 'created_at', 'DESC' ]],
    });

    return { total: count, page: pageNum, pageSize: sizeNum, list: rows };
  }

  /**
   * 添加酒店评论（卫生/环境/服务/设施四维评分，待审核）
   * 综合 score 为已填分项（>0）的算术平均，供 updateRating 使用
   */
  async addComment(userId, hotelId, { content, images, score, environment_score, service_score, hygiene_score, facility_score, parent_id, reply_to_user_id, order_id }) {
    const { ctx } = this;
    const hotel = await ctx.model.Hotel.findByPk(hotelId);
    if (!hotel) throw new Error('酒店不存在');
    const isTop = !parent_id || Number(parent_id) === 0;
    let orderIdToSave = null;

    if (isTop) {
      await this.assertHotelOrderEligibleForTopComment(userId, hotelId, order_id);
      orderIdToSave = Number(order_id);
    }

    if (parent_id && parent_id !== 0) {
      const parentComment = await ctx.model.Comment.findOne({
        where: { id: parent_id, post_id: hotelId, post_type: 'hotel' },
      });
      if (!parentComment) throw new Error('父评论不存在');
    }

    const securityResult = await ctx.service.security.checkText(content || '');
    const needAudit = securityResult.needAudit;

    const clampStar = v => {
      if (v == null || v === '') return null;
      const n = Math.round(Number(v));
      if (Number.isNaN(n) || n <= 0) return null;
      return Math.min(5, Math.max(1, n));
    };
    const env = clampStar(environment_score);
    const svc = clampStar(service_score);
    const hyg = clampStar(hygiene_score);
    const fac = clampStar(facility_score);
    const dimVals = [ hyg, env, svc, fac ].filter(v => v != null);
    let finalScore;
    if (dimVals.length > 0) {
      finalScore = Math.round((dimVals.reduce((a, b) => a + b, 0) / dimVals.length) * 100) / 100;
    } else {
      const s = clampStar(score);
      finalScore = s != null ? s : 0;
    }

    const comment = await ctx.model.Comment.create({
      post_id: hotelId,
      post_type: 'hotel',
      user_id: userId,
      order_id: orderIdToSave,
      content: content || '',
      images: images || [],
      score: finalScore,
      hygiene_score: hyg,
      environment_score: env,
      service_score: svc,
      facility_score: fac,
      parent_id: parent_id || 0,
      reply_to_user_id: reply_to_user_id || null,
      status: needAudit ? 0 : 1,
    });

    if (!needAudit) {
      await this.updateRating(hotelId);
    }
    return comment;
  }

  /**
   * 管理员：酒店列表（含全部状态、最低价，与前端列表/详情展示对齐）
   */
  async listForAdmin({ status } = {}) {
    const { ctx, app } = this;
    const { Sequelize } = app.model;
    const where = {};
    if (status !== undefined && status !== '') where.status = parseInt(status, 10);
    const priceSubquery = Sequelize.literal(
      `(SELECT MIN(rt.price) FROM room_types rt WHERE rt.hotel_id = hotel.id AND rt.deleted_at IS NULL AND rt.status = 1)`
    );
    const rows = await ctx.model.Hotel.findAll({
      where,
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
      attributes: [
        'id', 'name', 'introduction', 'policy_info', 'address', 'latitude', 'longitude', 'list_stock_tip',
        'cover_image', 'sort_order', 'status', 'rating', 'rating_count', 'created_at',
        [ priceSubquery, 'min_price' ],
      ],
      include: [
        { model: ctx.model.Tag, as: 'tags', attributes: TAG_INCLUDE_ATTRS, through: { attributes: [] }, required: false },
      ],
    });
    return rows.map(r => {
      const j = r.toJSON();
      j.min_price = j.min_price != null ? Number(j.min_price) : null;
      return j;
    });
  }

  /**
   * 管理员：酒店详情
   */
  async detailForAdmin(id) {
    const { ctx } = this;
    const hotel = await ctx.model.Hotel.findByPk(id, {
      attributes: [
        'id', 'name', 'introduction', 'policy_info', 'address', 'latitude', 'longitude', 'list_stock_tip',
        'cover_image', 'sort_order', 'status', 'rating', 'rating_count', 'created_at',
      ],
      include: [
        { model: ctx.model.Tag, as: 'tags', attributes: TAG_INCLUDE_ATTRS, through: { attributes: [] }, required: false },
      ],
    });
    if (!hotel) throw new Error('酒店不存在');
    return hotel.toJSON();
  }

  /**
   * 管理员：创建酒店
   */
  async createHotel(data) {
    const { ctx } = this;
    const tagIds = Array.isArray(data.tag_ids) ? data.tag_ids : [];
    const policyInfo = this.normalizePolicyInfo(data.policy_info);
    const hotel = await ctx.model.Hotel.create({
      name: data.name || '',
      introduction: data.introduction || '',
      policy_info: policyInfo,
      address: data.address || null,
      latitude: data.latitude != null ? data.latitude : null,
      longitude: data.longitude != null ? data.longitude : null,
      list_stock_tip: data.list_stock_tip || null,
      cover_image: data.cover_image || null,
      sort_order: data.sort_order != null ? data.sort_order : 0,
      status: data.status != null ? data.status : 1,
    });
    if (tagIds.length > 0) {
      await hotel.setTags(tagIds);
    }
    const json = hotel.toJSON();
    const tags = await hotel.getTags({ attributes: TAG_INCLUDE_ATTRS });
    json.tags = tags.map(mapHotelTag);
    return json;
  }

  /**
   * 管理员：更新酒店
   */
  async updateHotel(id, data) {
    const { ctx } = this;
    const hotel = await ctx.model.Hotel.findByPk(id);
    if (!hotel) throw new Error('酒店不存在');
    const policyInfo = data.policy_info !== undefined ? this.normalizePolicyInfo(data.policy_info) : hotel.policy_info;
    await hotel.update({
      name: data.name !== undefined ? data.name : hotel.name,
      introduction: data.introduction !== undefined ? data.introduction : hotel.introduction,
      policy_info: policyInfo,
      address: data.address !== undefined ? data.address : hotel.address,
      latitude: data.latitude !== undefined ? data.latitude : hotel.latitude,
      longitude: data.longitude !== undefined ? data.longitude : hotel.longitude,
      list_stock_tip: data.list_stock_tip !== undefined ? data.list_stock_tip : hotel.list_stock_tip,
      cover_image: data.cover_image !== undefined ? data.cover_image : hotel.cover_image,
      sort_order: data.sort_order !== undefined ? data.sort_order : hotel.sort_order,
      status: data.status !== undefined ? data.status : hotel.status,
    });
    if (Array.isArray(data.tag_ids)) {
      await hotel.setTags(data.tag_ids);
    }
    const json = hotel.toJSON();
    const tags = await hotel.getTags({ attributes: TAG_INCLUDE_ATTRS });
    json.tags = tags.map(mapHotelTag);
    return json;
  }

  /**
   * 管理员：删除酒店
   */
  async deleteHotel(id) {
    const { ctx } = this;
    const hotel = await ctx.model.Hotel.findByPk(id);
    if (!hotel) throw new Error('酒店不存在');
    await hotel.destroy();
    return { message: '删除成功' };
  }

  /**
   * 更新酒店平均评分（审核通过后调用）
   */
  async updateRating(hotelId) {
    const { ctx } = this;
    const { Op } = ctx.app.Sequelize;

    const comments = await ctx.model.Comment.findAll({
      where: {
        post_id: hotelId,
        post_type: 'hotel',
        status: 1,
        parent_id: 0,
        score: { [Op.ne]: null },
      },
      attributes: [ 'score' ],
    });

    const count = comments.length;
    const sum = comments.reduce((s, c) => s + (c.score || 0), 0);
    const rating = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;

    await ctx.model.Hotel.update(
      { rating, rating_count: count },
      { where: { id: hotelId } }
    );
    return { rating, rating_count: count };
  }
}

module.exports = HotelService;

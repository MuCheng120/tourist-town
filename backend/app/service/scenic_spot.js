'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

class ScenicSpotService extends Service {
  async getCommentEligibility(userId, spotId) {
    const { app } = this;
    const sid = Number(spotId);
    const spot = await app.model.ScenicSpot.findByPk(sid, { attributes: [ 'id' ] });
    if (!spot) {
      return { canComment: false, message: '景点不存在', reviewableOrders: [] };
    }

    const orders = await app.model.Order.findAll({
      where: {
        user_id: userId,
        order_type: 'scenic',
        spot_id: sid,
        status: { [Op.in]: [ 'verified', 'completed' ] },
      },
      attributes: [ 'id', 'order_no' ],
      order: [[ 'created_at', 'DESC' ]],
    });

    if (orders.length === 0) {
      return {
        canComment: false,
        message: '请先核销该景点门票后再评论',
        reviewableOrders: [],
      };
    }

    const orderIds = orders.map(o => o.id);
    const usedRows = await app.model.Comment.findAll({
      where: {
        order_id: { [Op.in]: orderIds },
        parent_id: 0,
        post_type: 'scenic',
      },
      attributes: [ 'order_id' ],
    });
    const usedOrderIds = new Set(usedRows.map(c => c.order_id));

    const reviewableOrders = orders
      .filter(o => !usedOrderIds.has(o.id))
      .map(o => ({ id: o.id, order_no: o.order_no }));

    if (reviewableOrders.length === 0) {
      return {
        canComment: false,
        message: '暂无可评价订单（每笔订单仅可评价一次）',
        reviewableOrders: [],
      };
    }

    return {
      canComment: true,
      message: '可发表评论',
      reviewableOrders,
    };
  }

  /**
   * 校验门票订单可用于该景点的一级评论（归属、状态、未占用）
   */
  async assertScenicOrderEligibleForTopComment(userId, spotId, orderIdRaw) {
    const { app } = this;
    const sid = Number(spotId);
    const oid = Number(orderIdRaw);
    if (!oid || Number.isNaN(oid)) {
      throw new Error('请指定要评价的门票订单');
    }

    const order = await app.model.Order.findByPk(oid);
    if (!order) {
      throw new Error('订单不存在');
    }
    if (order.user_id !== userId) {
      throw new Error('无权使用该订单评价');
    }
    if (order.order_type !== 'scenic') {
      throw new Error('订单类型不正确');
    }
    if (Number(order.spot_id) !== sid) {
      throw new Error('订单与景点不匹配');
    }
    if (![ 'verified', 'completed' ].includes(order.status)) {
      throw new Error('请先核销该景点门票后再评论');
    }

    const dup = await app.model.Comment.findOne({
      where: {
        order_id: oid,
        parent_id: 0,
        post_type: 'scenic',
      },
      attributes: [ 'id' ],
    });
    if (dup) {
      throw new Error('该订单已评价');
    }

    return order;
  }

  async resolveTagIds(inputTags = []) {
    const { app } = this;
    if (!Array.isArray(inputTags) || inputTags.length === 0) return [];
    const ids = [];
    const names = [];
    for (const item of inputTags) {
      if (item == null) continue;
      if (typeof item === 'number' || (typeof item === 'string' && /^\d+$/.test(item))) {
        ids.push(Number(item));
        continue;
      }
      if (typeof item === 'string' && item.trim()) {
        names.push(item.trim());
        continue;
      }
      if (typeof item === 'object') {
        if (item.id != null && /^\d+$/.test(String(item.id))) {
          ids.push(Number(item.id));
        } else if (item.name && String(item.name).trim()) {
          names.push(String(item.name).trim());
        }
      }
    }
    const uniqueIds = Array.from(new Set(ids)).filter(id => id > 0);
    const uniqueNames = Array.from(new Set(names));
    if (uniqueNames.length > 0) {
      const existingTags = await app.model.Tag.findAll({
        where: { name: uniqueNames },
        attributes: [ 'id', 'name' ],
      });
      const nameToId = {};
      existingTags.forEach(t => { nameToId[t.name] = t.id; });
      for (const name of uniqueNames) {
        if (!nameToId[name]) {
          const created = await app.model.Tag.create({ name, sort_order: 0 });
          nameToId[name] = created.id;
        }
      }
      Object.keys(nameToId).forEach(key => {
        const val = nameToId[key];
        const n = Number(val);
        if (!Number.isNaN(n) && n > 0) uniqueIds.push(n);
      });
    }
    return Array.from(new Set(uniqueIds));
  }

  async syncTagRelations(scenicSpotId, tags, transaction) {
    if (tags === undefined) return;
    const { app } = this;
    const tagIds = await this.resolveTagIds(tags);
    await app.model.ScenicSpotTag.destroy({
      where: { scenic_spot_id: scenicSpotId },
      transaction,
    });
    if (tagIds.length === 0) return;
    await app.model.ScenicSpotTag.bulkCreate(
      tagIds.map(tagId => ({ scenic_spot_id: scenicSpotId, tag_id: tagId })),
      { transaction }
    );
  }

  /**
   * 获取景点列表
   */
  async list({ page = 1, pageSize = 10, status, sortBy, is_recommend, keyword }) {
    const { app } = this;
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 10;
    const where = {};
    if (status !== undefined) {
      where.status = status;
    }
    if (is_recommend !== undefined) {
      where.is_recommend = is_recommend ? 1 : 0;
    }
    if (keyword) {
      where.name = { [Op.like]: `%${keyword}%` };
    }

    // 根据排序方式确定排序条件
      // 根据排序方式确定排序条件
      // 支持形式： 'hot'|'hot_asc'|'hot_desc', 'rating'|'rating_asc'|'rating_desc', 'sales'|'sales_asc'|'sales_desc'
      let order = [[ 'created_at', 'DESC' ]];
      const sb = String(sortBy || '').toLowerCase();
      let base = sb;
      let dir = 'DESC';
      if (sb.endsWith('_asc')) {
        base = sb.slice(0, -4);
        dir = 'ASC';
      } else if (sb.endsWith('_desc')) {
        base = sb.slice(0, -5);
        dir = 'DESC';
      }

      if (base === 'hot') {
        // 热度按算式排序（销量+评分权重），支持 ASC/DESC
        const orderStr = `(sales_count * 0.4 + rating * rating_count * 0.4 + view_count * 0.2) ${dir}`;
        order = app.model.Sequelize.literal(orderStr);
      } else if (base === 'rating') {
        order = [
          [ app.model.Sequelize.col('rating'), dir ],
          [ app.model.Sequelize.col('rating_count'), dir === 'DESC' ? 'DESC' : 'ASC' ],
        ];
      } else if (base === 'sales') {
        order = [[ 'sales_count', dir ]];
      }

    const { count, rows } = await app.model.ScenicSpot.findAndCountAll({
      where,
      limit: sizeNum,
      offset: (pageNum - 1) * sizeNum,
      order,
      distinct: true,
      include: [
        { model: app.model.Tag, as: 'tagRefs', attributes: [ 'id', 'name' ], through: { attributes: [] }, required: false },
      ],
    });

    // 解析 images、location，并输出 tag_list、location_text
    const parsedRows = rows.map(spot => {
      const data = spot.toJSON();
      if (data.images && typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          data.images = [data.cover_image];
        }
      }
      if (data.location && typeof data.location === 'string') {
        try {
          data.location = JSON.parse(data.location);
        } catch (e) {
          data.location = { address: data.location };
        }
      }
      // 多对多标签：优先使用 tagRefs 关联，否则回退 JSON 列 tags
      if (data.tagRefs && Array.isArray(data.tagRefs)) {
        data.tag_list = data.tagRefs.map(t => ({ id: t.id, name: t.name }));
      } else if (data.tags && typeof data.tags === 'string') {
        try {
          const arr = JSON.parse(data.tags);
          data.tag_list = Array.isArray(arr) ? arr.map(name => ({ id: 0, name: String(name) })) : [];
        } catch (e) {
          data.tag_list = [];
        }
      } else {
        data.tag_list = [];
      }
      delete data.tagRefs;
      delete data.tags;
      data.location_text = (data.location && data.location.address) ? data.location.address : '';
      return data;
    });

    return {
      total: count,
      page: pageNum,
      pageSize: sizeNum,
      list: parsedRows,
    };
  }

  async listForAdmin({ page = 1, pageSize = 20, status, sortBy, is_recommend, keyword }) {
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 20;
    const where = {};
    if (status !== undefined) where.status = status;
    if (is_recommend !== undefined) where.is_recommend = is_recommend ? 1 : 0;
    if (keyword) where.name = { [Op.like]: `%${keyword}%` };
    return this.list({
      page: pageNum,
      pageSize: sizeNum,
      status: where.status,
      sortBy: sortBy || 'default',
      is_recommend: where.is_recommend,
      keyword,
    });
  }

  /**
   * 按热度排序获取景点列表
   * 热度计算公式：sales_count * 0.4 + rating * rating_count * 0.4 + view_count * 0.2
   */
  async listByHot({ page = 1, pageSize = 10, status = 1 }) {
    const { app } = this;
    const where = {};
    if (status !== undefined) {
      where.status = status;
    }

    const { count, rows } = await app.model.ScenicSpot.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: app.model.Sequelize.literal(`
        (sales_count * 0.4 + rating * rating_count * 0.4 + view_count * 0.2) DESC
      `),
    });

    // 解析 images 和 tags JSON 字段
    const parsedRows = rows.map(spot => {
      const data = spot.toJSON();
      if (data.images && typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          data.images = [];
        }
      }
      if (data.tags && typeof data.tags === 'string') {
        try {
          data.tags = JSON.parse(data.tags);
        } catch (e) {
          data.tags = [];
        }
      }
      // 返回首图
      data.cover_image = data.images && data.images.length > 0 ? data.images[0] : '';
      return data;
    });

    return {
      total: count,
      page,
      pageSize,
      list: parsedRows,
    };
  }

  /**
   * 按距离排序获取景点列表
   * 使用 ST_Distance_Sphere 函数计算距离
   */
  async listByDistance({ userLat, userLng, page = 1, pageSize = 10, status = 1, order = 'asc' }) {
    const { app } = this;
    const sequelize = app.model;
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 10;

    // 使用原生 SQL 查询，计算距离并排序
    const sql = `
      SELECT 
        id,
        name,
        cover_image,
        images,
        open_time,
        price,
        latitude,
        longitude,
        view_count,
        description,
        rating,
        rating_count,
        sales_count,
        tags,
        status,
        created_at,
        updated_at,
        (
          ST_Distance_Sphere(
            POINT(longitude, latitude),
            POINT(:userLng, :userLat)
          )
        ) AS distance
      FROM scenic_spots
      WHERE status = :status
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY distance ${order && String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC'}
      LIMIT :limit OFFSET :offset
    `;

    // 同时查询总数
    const countSql = `
      SELECT COUNT(*) as total
      FROM scenic_spots
      WHERE status = :status
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `;

    const rows = await sequelize.query(sql, {
      replacements: {
        userLat,
        userLng,
        status,
        limit: sizeNum,
        offset: (pageNum - 1) * sizeNum,
      },
      type: sequelize.QueryTypes.SELECT,
    });

    const countRows = await sequelize.query(countSql, {
      replacements: { status },
      type: sequelize.QueryTypes.SELECT,
    });
    const countResult = Array.isArray(countRows) && countRows.length > 0 ? countRows[0] : { total: 0 };

    // 解析 JSON 字段并格式化距离
    const parsedRows = rows.map(spot => {
      const data = { ...spot };
      if (data.images && typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          data.images = [];
        }
      }
      if (data.tags && typeof data.tags === 'string') {
        try {
          const arr = JSON.parse(data.tags);
          data.tag_list = Array.isArray(arr) ? arr.map(name => ({ id: 0, name: String(name) })) : [];
        } catch (e) {
          data.tag_list = [];
        }
      } else {
        data.tag_list = [];
      }
      // 与普通列表一致：优先 cover_image，没有再取图集首张
      const imgs = Array.isArray(data.images) ? data.images : [];
      const coverExplicit = data.cover_image != null && String(data.cover_image).trim()
        ? String(data.cover_image).trim()
        : '';
      data.cover_image = coverExplicit || (imgs.length > 0 ? imgs[0] : '');
      // 距离转换为公里，保留两位小数
      data.distance = (data.distance / 1000).toFixed(2);
      // 与列表接口字段一致，便于前端复用
      data.opening_hours = data.open_time;
      data.ticket_price = data.price;
      data.location_text = '';
      return data;
    });

    // 批量附加多对多标签（附近接口用原生 SQL，需单独查 tag）
    const spotIds = parsedRows.map(r => r.id);
    if (spotIds.length > 0) {
      const links = await app.model.ScenicSpotTag.findAll({
        where: { scenic_spot_id: spotIds },
        include: [{ model: app.model.Tag, as: 'tag', attributes: [ 'id', 'name' ] }],
      });
      const map = {};
      spotIds.forEach(id => { map[id] = []; });
      links.forEach(link => {
        const tag = link.tag || link.get && link.get('tag');
        if (tag && map[link.scenic_spot_id]) {
          map[link.scenic_spot_id].push({ id: tag.id, name: tag.name });
        }
      });
      parsedRows.forEach(row => {
        row.tag_list = map[row.id] || [];
      });
    }

    return {
      total: countResult.total,
      page,
      pageSize,
      list: parsedRows,
    };
  }

  /**
   * 获取景点详情
   */
  async detail(id) {
    const { app } = this;
    const spot = await app.model.ScenicSpot.findByPk(id, {
      include: [
        { model: app.model.Tag, as: 'tagRefs', attributes: [ 'id', 'name' ], through: { attributes: [] }, required: false },
      ],
    });
    if (!spot) {
      throw new Error('景点不存在');
    }
    
    // 解析 JSON 字段
    const data = spot.toJSON();
    if (data.images && typeof data.images === 'string') {
      try {
        data.images = JSON.parse(data.images);
      } catch (e) {
        data.images = [data.cover_image];
      }
    }
    if (data.location && typeof data.location === 'string') {
      try {
        data.location = JSON.parse(data.location);
      } catch (e) {
        data.location = { address: data.location };
      }
    }
    if (data.tagRefs && Array.isArray(data.tagRefs)) {
      data.tag_list = data.tagRefs.map(t => ({ id: t.id, name: t.name }));
    } else {
      data.tag_list = [];
    }
    delete data.tagRefs;
    
    return data;
  }

  /**
   * 创建景点
   */
  async create(data) {
    const { app } = this;
    const transaction = await app.model.transaction();
    try {
      const scenicSpot = await app.model.ScenicSpot.create({
        ...data,
        // tags JSON 列逐步废弃，统一走关联表
        tags: null,
      }, { transaction });
      await this.syncTagRelations(scenicSpot.id, data.tags, transaction);
      await transaction.commit();
      return await this.detail(scenicSpot.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 更新景点
   */
  async update(id, data) {
    const { app } = this;
    const transaction = await app.model.transaction();
    const spot = await app.model.ScenicSpot.findByPk(id);
    if (!spot) {
      await transaction.rollback();
      throw new Error('景点不存在');
    }
    try {
      const updatePayload = { ...data };
      if (Object.prototype.hasOwnProperty.call(updatePayload, 'tags')) {
        // tags JSON 列逐步废弃，统一走关联表
        updatePayload.tags = null;
      }
      const updated = await spot.update(updatePayload, { transaction });
      await this.syncTagRelations(id, data.tags, transaction);
      await transaction.commit();
      return await this.detail(updated.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * 删除景点
   */
  async delete(id) {
    const { app } = this;
    const spot = await app.model.ScenicSpot.findByPk(id);
    if (!spot) {
      throw new Error('景点不存在');
    }
    return await spot.destroy();
  }

  /**
   * 获取景点评论
   */
  async getComments(spotId, { page = 1, pageSize = 10 }) {
    const { app } = this;
    const { count, rows } = await app.model.Comment.findAndCountAll({
      where: {
        post_id: spotId,
        post_type: 'scenic',
        status: 1, // 仅显示已通过的评论
        parent_id: 0, // 仅一级评论
      },
      include: [
        {
          model: app.model.User,
          as: 'user',
          attributes: [ 'id', 'nickname', 'avatar' ],
        },
        {
          model: app.model.Comment,
          as: 'replies',
          where: { status: 1 },
          required: false,
          include: [
            {
              model: app.model.User,
              as: 'user',
              attributes: [ 'id', 'nickname', 'avatar' ],
            },
            {
              model: app.model.User,
              as: 'reply_to_user',
              attributes: [ 'id', 'nickname' ],
            },
          ],
        },
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [[ 'created_at', 'DESC' ]],
    });

    return {
      total: count,
      page,
      pageSize,
      list: rows,
    };
  }

  /**
   * 添加景点评论
   */
  async addComment(userId, spotId, { content, images, score, parent_id, reply_to_user_id, order_id, status }) {
    const { app } = this;
    const sid = Number(spotId);
    const isTop = !parent_id || Number(parent_id) === 0;
    let orderIdToSave = null;

    if (isTop) {
      await this.assertScenicOrderEligibleForTopComment(userId, sid, order_id);
      orderIdToSave = Number(order_id);
    }

    if (parent_id && Number(parent_id) !== 0) {
      const parentComment = await app.model.Comment.findByPk(parent_id);
      if (!parentComment) {
        throw new Error('父评论不存在');
      }
      if (parentComment.post_type !== 'scenic' || Number(parentComment.post_id) !== sid) {
        throw new Error('父评论不属于该景点');
      }
    }

    const commentStatus = Number(status) === 1 ? 1 : 0;
    const comment = await app.model.Comment.create({
      post_id: sid,
      post_type: 'scenic',
      user_id: userId,
      order_id: orderIdToSave,
      content,
      images: images || [],
      score,
      parent_id: parent_id || 0,
      reply_to_user_id: reply_to_user_id || null,
      status: commentStatus,
    });

    if (commentStatus === 1) {
      await this.updateRating(sid);
    }

    return comment;
  }

  /**
   * 更新景点评分（在评论审核通过后调用）
   */
  async updateRating(spotId) {
    const { app } = this;
    const sequelize = app.model;

    // 计算新的平均评分
    const [ result ] = await sequelize.query(`
      UPDATE scenic_spots s
      SET rating = (
        SELECT COALESCE(AVG(score), 0)
        FROM comments
        WHERE post_id = :spotId
          AND post_type = 'scenic'
          AND status = 1
          AND score IS NOT NULL
      ),
      rating_count = (
        SELECT COUNT(*)
        FROM comments
        WHERE post_id = :spotId
          AND post_type = 'scenic'
          AND status = 1
          AND score IS NOT NULL
      )
      WHERE id = :spotId
    `, {
      replacements: { spotId },
      type: sequelize.QueryTypes.UPDATE,
    });

    return result;
  }
}

module.exports = ScenicSpotService;

'use strict';

const Service = require('egg').Service;

class PostService extends Service {
  /**
   * 获取攻略列表
   * @param {Object} params - 查询参数
   */
  async getPostList(params) {
    const { ctx } = this;
    const { Op } = this.app.Sequelize;
    const {
      page = 1,
      pageSize = 10,
      limit,
      status,
      is_recommend,
      sortBy,
      category,
      audit_status: auditStatusParam,
      keyword,
    } = params;
    const where = {};
    // 管理员可传 audit_status=0 查待审核，否则默认只查已通过
    const hasAuditStatusParam = auditStatusParam !== undefined && auditStatusParam !== '' && auditStatusParam !== null;
    if (hasAuditStatusParam) {
      where.audit_status = Number(auditStatusParam);
    } else {
      where.audit_status = 1;
    }
    if (status !== undefined && status !== '' && status !== null) {
      where.status = Number(status);
    } else {
      where.status = 1;
    }
    where.is_hidden = 0; // 攻略列表不展示已隐藏的
    // 添加 category 筛选
    if (category && category !== 'all') {
      where.category = category;
    }

    if (keyword && String(keyword).trim()) {
      const kw = String(keyword).trim();
      where[Op.or] = [
        { title: { [Op.like]: `%${kw}%` } },
        { content: { [Op.like]: `%${kw}%` } },
      ];
    }

    // 兼容前端传 limit（用于首页热门攻略等）
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize || limit) || 10;

    // 首页“热门攻略”使用综合热度排序：收藏/评论/点赞/浏览(对数) + 时间衰减
    // hot = (favorite*8 + likes*4 + comments*6 + ln(views+1)) / (hours_since_created + 2)^1.2
    const recommendFlag = String(is_recommend) === 'true' || String(is_recommend) === '1';
    const useHotSort = !hasAuditStatusParam && (recommendFlag || String(sortBy) === 'hot');

    // 为了避免复杂 SQL 造成兼容问题，热度排序在 Node 端计算：
    // - 查询时仍按创建时间倒序
    // - 如果需要热度排序，则多取一些数据（不分页），在内存中计算 hotScore 后再截取前 sizeNum 条
    const queryLimit = useHotSort ? Math.max(sizeNum * 5, 20) : sizeNum;
    const queryOffset = useHotSort ? 0 : (pageNum - 1) * sizeNum;

    const { count, rows } = await ctx.model.Post.findAndCountAll({
      where,
      include: [{
        model: ctx.model.User,
        as: 'user',
        attributes: [ 'id', 'nickname', 'avatar' ],
      }],
      limit: queryLimit,
      offset: queryOffset,
      order: [[ 'created_at', 'DESC' ]],
    });

    // 解析 images JSON 字段
    let parsedRows = rows.map(post => {
      const data = post.toJSON();
      if (data.images && typeof data.images === 'string') {
        try {
          data.images = JSON.parse(data.images);
        } catch (e) {
          data.images = [];
        }
      }
      return data;
    });

    // 如果需要“热门”排序，在内存中根据综合热度计算排序后再截取前 sizeNum 条
    if (useHotSort) {
      const now = Date.now();
      const toHotScore = p => {
        const fav = Number(p.favorite_count) || 0;
        const likes = Number(p.likes_count) || 0;
        const comments = Number(p.comments_count) || 0;
        const views = Number(p.views_count) || 0;
        const createdAt = p.created_at ? new Date(p.created_at).getTime() : now;
        const hours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
        const baseScore = fav * 8 + likes * 4 + comments * 6 + Math.log(views + 1) * 1;
        const decay = Math.pow(hours + 2, 1.2);
        return decay > 0 ? baseScore / decay : baseScore;
      };

      parsedRows = parsedRows
        .map(p => ({ ...p, _hot: toHotScore(p) }))
        .sort((a, b) => b._hot - a._hot)
        .slice(0, sizeNum)
        .map(p => {
          // 去掉临时字段
          // eslint-disable-next-line no-unused-vars
          const { _hot, ...rest } = p;
          return rest;
        });
    } else {
      // 普通列表场景，仅返回当前页数据
      parsedRows = parsedRows.slice(0, sizeNum);
    }

    return {
      total: count,
      page: pageNum,
      pageSize: sizeNum,
      list: parsedRows,
    };
  }

  /**
   * 获取攻略详情
   * @param {Number} id - 攻略ID
   */
  async getPostDetail(id) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id, {
      include: [
        {
          model: ctx.model.User,
          as: 'user',
          attributes: [ 'id', 'nickname', 'avatar' ],
        },
        {
          model: ctx.model.Comment,
          as: 'comments',
          where: { status: 1, parent_id: 0, post_type: 'post' },
          required: false,
          include: [
            {
              model: ctx.model.User,
              as: 'user',
              attributes: [ 'id', 'nickname', 'avatar' ],
            },
          ],
        },
      ],
    });

    if (!post) {
      throw new Error('攻略不存在');
    }

    const userId = ctx.state.user && ctx.state.user.id;
    // 增加浏览量：仅对已发布且审核通过的攻略计数，且排除作者自己查看
    if (post.status === 1 && post.audit_status === 1 && post.user_id !== userId) {
      await post.increment('views_count');
    }

    // 查询当前用户是否已点赞，供前端显示点赞按钮状态
    let isLiked = false;
    if (userId) {
      const likeRecord = await ctx.model.PostLike.findOne({
        where: { post_id: id, user_id: userId },
      });
      isLiked = !!likeRecord;
    }

    const data = post.toJSON ? post.toJSON() : post.get({ plain: true });
    data.isLiked = isLiked;
    return data;
  }

  /**
   * 创建攻略
   * @param {Object} data - 攻略数据
   */
  async createPost(data) {
    const { ctx } = this;
    const { title, content, images, location, category, status: reqStatus } = data;
    const isDraft = reqStatus === 0;

    let status = 1;
    let audit_status = 0;

    if (isDraft) {
      status = 0;
      // 草稿未提交：进入草稿箱“草稿”Tab
      audit_status = 3;
    } else {
      // 使用security服务进行内容安全检查（正式发布时）
      const securityResult = await ctx.service.security.checkText(content);
      if (!securityResult.pass) {
        throw new Error(securityResult.message);
      }
      if (images && images.length > 0) {
        const imageResult = await ctx.service.security.checkImages(images);
        if (!imageResult.pass) {
          throw new Error(imageResult.message);
        }
      }
      // 策略：检测通过且不需要人工 -> 自动发布；否则进入待审核
      if (securityResult.needAudit) {
        status = 0;
        audit_status = 0;
      } else {
        status = 1;
        audit_status = 1;
      }
    }

    const post = await ctx.model.Post.create({
      user_id: ctx.state.user.id,
      title: title || '',
      content: content || '',
      images: JSON.stringify(images || []),
      location: location || '',
      category: category || 'guide',
      status,
      audit_status,
    });

    return post;
  }

  /**
   * 更新攻略
   * @param {Number} id - 攻略ID
   * @param {Object} data - 更新数据
   */
  async updatePost(id, data) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id);

    if (!post) {
      throw new Error('攻略不存在');
    }

    // 权限检查
    if (post.user_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权修改此攻略');
    }

    // 内容安全检查
    if (data.content) {
      const securityResult = await ctx.service.security.checkText(data.content);
      if (!securityResult.pass) {
        throw new Error(securityResult.message);
      }
    }

    // 检查图片安全性
    if (data.images) {
      const imageResult = await ctx.service.security.checkImages(data.images);
      if (!imageResult.pass) {
        throw new Error(imageResult.message);
      }
      data.images = JSON.stringify(data.images);
    }

    await post.update(data);
    return post;
  }

  /**
   * 删除攻略
   * @param {Number} id - 攻略ID
   */
  async deletePost(id) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id);

    if (!post) {
      throw new Error('攻略不存在');
    }

    // 权限检查
    if (post.user_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权删除此攻略');
    }

    await post.destroy();
    return { message: '删除成功' };
  }

  /**
   * 点赞攻略
   * @param {Number} id - 攻略ID
   */
  async likePost(id) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id);

    if (!post) {
      throw new Error('攻略不存在');
    }

    const userId = ctx.state.user && ctx.state.user.id;
    if (!userId) {
      throw new Error('请先登录');
    }

    // 查询是否已点赞
    const existing = await ctx.model.PostLike.findOne({
      where: { post_id: id, user_id: userId },
    });

    let isLiked;

    if (existing) {
      // 已点赞 -> 取消点赞
      await existing.destroy();
      await post.decrement('likes_count');
      isLiked = false;
    } else {
      // 未点赞 -> 新增点赞
      await ctx.model.PostLike.create({
        post_id: id,
        user_id: userId,
      });
      await post.increment('likes_count');
      isLiked = true;
    }

    // 重新获取最新 likes_count
    await post.reload({ attributes: [ 'id', 'likes_count' ] });

    return {
      id: post.id,
      likes_count: post.likes_count,
      isLiked,
    };
  }

  /**
   * 获取我的攻略列表
   * @param {Object} params - 查询参数
   */
  async getMyPosts(params) {
    const { ctx } = this;
    const { userId, status, auditStatus, page, pageSize } = params;
    
    // 🔍 调试日志
    ctx.logger.info('[getMyPosts] 查询参数:', { userId, status, auditStatus, page, pageSize });
    
    const where = { user_id: userId };
    
    // 如果指定了状态（published 或 draft）
    if (status === 'published') {
      where.status = 1;
      where.audit_status = 1;
    } else if (status === 'draft') {
      // 兼容旧逻辑：草稿箱（草稿/审核中/未通过）
      where.status = 0;
      where.audit_status = [ 0, 2, 3 ];
    }
    // 新逻辑：按 audit_status 精确过滤（用于草稿箱 Tab）
    if (auditStatus !== undefined && auditStatus !== '' && auditStatus !== null) {
      where.status = 0;
      where.audit_status = Number(auditStatus);
    }

    // 🔍 调试日志
    ctx.logger.info('[getMyPosts] 查询条件:', where);

    const { count, rows } = await ctx.model.Post.findAndCountAll({
      where,
      include: [{
        model: ctx.model.Comment,
        as: 'comments',
        where: { status: 1 },
        required: false,
      }],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [[ 'created_at', 'DESC' ]],
    });

    // 🔍 调试日志
    ctx.logger.info('[getMyPosts] 查询结果:', { count, rowsLength: rows.length, postIds: rows.map(r => r.id) });

    return { count, rows };
  }

  /**
   * 发布草稿
   * @param {Number} id - 攻略ID
   */
  async publishDraft(id) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id);

    if (!post) {
      throw new Error('攻略不存在');
    }

    // 权限检查
    if (post.user_id !== ctx.state.user.id) {
      throw new Error('无权发布此攻略');
    }

    // 检查是否已经是发布状态
    if (post.status === 1) {
      throw new Error('攻略已发布');
    }

    // 内容安全检查（提交审核前也做一次，防止明显违规直接入库流转）
    const securityResult = await ctx.service.security.checkText(post.content || '');
    if (!securityResult.pass) throw new Error(securityResult.message);
    const images = JSON.parse(post.images || '[]');
    if (images.length > 0) {
      const imageResult = await ctx.service.security.checkImages(images);
      if (!imageResult.pass) throw new Error(imageResult.message);
    }

    // 策略：检测通过且不需要人工 -> 自动发布；否则进入待审核
    const next = securityResult.needAudit
      ? { status: 0, audit_status: 0, audit_remark: null }
      : { status: 1, audit_status: 1, audit_remark: null };

    await post.update(next);

    return post;
  }

  /**
   * 审核攻略
   * @param {Number} id - 攻略ID
   * @param {Number} auditStatus - 审核状态
   * @param {String} auditRemark - 审核备注
   */
  async auditPost(id, auditStatus, auditRemark) {
    const { ctx } = this;

    // 权限检查
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以审核');
    }

    const post = await ctx.model.Post.findByPk(id);

    if (!post) {
      throw new Error('攻略不存在');
    }

    await post.update({
      audit_status: auditStatus,
      status: Number(auditStatus) === 1 ? 1 : 0,
      audit_remark: Number(auditStatus) === 2 ? auditRemark : null,
    });

    return post;
  }

  /**
   * 隐藏攻略（已发布后在攻略列表不可见，仅作者可见）
   */
  async hidePost(id) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id);
    if (!post) throw new Error('攻略不存在');
    if (post.user_id !== ctx.state.user.id) throw new Error('无权操作');
    if (post.status !== 1) throw new Error('仅能隐藏已发布的攻略');
    await post.update({ is_hidden: 1 });
    return post;
  }

  /**
   * 解除隐藏
   */
  async unhidePost(id) {
    const { ctx } = this;
    const post = await ctx.model.Post.findByPk(id);
    if (!post) throw new Error('攻略不存在');
    if (post.user_id !== ctx.state.user.id) throw new Error('无权操作');
    await post.update({ is_hidden: 0 });
    return post;
  }

}

module.exports = PostService;

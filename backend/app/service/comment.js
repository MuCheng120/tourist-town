'use strict';

const Service = require('egg').Service;

class CommentService extends Service {
  /**
   * 获取评论列表（多级树形）
   * @param {Number} postId - 攻略ID
   */
  async getCommentList(postId) {
    const { ctx } = this;

    const rows = await ctx.model.Comment.findAll({
      where: {
        post_id: postId,
        post_type: 'post',
        status: 1,
      },
      include: [
        {
          model: ctx.model.User,
          as: 'user',
          attributes: [ 'id', 'nickname', 'avatar' ],
        },
      ],
      order: [[ 'created_at', 'ASC' ]],
    });

    const list = rows.map(r => r.toJSON());
    const idMap = new Map(list.map(c => [ c.id, c ]));
    
    // 获取当前用户ID
    const currentUserId = ctx.state.user ? ctx.state.user.id : null;
    
    // 如果用户已登录，查询点赞状态
    if (currentUserId) {
      const commentIds = list.map(c => c.id);
      const likes = await ctx.model.CommentLike.findAll({
        where: {
          comment_id: commentIds,
          user_id: currentUserId
        }
      });
      
      const likedCommentIds = new Set(likes.map(l => l.comment_id));
      
      // 标记已点赞的评论
      list.forEach(c => {
        c.isLiked = likedCommentIds.has(c.id);
      });
    } else {
      // 未登录用户，所有评论都未点赞
      list.forEach(c => {
        c.isLiked = false;
      });
    }
    
    list.forEach(c => {
      c.reply_to_user = c.parent_id && idMap.get(c.parent_id) ? idMap.get(c.parent_id).user : null;
      c.replies = [];
    });
    const roots = [];
    list.forEach(c => {
      if (c.parent_id === 0) {
        roots.push(c);
      } else {
        const parent = idMap.get(c.parent_id);
        if (parent && parent.replies) parent.replies.push(c);
      }
    });
    roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return roots;
  }

  /**
   * 创建评论
   * @param {Object} data - 评论数据
   */
  async createComment(data) {
    const { ctx } = this;
    const { post_id, content, parent_id, reply_to_user_id } = data;

    // 检查攻略是否存在
    const post = await ctx.model.Post.findByPk(post_id);
    if (!post) {
      throw new Error('攻略不存在');
    }

    // 使用security服务进行内容安全检查
    const securityResult = await ctx.service.security.checkText(content);
    if (!securityResult.pass) {
      throw new Error(securityResult.message);
    }

    // 创建评论（如果检查失败需要人工审核，则status为0，否则为1）
    const comment = await ctx.model.Comment.create({
      post_id,
      post_type: 'post',
      user_id: ctx.state.user.id,
      content,
      parent_id: parent_id || 0,
      reply_to_user_id,
      status: securityResult.needAudit ? 0 : 1, // 需要审核则为0
    });

    // 增加评论数（只有攻略评论才增加）
    if (comment.post_type === 'post') {
      await post.increment('comments_count');
    }

    return comment;
  }

  /**
   * 删除评论
   * @param {Number} id - 评论ID
   */
  async deleteComment(id) {
    const { ctx } = this;
    const comment = await ctx.model.Comment.findByPk(id);

    if (!comment) {
      throw new Error('评论不存在');
    }

    // 权限检查
    if (comment.user_id !== ctx.state.user.id && ctx.state.user.role !== 'admin') {
      throw new Error('无权删除此评论');
    }

    // 多级评论：递归硬删除所有子孙评论后再删自己
    const countDeleted = await this._deleteCommentAndDescendants(ctx, id);

    // 减少评论数（仅攻略有 comments_count）
    if (comment.post_type === 'post') {
      await ctx.model.Post.decrement('comments_count', {
        by: countDeleted,
        where: { id: comment.post_id },
      });
    }
    // 酒店评论删除后需重新计算评分
    if (comment.post_type === 'hotel') {
      await ctx.service.hotel.updateRating(comment.post_id);
    }
    // 景点评论删除后需重新计算评分
    if (comment.post_type === 'scenic') {
      await ctx.service.scenicSpot.updateRating(comment.post_id);
    }

    return { message: '删除成功' };
  }

  /**
   * 递归删除评论及其所有子孙（多级），返回删除条数
   */
  async _deleteCommentAndDescendants(ctx, id) {
    const children = await ctx.model.Comment.findAll({
      where: { parent_id: id },
      attributes: [ 'id' ],
    });
    let count = 1;
    for (const c of children) {
      count += await this._deleteCommentAndDescendants(ctx, c.id);
    }
    await ctx.model.Comment.destroy({
      where: { id },
      force: true,
    });
    return count;
  }

  /**
   * 点赞评论
   * @param {Number} id - 评论ID
   */
  async likeComment(id) {
    const { ctx } = this;
    const comment = await ctx.model.Comment.findByPk(id);

    if (!comment) {
      throw new Error('评论不存在');
    }

    // 检查是否是自己的评论
    if (comment.user_id === ctx.state.user.id) {
      throw new Error('不能点赞自己的评论');
    }

    // 检查是否已经点赞
    const existingLike = await ctx.model.CommentLike.findOne({
      where: {
        comment_id: id,
        user_id: ctx.state.user.id
      }
    });

    if (existingLike) {
      // 已点赞，取消点赞
      await existingLike.destroy();
      await comment.decrement('likes_count');
      return {
        ...comment.toJSON(),
        isLiked: false,
        likes_count: comment.likes_count - 1
      };
    } else {
      // 未点赞，添加点赞
      await ctx.model.CommentLike.create({
        comment_id: id,
        user_id: ctx.state.user.id
      });
      await comment.increment('likes_count');
      return {
        ...comment.toJSON(),
        isLiked: true,
        likes_count: comment.likes_count + 1
      };
    }
  }

  /**
   * 审核评论
   * @param {Number} id - 评论ID
   * @param {Number} status - 状态
   */
  async auditComment(id, status) {
    const { ctx } = this;

    // 权限检查
    if (ctx.state.user.role !== 'admin') {
      throw new Error('只有管理员可以审核');
    }

    const comment = await ctx.model.Comment.findByPk(id);

    if (!comment) {
      throw new Error('评论不存在');
    }

    await comment.update({ status });

    // 审核通过后更新对应内容的评分
    if (status === 1 && comment.post_type === 'hotel') {
      await ctx.service.hotel.updateRating(comment.post_id);
    }
    if (status === 1 && comment.post_type === 'product') {
      await ctx.service.product.updateProductRating(comment.post_id);
    }
    if (status === 1 && comment.post_type === 'scenic') {
      await ctx.service.scenicSpot.updateRating(comment.post_id);
    }

    return comment;
  }


  /**
   * 获取待审核评论列表
   */
  async getPendingComments() {
    const { ctx } = this;

    const list = await ctx.model.Comment.findAll({
      where: {
        status: 0, // 待审核
      },
      include: [
        {
          model: ctx.model.User,
          as: 'user',
          attributes: [ 'id', 'nickname', 'avatar' ],
        },
        {
          model: ctx.model.Comment,
          as: 'parent',
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
      order: [[ 'created_at', 'DESC' ]],
    });

    return { list };
  }
}

module.exports = CommentService;

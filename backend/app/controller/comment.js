'use strict';

const Controller = require('egg').Controller;

class CommentController extends Controller {
  /**
   * 获取评论列表
   */
  async list() {
    const { ctx } = this;

    try {
      const comments = await ctx.service.comment.getCommentList(ctx.params.postId);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: comments,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 创建评论
   */
  async create() {
    const { ctx } = this;

    try {
      const comment = await ctx.service.comment.createComment(ctx.request.body);
      ctx.body = {
        code: 200,
        message: '评论成功',
        data: comment,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '评论失败',
      };
    }
  }

  /**
   * 删除评论
   */
  async delete() {
    const { ctx } = this;

    try {
      await ctx.service.comment.deleteComment(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '删除成功',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '删除失败',
      };
    }
  }

  /**
   * 点赞评论
   */
  async like() {
    const { ctx } = this;

    try {
      const result = await ctx.service.comment.likeComment(ctx.params.id);
      ctx.body = {
        code: 200,
        message: result.isLiked ? '点赞成功' : '取消点赞成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '操作失败',
      };
    }
  }

  /**
   * 审核评论
   */
  async audit() {
    const { ctx } = this;

    try {
      const comment = await ctx.service.comment.auditComment(
        ctx.params.id,
        ctx.request.body.status
      );
      ctx.body = {
        code: 200,
        message: '审核成功',
        data: comment,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '审核失败',
      };
    }
  }

  /**
   * 获取待审核评论列表（管理员）
   */
  async getPending() {
    const { ctx } = this;

    try {
      const comments = await ctx.service.comment.getPendingComments();
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: comments,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }
}

module.exports = CommentController;

'use strict';

const Controller = require('egg').Controller;

class PostController extends Controller {
  /**
   * 获取攻略列表
   */
  async list() {
    const { ctx } = this;

    try {
      const result = await ctx.service.post.getPostList(ctx.query);
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
   * 获取攻略详情
   */
  async detail() {
    const { ctx } = this;

    try {
      const post = await ctx.service.post.getPostDetail(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: post,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 创建攻略
   */
  async create() {
    const { ctx } = this;

    try {
      const post = await ctx.service.post.createPost(ctx.request.body);
      ctx.body = {
        code: 200,
        message: '创建成功',
        data: post,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '创建失败',
      };
    }
  }

  /**
   * 更新攻略
   */
  async update() {
    const { ctx } = this;

    try {
      const post = await ctx.service.post.updatePost(ctx.params.id, ctx.request.body);
      ctx.body = {
        code: 200,
        message: '更新成功',
        data: post,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '更新失败',
      };
    }
  }

  /**
   * 删除攻略
   */
  async delete() {
    const { ctx } = this;

    try {
      await ctx.service.post.deletePost(ctx.params.id);
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
   * 获取我的攻略列表
   */
  async getMyPosts() {
    const { ctx } = this;
    const { status, audit_status, page = 1, pageSize = 10 } = ctx.query;

    try {
      const result = await ctx.service.post.getMyPosts({
        userId: ctx.state.user.id,
        status,
        auditStatus: audit_status,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      });

      ctx.body = {
        code: 200,
        message: '获取成功',
        data: {
          list: result.rows,
          hasMore: result.count > page * pageSize,
        },
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 发布草稿
   */
  async publishDraft() {
    const { ctx } = this;

    try {
      const post = await ctx.service.post.publishDraft(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '发布成功',
        data: post,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '发布失败',
      };
    }
  }

  /**
   * 点赞攻略
   */
  async like() {
    const { ctx } = this;

    try {
      const post = await ctx.service.post.likePost(ctx.params.id);
      ctx.body = {
        code: 200,
        message: '点赞成功',
        data: post,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '点赞失败',
      };
    }
  }

  /**
   * 隐藏攻略
   */
  async hide() {
    const { ctx } = this;
    try {
      const post = await ctx.service.post.hidePost(ctx.params.id);
      ctx.body = { code: 200, message: '已隐藏', data: post };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '操作失败' };
    }
  }

  /**
   * 解除隐藏
   */
  async unhide() {
    const { ctx } = this;
    try {
      const post = await ctx.service.post.unhidePost(ctx.params.id);
      ctx.body = { code: 200, message: '已解除隐藏', data: post };
    } catch (e) {
      ctx.body = { code: 500, message: e.message || '操作失败' };
    }
  }

  /**
   * 审核攻略
   */
  async audit() {
    const { ctx } = this;

    try {
      const post = await ctx.service.post.auditPost(
        ctx.params.id,
        ctx.request.body.auditStatus,
        ctx.request.body.auditRemark
      );
      ctx.body = {
        code: 200,
        message: '审核成功',
        data: post,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '审核失败',
      };
    }
  }
}

module.exports = PostController;

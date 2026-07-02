'use strict';

const assert = require('assert');
const { app } = require('egg-mock/bootstrap');

describe('test/scenic.comment.purchase.test.js', () => {
  let scenicId;
  let userId;
  let orderId;
  let commentId;
  const suffix = Date.now();

  before(async () => {
    const user = await app.model.User.create({
      username: `p0_comment_user_${suffix}`,
      password: 'test_password',
      nickname: 'P0评论购票测试用户',
      phone: `139${String(suffix).slice(-8)}`,
      role: 'consumer',
      status: 'active',
    });
    userId = user.id;

    const scenic = await app.model.ScenicSpot.create({
      name: `P0评论购票景点_${suffix}`,
      cover_image: '/uploads/scenic/test.jpg',
      images: [],
      price: 88,
      status: 1,
      daily_capacity: 100,
      latitude: 45.75,
      longitude: 126.63,
      description: 'P0评论购票测试景点',
    });
    scenicId = scenic.id;
  });

  after(async () => {
    if (commentId) {
      await app.model.Comment.destroy({ where: { id: commentId }, force: true });
    }
    if (orderId) {
      await app.model.Order.destroy({ where: { id: orderId }, force: true });
    }
    if (scenicId) {
      await app.model.ScenicSpot.destroy({ where: { id: scenicId }, force: true });
    }
    if (userId) {
      await app.model.User.destroy({ where: { id: userId }, force: true });
    }
  });

  it('should require order_id for top-level comment', async () => {
    const ctx = app.mockContext();
    await assert.rejects(async () => {
      await ctx.service.scenicSpot.addComment(userId, scenicId, {
        content: '未指定订单',
        images: [],
        score: 5,
        parent_id: 0,
        reply_to_user_id: null,
      });
    }, /请指定要评价的门票订单/);
  });

  it('should block top-level comment when only paid but not verified', async () => {
    const order = await app.model.Order.create({
      order_no: `P0CP${suffix}`,
      user_id: userId,
      merchant_id: 1,
      spot_id: scenicId,
      order_type: 'scenic',
      total_amount: 88,
      final_amount: 88,
      quantity: 1,
      status: 'paid',
      verification_code: 'P0CMTBUY001',
    });
    orderId = order.id;

    const ctx = app.mockContext();
    await assert.rejects(async () => {
      await ctx.service.scenicSpot.addComment(userId, scenicId, {
        content: '仅支付未核销评论',
        images: [],
        score: 5,
        parent_id: 0,
        reply_to_user_id: null,
        order_id: orderId,
      });
    }, /请先核销该景点门票后再评论/);
  });

  it('should allow top-level comment after ticket verification', async () => {
    const order = await app.model.Order.findByPk(orderId);
    await order.update({ status: 'verified' });

    const ctx = app.mockContext();
    const comment = await ctx.service.scenicSpot.addComment(userId, scenicId, {
      content: '已购票评论',
      images: [],
      score: 5,
      parent_id: 0,
      reply_to_user_id: null,
      order_id: orderId,
    });
    commentId = comment.id;

    assert.ok(commentId);
    assert.strictEqual(comment.post_id, scenicId);
    assert.strictEqual(comment.post_type, 'scenic');
    assert.strictEqual(comment.user_id, userId);
    assert.strictEqual(Number(comment.order_id), Number(orderId));
  });

  it('should reject duplicate top-level comment for same order', async () => {
    const ctx = app.mockContext();
    await assert.rejects(async () => {
      await ctx.service.scenicSpot.addComment(userId, scenicId, {
        content: '重复评价',
        images: [],
        score: 4,
        parent_id: 0,
        reply_to_user_id: null,
        order_id: orderId,
      });
    }, /该订单已评价/);
  });
});

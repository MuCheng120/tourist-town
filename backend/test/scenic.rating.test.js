'use strict';

const assert = require('assert');
const { app } = require('egg-mock/bootstrap');

describe('test/scenic.rating.test.js', () => {
  let scenicId;
  let userId;
  let commentId;
  const suffix = Date.now();

  before(async () => {
    const user = await app.model.User.create({
      username: `p0_rating_user_${suffix}`,
      password: 'test_password',
      nickname: 'P0评分测试用户',
      phone: `138${String(suffix).slice(-8)}`,
      role: 'consumer',
      status: 'active',
    });
    userId = user.id;

    const scenic = await app.model.ScenicSpot.create({
      name: `P0评分景点_${suffix}`,
      cover_image: '/uploads/scenic/test.jpg',
      images: [],
      price: 100,
      status: 1,
      daily_capacity: 100,
      latitude: 45.75,
      longitude: 126.63,
      description: 'P0评分测试景点',
    });
    scenicId = scenic.id;

    const comment = await app.model.Comment.create({
      post_id: scenicId,
      post_type: 'scenic',
      user_id: userId,
      content: '评分链路测试评论',
      score: 5,
      status: 0,
      parent_id: 0,
    });
    commentId = comment.id;
  });

  after(async () => {
    if (commentId) {
      await app.model.Comment.destroy({ where: { id: commentId }, force: true });
    }
    if (scenicId) {
      await app.model.ScenicSpot.destroy({ where: { id: scenicId }, force: true });
    }
    if (userId) {
      await app.model.User.destroy({ where: { id: userId }, force: true });
    }
  });

  it('should update scenic rating after audit and deletion', async () => {
    const ctx = app.mockContext();
    ctx.state.user = { id: 1, role: 'admin' };

    await ctx.service.comment.auditComment(commentId, 1);
    const scenicAfterAudit = await app.model.ScenicSpot.findByPk(scenicId);
    assert.strictEqual(Number(scenicAfterAudit.rating), 5);
    assert.strictEqual(Number(scenicAfterAudit.rating_count), 1);

    await ctx.service.comment.deleteComment(commentId);
    commentId = null;

    const scenicAfterDelete = await app.model.ScenicSpot.findByPk(scenicId);
    assert.strictEqual(Number(scenicAfterDelete.rating), 0);
    assert.strictEqual(Number(scenicAfterDelete.rating_count), 0);
  });
});

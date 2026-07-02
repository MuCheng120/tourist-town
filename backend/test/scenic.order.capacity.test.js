'use strict';

const assert = require('assert');
const { app } = require('egg-mock/bootstrap');

describe('test/scenic.order.capacity.test.js', () => {
  let scenicId;
  let userId;
  const orderIds = [];
  const suffix = Date.now();
  const playDate = '2026-04-01';

  before(async () => {
    let platformMerchant = await app.model.User.findByPk(1);
    if (!platformMerchant) {
      platformMerchant = await app.model.User.create({
        id: 1,
        username: `platform_admin_${suffix}`,
        password: 'test_password',
        nickname: '平台管理员',
        phone: `139${String(suffix).slice(-8)}`,
        role: 'admin',
        status: 'active',
      });
    }

    const user = await app.model.User.create({
      username: `p0_capacity_user_${suffix}`,
      password: 'test_password',
      nickname: 'P0容量测试用户',
      phone: `137${String(suffix).slice(-8)}`,
      role: 'consumer',
      status: 'active',
    });
    userId = user.id;

    const scenic = await app.model.ScenicSpot.create({
      name: `P0容量景点_${suffix}`,
      cover_image: '/uploads/scenic/capacity.jpg',
      images: [],
      price: 60,
      status: 1,
      daily_capacity: 2,
      latitude: 45.75,
      longitude: 126.63,
      description: '容量测试景点',
    });
    scenicId = scenic.id;

    const paidOrder = await app.model.Order.create({
      order_no: `P0CAP${suffix}A`,
      user_id: userId,
      merchant_id: 1,
      spot_id: scenicId,
      order_type: 'scenic',
      total_amount: 120,
      discount_amount: 0,
      final_amount: 120,
      quantity: 2,
      play_date: playDate,
      status: 'paid',
      verification_code: 'P0CAPACITY01',
    });
    orderIds.push(paidOrder.id);
  });

  after(async () => {
    if (orderIds.length > 0) {
      await app.model.Order.destroy({ where: { id: orderIds }, force: true });
    }
    if (scenicId) {
      await app.model.ScenicSpot.destroy({ where: { id: scenicId }, force: true });
    }
    if (userId) {
      await app.model.User.destroy({ where: { id: userId }, force: true });
    }
  });

  it('should block scenic order when daily capacity is exhausted', async () => {
    const ctx = app.mockContext();
    ctx.state.user = { id: userId, role: 'consumer' };

    await assert.rejects(
      () => ctx.service.order.createOrder({
        order_type: 'scenic',
        spot_id: scenicId,
        quantity: 1,
        play_date: `${playDate}T08:00:00.000Z`,
        total_price: 60,
      }),
      err => err && /余量不足/.test(err.message)
    );
  });
});

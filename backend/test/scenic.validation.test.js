'use strict';

const assert = require('assert');
const { app } = require('egg-mock/bootstrap');
const ScenicSpotController = require('../app/controller/scenic_spot');

describe('test/scenic.validation.test.js', () => {
  async function callCreate(payload) {
    const ctx = app.mockContext({
      method: 'POST',
      url: '/api/scenic-spots',
      request: { body: payload },
    });
    ctx.request.body = payload;
    const controller = new ScenicSpotController(ctx);
    await controller.create();
    return ctx.body;
  }

  it('should reject create scenic without coordinates', async () => {
    const body = await callCreate({
      name: '校验测试景点-无坐标',
      cover_image: '/uploads/scenic/test.jpg',
      address: '哈尔滨市道里区测试路1号',
      open_time: '09:00-17:00',
      price: 50,
      description: '校验测试景点',
    });

    assert.strictEqual(body.code, 400);
    assert.match(body.message, /经纬度/);
  });

  it('should reject create scenic with invalid open_time format', async () => {
    const body = await callCreate({
      name: '校验测试景点-时间格式',
      cover_image: '/uploads/scenic/test.jpg',
      address: '哈尔滨市道里区测试路2号',
      latitude: 45.75,
      longitude: 126.63,
      open_time: '9点-17点',
      price: 50,
      description: '校验测试景点',
    });

    assert.strictEqual(body.code, 400);
    assert.match(body.message, /开放时间格式/);
  });

  it('should reject create scenic with invalid ticket type price', async () => {
    const body = await callCreate({
      name: '校验测试景点-票种价格',
      cover_image: '/uploads/scenic/test.jpg',
      address: '哈尔滨市道里区测试路3号',
      latitude: 45.76,
      longitude: 126.64,
      open_time: '09:00-17:00',
      price: 50,
      description: '校验测试景点',
      ticket_types: [
        { type: 'adult', name: '成人票', price: 80 },
        { type: 'child', name: '儿童票', price: -1 },
      ],
    });

    assert.strictEqual(body.code, 400);
    assert.match(body.message, /价格不合法/);
  });
});

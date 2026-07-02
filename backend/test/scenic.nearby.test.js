'use strict';

const assert = require('assert');
const { app } = require('egg-mock/bootstrap');

describe('test/scenic.nearby.test.js', () => {
  const scenicIds = [];
  const suffix = Date.now();

  before(async () => {
    const scenicA = await app.model.ScenicSpot.create({
      name: `P0附近景点A_${suffix}`,
      cover_image: '/uploads/scenic/a.jpg',
      images: [],
      price: 80,
      status: 1,
      daily_capacity: 100,
      latitude: 45.7501,
      longitude: 126.6301,
      description: '附近景点A',
    });
    scenicIds.push(scenicA.id);

    const scenicB = await app.model.ScenicSpot.create({
      name: `P0附近景点B_${suffix}`,
      cover_image: '/uploads/scenic/b.jpg',
      images: [],
      price: 90,
      status: 1,
      daily_capacity: 100,
      latitude: 45.7601,
      longitude: 126.6401,
      description: '附近景点B',
    });
    scenicIds.push(scenicB.id);
  });

  after(async () => {
    if (scenicIds.length > 0) {
      await app.model.ScenicSpot.destroy({ where: { id: scenicIds }, force: true });
    }
  });

  it('should return nearby scenic list with distance field', async () => {
    const ctx = app.mockContext();
    const result = await ctx.service.scenicSpot.listByDistance({
      userLat: 45.75,
      userLng: 126.63,
      page: 1,
      pageSize: 10,
      status: 1,
    });

    assert.ok(result);
    assert.ok(Array.isArray(result.list));
    assert.ok(result.list.length > 0);
    assert.ok(result.list.every(item => Object.prototype.hasOwnProperty.call(item, 'distance')));
  });
});

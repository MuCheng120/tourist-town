'use strict';

const Service = require('egg').Service;

const TENCENT_MAP_KEY = 'tencent_map_key';

class LocationService extends Service {
  async reverseGeocode({ latitude, longitude }) {
    const { ctx } = this;
    const lat = latitude != null ? parseFloat(latitude) : NaN;
    const lng = longitude != null ? parseFloat(longitude) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error('参数错误：缺少经纬度');
    }

    const key = await ctx.service.setting.get(TENCENT_MAP_KEY);
    if (!key) {
      throw new Error('未配置地图服务 Key');
    }

    const url = 'https://apis.map.qq.com/ws/geocoder/v1/';
    const result = await ctx.curl(url, {
      method: 'GET',
      dataType: 'json',
      timeout: 5000,
      data: {
        location: `${lat},${lng}`,
        key,
      },
    });

    const body = result && result.data ? result.data : null;
    if (!body || typeof body !== 'object') {
      throw new Error('地图服务返回异常');
    }
    if (body.status !== 0) {
      throw new Error(body.message || '地图服务错误');
    }

    const comp = body.result && body.result.address_component ? body.result.address_component : {};
    const city = comp.city || comp.province || '';
    const district = comp.district || '';

    return {
      city,
      district,
    };
  }
}

module.exports = LocationService;


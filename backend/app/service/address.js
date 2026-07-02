'use strict';

const Service = require('egg').Service;

class AddressService extends Service {
  /**
   * 获取地址列表
   */
  async getAddressList() {
    const { ctx } = this;

    const list = await ctx.model.Address.findAll({
      where: {
        user_id: ctx.state.user.id,
      },
      order: [[ 'is_default', 'DESC' ], [ 'created_at', 'DESC' ]],
    });

    return list;
  }

  /**
   * 创建地址
   * @param {Object} data - 地址数据
   */
  async createAddress(data) {
    const { ctx } = this;
    const {
      userName,
      telNumber,
      provinceName,
      cityName,
      countyName,
      detailInfo,
      postalCode,
    } = data;

    // 如果是第一个地址，自动设为默认
    const count = await ctx.model.Address.count({
      where: { user_id: ctx.state.user.id },
    });

    const isDefault = count === 0;

    // 如果设置为默认地址，先取消其他默认地址
    if (isDefault) {
      await ctx.model.Address.update(
        { is_default: false },
        { where: { user_id: ctx.state.user.id } }
      );
    }

    // 创建新地址
    const address = await ctx.model.Address.create({
      user_id: ctx.state.user.id,
      user_name: userName,
      tel_number: telNumber,
      province_name: provinceName,
      city_name: cityName,
      county_name: countyName,
      detail_info: detailInfo,
      postal_code: postalCode,
      is_default: isDefault,
    });

    return address;
  }

  /**
   * 更新地址
   * @param {Number} id - 地址ID
   * @param {Object} data - 更新数据
   */
  async updateAddress(id, data) {
    const { ctx } = this;
    const address = await ctx.model.Address.findOne({
      where: {
        id,
        user_id: ctx.state.user.id,
      },
    });

    if (!address) {
      throw new Error('地址不存在');
    }

    const allow = [
      'user_name', 'userName', 'tel_number', 'telNumber',
      'province_name', 'provinceName', 'city_name', 'cityName',
      'county_name', 'countyName', 'detail_info', 'detailInfo',
      'postal_code', 'postalCode',
    ];
    const payload = {};
    if (data.user_name != null) payload.user_name = data.user_name;
    else if (data.userName != null) payload.user_name = data.userName;
    if (data.tel_number != null) payload.tel_number = data.tel_number;
    else if (data.telNumber != null) payload.tel_number = data.telNumber;
    if (data.province_name != null) payload.province_name = data.province_name;
    else if (data.provinceName != null) payload.province_name = data.provinceName;
    if (data.city_name != null) payload.city_name = data.city_name;
    else if (data.cityName != null) payload.city_name = data.cityName;
    if (data.county_name != null) payload.county_name = data.county_name;
    else if (data.countyName != null) payload.county_name = data.countyName;
    if (data.detail_info != null) payload.detail_info = data.detail_info;
    else if (data.detailInfo != null) payload.detail_info = data.detailInfo;
    if (data.postal_code != null) payload.postal_code = data.postal_code;
    else if (data.postalCode != null) payload.postal_code = data.postalCode;

    await address.update(payload);
    return address;
  }

  /**
   * 删除地址
   * @param {Number} id - 地址ID
   */
  async deleteAddress(id) {
    const { ctx } = this;
    const address = await ctx.model.Address.findOne({
      where: {
        id,
        user_id: ctx.state.user.id,
      },
    });

    if (!address) {
      throw new Error('地址不存在');
    }

    await address.destroy();
    return { message: '删除成功' };
  }

  /**
   * 设置默认地址
   * @param {Number} id - 地址ID
   */
  async setDefault(id) {
    const { ctx } = this;
    const address = await ctx.model.Address.findOne({
      where: {
        id,
        user_id: ctx.state.user.id,
      },
    });

    if (!address) {
      throw new Error('地址不存在');
    }

    // 取消其他默认地址
    await ctx.model.Address.update(
      { is_default: false },
      { where: { user_id: ctx.state.user.id } }
    );

    // 设置为默认
    await address.update({ is_default: true });

    return address;
  }

  /**
   * 获取默认地址
   */
  async getDefaultAddress() {
    const { ctx } = this;

    const address = await ctx.model.Address.findOne({
      where: {
        user_id: ctx.state.user.id,
        is_default: true,
      },
    });

    return address;
  }

  /**
   * 获取地址详情
   * @param {Number} id - 地址ID
   */
  async getAddressDetail(id) {
    const { ctx } = this;

    const address = await ctx.model.Address.findOne({
      where: {
        id,
        user_id: ctx.state.user.id,
      },
    });

    if (!address) {
      throw new Error('地址不存在');
    }

    return address;
  }
}

module.exports = AddressService;

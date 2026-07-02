'use strict';

const Service = require('egg').Service;

const CONTACT_PHONE_KEY = 'contact_phone';
const TENCENT_MAP_KEY = 'tencent_map_key';

class SettingService extends Service {
  /**
   * 根据 key 获取配置值
   */
  async get(key) {
    const { app } = this;
    const row = await app.model.SystemSetting.findOne({
      where: { key },
      attributes: [ 'value' ],
    });
    return row ? row.value : '';
  }

  /**
   * 设置配置值
   */
  async set(key, value) {
    const { app } = this;
    const str = value == null ? '' : String(value);
    const [ row ] = await app.model.SystemSetting.findOrCreate({
      where: { key },
      defaults: { key, value: str },
    });
    await row.update({ value: str });
    return row.value;
  }

  /**
   * 获取咨询电话（对外展示用）
   */
  async getContactPhone() {
    return this.get(CONTACT_PHONE_KEY);
  }

  /**
   * 管理员：获取系统设置（含咨询电话）
   */
  async getSettings() {
    const contactPhone = await this.get(CONTACT_PHONE_KEY);
    const tencentMapKey = await this.get(TENCENT_MAP_KEY);
    return { contact_phone: contactPhone, tencent_map_key: tencentMapKey };
  }

  /**
   * 管理员：更新系统设置
   */
  async updateSettings(data) {
    if (data.contact_phone !== undefined) {
      await this.set(CONTACT_PHONE_KEY, data.contact_phone);
    }
    if (data.tencent_map_key !== undefined) {
      await this.set(TENCENT_MAP_KEY, data.tencent_map_key);
    }
    return this.getSettings();
  }
}

module.exports = SettingService;

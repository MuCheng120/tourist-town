// 缓存服务 - Redis封装
const Service = require('egg').Service;

class CacheService extends Service {
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @param {number} seconds - 过期时间（秒），默认1小时
   */
  async set(key, value, seconds = 3600) {
    const { redis } = this.app;
    try {
      const strValue = JSON.stringify(value);
      if (seconds > 0) {
        await redis.set(key, strValue, 'EX', seconds);
      } else {
        await redis.set(key, strValue);
      }
      this.logger.info(`[Cache] Set cache: ${key}, expire: ${seconds}s`);
      return true;
    } catch (error) {
      this.logger.error(`[Cache] Set cache error: ${key}`, error);
      return false;
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @param {boolean} useJson - 是否解析JSON，默认true
   */
  async get(key, useJson = true) {
    const { redis } = this.app;
    try {
      const value = await redis.get(key);
      if (value === null) {
        return null;
      }
      if (useJson) {
        return JSON.parse(value);
      }
      return value;
    } catch (error) {
      this.logger.error(`[Cache] Get cache error: ${key}`, error);
      return null;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  async del(key) {
    const { redis } = this.app;
    try {
      await redis.del(key);
      this.logger.info(`[Cache] Delete cache: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`[Cache] Delete cache error: ${key}`, error);
      return false;
    }
  }

  /**
   * 批量删除缓存
   * @param {string} pattern - 匹配模式，如 'scenic:*'
   */
  async delPattern(pattern) {
    const { redis } = this.app;
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        this.logger.info(`[Cache] Delete pattern: ${pattern}, count: ${keys.length}`);
      }
      return keys.length;
    } catch (error) {
      this.logger.error(`[Cache] Delete pattern error: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键
   */
  async exists(key) {
    const { redis } = this.app;
    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`[Cache] Check exists error: ${key}`, error);
      return false;
    }
  }

  /**
   * 设置过期时间
   * @param {string} key - 缓存键
   * @param {number} seconds - 过期时间（秒）
   */
  async expire(key, seconds) {
    const { redis } = this.app;
    try {
      await redis.expire(key, seconds);
      return true;
    } catch (error) {
      this.logger.error(`[Cache] Set expire error: ${key}`, error);
      return false;
    }
  }

  /**
   * 获取剩余过期时间
   * @param {string} key - 缓存键
   */
  async ttl(key) {
    const { redis } = this.app;
    try {
      return await redis.ttl(key);
    } catch (error) {
      this.logger.error(`[Cache] Get TTL error: ${key}`, error);
      return -1;
    }
  }

  // ========== 景点相关缓存 ==========

  /**
   * 获取景点列表缓存
   */
  async getScenicList(page, pageSize, filters = {}) {
    const key = `scenic:list:${page}:${pageSize}:${JSON.stringify(filters)}`;
    return await this.get(key);
  }

  /**
   * 设置景点列表缓存
   */
  async setScenicList(page, pageSize, filters, data, seconds = 600) {
    const key = `scenic:list:${page}:${pageSize}:${JSON.stringify(filters)}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 获取景点详情缓存
   */
  async getScenicDetail(id) {
    const key = `scenic:detail:${id}`;
    return await this.get(key);
  }

  /**
   * 设置景点详情缓存
   */
  async setScenicDetail(id, data, seconds = 3600) {
    const key = `scenic:detail:${id}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 清除景点缓存
   */
  async clearScenicCache() {
    await this.delPattern('scenic:*');
  }

  // ========== 路线相关缓存 ==========

  /**
   * 获取路线列表缓存
   */
  async getRouteList(page, pageSize) {
    const key = `route:list:${page}:${pageSize}`;
    return await this.get(key);
  }

  /**
   * 设置路线列表缓存
   */
  async setRouteList(page, pageSize, data, seconds = 600) {
    const key = `route:list:${page}:${pageSize}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 获取路线详情缓存
   */
  async getRouteDetail(id) {
    const key = `route:detail:${id}`;
    return await this.get(key);
  }

  /**
   * 设置路线详情缓存
   */
  async setRouteDetail(id, data, seconds = 3600) {
    const key = `route:detail:${id}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 清除路线缓存
   */
  async clearRouteCache() {
    await this.delPattern('route:*');
  }

  // ========== 物流相关缓存 ==========

  /**
   * 获取物流轨迹缓存
   */
  async getLogistics(trackingNumber) {
    const key = `logistics:${trackingNumber}`;
    return await this.get(key);
  }

  /**
   * 设置物流轨迹缓存
   */
  async setLogistics(trackingNumber, data, seconds = 7200) {
    const key = `logistics:${trackingNumber}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 清除物流缓存
   */
  async clearLogisticsCache() {
    await this.delPattern('logistics:*');
  }

  // ========== 统计数据缓存 ==========

  /**
   * 获取统计数据缓存
   */
  async getStatistics(type) {
    const key = `statistics:${type}`;
    return await this.get(key);
  }

  /**
   * 设置统计数据缓存
   */
  async setStatistics(type, data, seconds = 300) {
    const key = `statistics:${type}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 清除统计数据缓存
   */
  async clearStatisticsCache() {
    await this.delPattern('statistics:*');
  }

  // ========== 热点数据缓存 ==========

  /**
   * 获取热门景点缓存
   */
  async getHotSpots(limit = 10) {
    const key = `hot:spots:${limit}`;
    return await this.get(key);
  }

  /**
   * 设置热门景点缓存
   */
  async setHotSpots(limit, data, seconds = 1800) {
    const key = `hot:spots:${limit}`;
    return await this.set(key, data, seconds);
  }

  /**
   * 增加访问计数
   */
  async incrementVisit(key) {
    const { redis } = this.app;
    try {
      const visitKey = `visit:${key}`;
      const count = await redis.incr(visitKey);
      // 设置24小时过期
      await redis.expire(visitKey, 86400);
      return count;
    } catch (error) {
      this.logger.error(`[Cache] Increment visit error: ${key}`, error);
      return 0;
    }
  }

  /**
   * 获取访问计数
   */
  async getVisitCount(key) {
    const { redis } = this.app;
    try {
      const visitKey = `visit:${key}`;
      const count = await redis.get(visitKey);
      return count ? parseInt(count) : 0;
    } catch (error) {
      this.logger.error(`[Cache] Get visit count error: ${key}`, error);
      return 0;
    }
  }
}

module.exports = CacheService;

// 离线缓存工具类
class OfflineCache {
  constructor() {
    this.cachePrefix = 'offline_';
    this.queuePrefix = 'offline_queue_';
    this.maxCacheSize = 5 * 1024 * 1024; // 5MB
    this.cacheVersion = 'v1';
  }

  /**
   * 生成缓存键
   */
  _getCacheKey(key) {
    return `${this.cachePrefix}${this.cacheVersion}_${key}`;
  }

  /**
   * 生成队列键
   */
  _getQueueKey(key) {
    return `${this.queuePrefix}${this.cacheVersion}_${key}`;
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} data - 缓存数据
   * @param {number} expireTime - 过期时间（毫秒），默认1小时
   */
  set(key, data, expireTime = 3600000) {
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        expireTime: expireTime
      };

      const cacheKey = this._getCacheKey(key);
      wx.setStorageSync(cacheKey, cacheData);

      console.log(`[OfflineCache] Set cache: ${key}`);
      return true;
    } catch (error) {
      console.error('[OfflineCache] Set cache error:', error);
      // 如果存储失败，尝试清理旧数据
      this.clearExpired();
      return false;
    }
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   */
  get(key) {
    try {
      const cacheKey = this._getCacheKey(key);
      const cacheData = wx.getStorageSync(cacheKey);

      if (!cacheData) {
        return null;
      }

      // 检查是否过期
      const now = Date.now();
      if (now - cacheData.timestamp > cacheData.expireTime) {
        // 已过期，删除缓存
        this.remove(key);
        return null;
      }

      console.log(`[OfflineCache] Get cache: ${key}`);
      return cacheData.data;
    } catch (error) {
      console.error('[OfflineCache] Get cache error:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  remove(key) {
    try {
      const cacheKey = this._getCacheKey(key);
      wx.removeStorageSync(cacheKey);
      console.log(`[OfflineCache] Remove cache: ${key}`);
      return true;
    } catch (error) {
      console.error('[OfflineCache] Remove cache error:', error);
      return false;
    }
  }

  /**
   * 清除所有缓存
   */
  clear() {
    try {
      const res = wx.getStorageInfoSync();
      const keys = res.keys || [];

      keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          wx.removeStorageSync(key);
        }
      });

      console.log('[OfflineCache] Clear all cache');
      return true;
    } catch (error) {
      console.error('[OfflineCache] Clear cache error:', error);
      return false;
    }
  }

  /**
   * 清除过期缓存
   */
  clearExpired() {
    try {
      const res = wx.getStorageInfoSync();
      const keys = res.keys || [];
      const now = Date.now();
      let clearedCount = 0;

      keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          try {
            const cacheData = wx.getStorageSync(key);
            if (cacheData && (now - cacheData.timestamp > cacheData.expireTime)) {
              wx.removeStorageSync(key);
              clearedCount++;
            }
          } catch (e) {
            // 数据损坏，删除
            wx.removeStorageSync(key);
            clearedCount++;
          }
        }
      });

      console.log(`[OfflineCache] Clear ${clearedCount} expired cache`);
      return clearedCount;
    } catch (error) {
      console.error('[OfflineCache] Clear expired error:', error);
      return 0;
    }
  }

  /**
   * 获取缓存大小
   */
  getCacheSize() {
    try {
      const res = wx.getStorageInfoSync();
      const keys = res.keys || [];
      let totalSize = 0;

      keys.forEach(key => {
        if (key.startsWith(this.cachePrefix)) {
          try {
            const data = wx.getStorageSync(key);
            totalSize += JSON.stringify(data).length;
          } catch (e) {
            // 忽略错误
          }
        }
      });

      return totalSize;
    } catch (error) {
      console.error('[OfflineCache] Get cache size error:', error);
      return 0;
    }
  }

  // ========== 离线队列 ==========

  /**
   * 添加操作到离线队列
   * @param {string} queueName - 队列名称
   * @param {object} operation - 操作对象 {type, url, method, data}
   */
  addQueue(queueName, operation) {
    try {
      const queueKey = this._getQueueKey(queueName);
      let queue = wx.getStorageSync(queueKey) || [];

      queue.push({
        ...operation,
        timestamp: Date.now()
      });

      wx.setStorageSync(queueKey, queue);
      console.log(`[OfflineCache] Add to queue: ${queueName}, total: ${queue.length}`);
      return true;
    } catch (error) {
      console.error('[OfflineCache] Add queue error:', error);
      return false;
    }
  }

  /**
   * 获取离线队列
   * @param {string} queueName - 队列名称
   */
  getQueue(queueName) {
    try {
      const queueKey = this._getQueueKey(queueName);
      const queue = wx.getStorageSync(queueKey) || [];
      return queue;
    } catch (error) {
      console.error('[OfflineCache] Get queue error:', error);
      return [];
    }
  }

  /**
   * 清空离线队列
   * @param {string} queueName - 队列名称
   */
  clearQueue(queueName) {
    try {
      const queueKey = this._getQueueKey(queueName);
      wx.removeStorageSync(queueKey);
      console.log(`[OfflineCache] Clear queue: ${queueName}`);
      return true;
    } catch (error) {
      console.error('[OfflineCache] Clear queue error:', error);
      return false;
    }
  }

  /**
   * 处理离线队列
   * @param {string} queueName - 队列名称
   * @param {function} handler - 处理函数，返回Promise
   */
  async processQueue(queueName, handler) {
    try {
      const queue = this.getQueue(queueName);
      if (queue.length === 0) {
        return { success: true, processed: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (let i = 0; i < queue.length; i++) {
        const operation = queue[i];
        try {
          await handler(operation);
          processed++;
        } catch (error) {
          console.error(`[OfflineCache] Process queue item failed:`, error);
          failed++;
        }
      }

      // 清空已处理的队列
      if (processed > 0) {
        this.clearQueue(queueName);
      }

      console.log(`[OfflineCache] Process queue: ${queueName}, processed: ${processed}, failed: ${failed}`);
      return { success: true, processed, failed };
    } catch (error) {
      console.error('[OfflineCache] Process queue error:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== 业务特定缓存方法 ==========

  /**
   * 缓存景点列表
   */
  setScenicList(data, page = 1) {
    return this.set(`scenic_list_${page}`, data, 600000); // 10分钟
  }

  /**
   * 获取景点列表缓存
   */
  getScenicList(page = 1) {
    return this.get(`scenic_list_${page}`);
  }

  /**
   * 缓存景点详情
   */
  setScenicDetail(id, data) {
    return this.set(`scenic_detail_${id}`, data, 3600000); // 1小时
  }

  /**
   * 获取景点详情缓存
   */
  getScenicDetail(id) {
    return this.get(`scenic_detail_${id}`);
  }

  /**
   * 缓存路线列表
   */
  setRouteList(data, page = 1) {
    return this.set(`route_list_${page}`, data, 600000); // 10分钟
  }

  /**
   * 获取路线列表缓存
   */
  getRouteList(page = 1) {
    return this.get(`route_list_${page}`);
  }

  /**
   * 缓存路线详情
   */
  setRouteDetail(id, data) {
    return this.set(`route_detail_${id}`, data, 3600000); // 1小时
  }

  /**
   * 获取路线详情缓存
   */
  getRouteDetail(id) {
    return this.get(`route_detail_${id}`);
  }

  /**
   * 缓存足迹数据
   */
  setFootprints(data) {
    return this.set('footprints', data, 86400000); // 24小时
  }

  /**
   * 获取足迹缓存
   */
  getFootprints() {
    return this.get('footprints');
  }

  /**
   * 缓存优惠券列表
   */
  setCoupons(data) {
    return this.set('coupons', data, 300000); // 5分钟
  }

  /**
   * 获取优惠券缓存
   */
  getCoupons() {
    return this.get('coupons');
  }

  /**
   * 添加离线操作到队列
   */
  addOfflineOperation(operation) {
    return this.addQueue('operations', operation);
  }

  /**
   * 获取离线操作队列
   */
  getOfflineOperations() {
    return this.getQueue('operations');
  }

  /**
   * 清空离线操作队列
   */
  clearOfflineOperations() {
    return this.clearQueue('operations');
  }
}

// 创建单例
const offlineCache = new OfflineCache();

module.exports = offlineCache;

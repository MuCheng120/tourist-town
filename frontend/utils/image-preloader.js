// 图片预加载工具
class ImagePreloader {
  constructor() {
    this.maxConcurrent = 5; // 最大并发下载数
    this.queue = [];
    this.loading = false;
    this.loadedImages = new Map(); // 已加载的图片缓存
    this.failedImages = new Set(); // 加载失败的图片
  }

  /**
   * 预加载单张图片
   * @param {string} src - 图片URL
   * @returns {Promise}
   */
  preloadImage(src) {
    return new Promise((resolve, reject) => {
      // 检查是否已缓存
      if (this.loadedImages.has(src)) {
        resolve(this.loadedImages.get(src));
        return;
      }

      // 检查是否加载失败过
      if (this.failedImages.has(src)) {
        reject(new Error('Image previously failed to load'));
        return;
      }

      wx.getImageInfo({
        src,
        success: (res) => {
          this.loadedImages.set(src, res);
          console.log(`[ImagePreloader] Preloaded: ${src}`);
          resolve(res);
        },
        fail: (err) => {
          this.failedImages.add(src);
          console.error(`[ImagePreloader] Failed to load: ${src}`, err);
          reject(err);
        }
      });
    });
  }

  /**
   * 预加载多张图片
   * @param {Array<string>} urls - 图片URL数组
   * @returns {Promise<Array>}
   */
  async preloadImages(urls) {
    if (!Array.isArray(urls) || urls.length === 0) {
      return [];
    }

    const results = [];
    const errors = [];

    // 分批加载，避免并发过多
    for (let i = 0; i < urls.length; i += this.maxConcurrent) {
      const batch = urls.slice(i, i + this.maxConcurrent);
      const promises = batch.map(url => 
        this.preloadImage(url).catch(err => {
          errors.push({ url, error: err });
          return null;
        })
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    if (errors.length > 0) {
      console.warn(`[ImagePreloader] ${errors.length} images failed to load`);
    }

    return results.filter(r => r !== null);
  }

  /**
   * 预加载景点列表的封面图
   * @param {Array} spots - 景点列表
   */
  preloadScenicSpots(spots) {
    const urls = spots
      .map(spot => spot.cover_image)
      .filter(url => url && url.length > 0);

    return this.preloadImages(urls);
  }

  /**
   * 预加载路线列表的封面图
   * @param {Array} routes - 路线列表
   */
  preloadRoutes(routes) {
    const urls = routes
      .map(route => route.cover_image)
      .filter(url => url && url.length > 0);

    return this.preloadImages(urls);
  }

  /**
   * 预加载商品列表的封面图
   * @param {Array} products - 商品列表
   */
  preloadProducts(products) {
    const urls = products
      .map(product => product.cover_image)
      .filter(url => url && url.length > 0);

    return this.preloadImages(urls);
  }

  /**
   * 预加载详情页的所有图片
   * @param {string} coverImage - 封面图
   * @param {Array<string>} detailImages - 详情图片数组
   */
  preloadDetailImages(coverImage, detailImages = []) {
    const urls = [];

    if (coverImage) {
      urls.push(coverImage);
    }

    if (Array.isArray(detailImages)) {
      urls.push(...detailImages);
    }

    return this.preloadImages(urls);
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.loadedImages.clear();
    this.failedImages.clear();
    console.log('[ImagePreloader] Cache cleared');
  }

  /**
   * 获取已缓存的图片信息
   * @param {string} src - 图片URL
   */
  getCachedImage(src) {
    return this.loadedImages.get(src);
  }

  /**
   * 检查图片是否已缓存
   * @param {string} src - 图片URL
   */
  isCached(src) {
    return this.loadedImages.has(src);
  }

  /**
   * 获取缓存大小（估算）
   */
  getCacheSize() {
    return this.loadedImages.size;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      cached: this.loadedImages.size,
      failed: this.failedImages.size,
      total: this.loadedImages.size + this.failedImages.size
    };
  }

  /**
   * 预加载下一页的图片（用于分页场景）
   * @param {Array} items - 下一页的数据
   * @param {string} type - 数据类型 (scenic/route/product)
   */
  async preloadNextPage(items, type = 'scenic') {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    // 异步预加载，不阻塞当前操作
    setTimeout(async () => {
      try {
        switch (type) {
          case 'scenic':
            await this.preloadScenicSpots(items);
            break;
          case 'route':
            await this.preloadRoutes(items);
            break;
          case 'product':
            await this.preloadProducts(items);
            break;
        }
      } catch (error) {
        console.error('[ImagePreloader] Preload next page failed:', error);
      }
    }, 1000);
  }

  /**
   * 智能预加载（根据网络状态决定是否预加载）
   * @param {Array} urls - 图片URL数组
   * @param {string} networkType - 网络类型
   */
  async smartPreload(urls, networkType = 'unknown') {
    // WiFi环境下预加载所有图片
    if (networkType === 'wifi') {
      return this.preloadImages(urls);
    }

    // 4G/5G环境下只预加载前3张
    if (networkType === '4g' || networkType === '5g') {
      const topUrls = urls.slice(0, 3);
      return this.preloadImages(topUrls);
    }

    // 2G/3G环境下不预加载
    console.log('[ImagePreloader] Network type not suitable for preloading:', networkType);
    return Promise.resolve([]);
  }
}

// 创建单例
const imagePreloader = new ImagePreloader();

module.exports = imagePreloader;

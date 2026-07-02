// pages/index/index.js
const app = getApp();
const offlineCache = require('../../utils/offline-cache');
const networkMonitor = require('../../utils/network-monitor');
const imagePreloader = require('../../utils/image-preloader');

/** 首页推荐商品：统一封面（多图优先首张，否则 cover）、销量字段 */
function normalizeRecommendProduct(p, appInst) {
  if (!p) return p;
  const imgs = appInst.fullImageUrls(p.images || []);
  const cover = appInst.fullImageUrl(p.cover_image);
  const cardImage = (imgs && imgs[0]) ? imgs[0] : (cover || '');
  return {
    ...p,
    cover_image: cover,
    images: imgs,
    cardImage,
    sales_count: p.sales_count != null ? Number(p.sales_count) : Number(p.sales || 0),
  };
}

Page({
  data: {
    banners: [],
    carouselList: [], // 轮播列表：仅使用 Banner 配置
    notice: '',
    recommendSpots: [],
    recommendProducts: [],
    recommendPosts: [],
    isOffline: false,
    fromCache: false,
  },

  onLoad() {
    // 添加网络监听
    networkMonitor.addListener(this.handleNetworkChange);
    
    // 加载首页数据
    this.loadAllData();
  },

  onUnload() {
    // 移除网络监听
    networkMonitor.removeListener(this.handleNetworkChange);
  },

  /**
   * 处理网络状态变化
   */
  handleNetworkChange(isConnected, networkType) {
    this.setData({
      isOffline: !isConnected
    });

    if (!isConnected) {
      // 网络断开，尝试加载缓存数据
      this.loadFromCache();
    } else {
      // 网络恢复，重新加载数据
      this.loadAllData();
    }
  },

  /**
   * 加载所有数据
   */
  loadAllData() {
    Promise.all([
      this.loadBanners(),
      this.loadAnnouncements(),
      this.loadRecommendSpots(),
      this.loadRecommendProducts(),
      this.loadRecommendPosts(),
    ]);
  },

  onShow() {
    // 管理员/商家若通过微信「回到首页」进入游客首页，自动跳回各自工作台
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'admin') {
      wx.reLaunch({ url: '/admin/pages/dashboard/index' });
      return;
    }
    if (userInfo && userInfo.role === 'merchant') {
      wx.reLaunch({ url: '/merchant/pages/dashboard/index' });
      return;
    }

    // 设置当前 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabBar();
    }

    // 页面显示时刷新数据
    if (this.data.recommendProducts.length > 0) {
      this.loadRecommendProducts();
    }

    // 如果在其他页面点了攻略点赞，回到首页时刷新热门攻略数据
    if (app.globalData.needRefreshRecommendPosts) {
      app.globalData.needRefreshRecommendPosts = false;
      this.loadRecommendPosts();
    }
  },

  onPullDownRefresh() {
    if (this.data.isOffline) {
      wx.showToast({
        title: '离线模式下无法刷新',
        icon: 'none',
        duration: 2000
      });
      wx.stopPullDownRefresh();
      return;
    }

    this.setData({ fromCache: false });
    
    Promise.all([
      this.loadBanners(),
      this.loadAnnouncements(),
      this.loadRecommendSpots(),
      this.loadRecommendProducts(),
      this.loadRecommendPosts(),
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载轮播：使用 Banner 配置
   */
  async loadBanners() {
    try {
      const cachedData = offlineCache.get('home_banners');
      const res = await networkMonitor.request(
        () => app.request({ url: '/api/banners/active', method: 'GET' }),
        { useCache: true, cacheData: cachedData }
      );
      if (res.success) {
        const rawList = res.data || [];
        const carouselList = rawList.map(item => ({ ...item, image: app.fullImageUrl(item.image) }));
        if (!res.fromCache) offlineCache.set('home_banners', res.data, 3600000);
        this.setData({ carouselList, banners: carouselList });
        if (!res.fromCache && carouselList.length) {
          imagePreloader.preloadImages(carouselList.map(item => item.image).filter(Boolean));
        }
      } else if (res.fromCache && cachedData) {
        const carouselList = (cachedData || []).map(item => ({ ...item, image: app.fullImageUrl(item.image) }));
        this.setData({ carouselList, banners: carouselList });
      }
    } catch (error) {
      console.error('加载轮播失败:', error);
      const cachedData = offlineCache.get('home_banners');
      if (cachedData) {
        const carouselList = (cachedData || []).map(item => ({ ...item, image: app.fullImageUrl(item.image) }));
        this.setData({ carouselList, banners: carouselList });
      }
    }
  },

  /**
   * 加载公告
   */
  async loadAnnouncements() {
    try {
      const res = await app.request({
        url: '/api/announcements',
        data: { limit: 1, status: 1 },
      });

      // app.request 返回的就是后端 data 字段
      const list = Array.isArray(res) ? res : (res.list || res.data || []);
      if (list.length > 0) {
        this.setData({ notice: list[0].title });
      }
    } catch (error) {
      console.error('加载公告失败:', error);
    }
  },

  /**
   * 加载推荐景点
   */
  async loadRecommendSpots() {
    try {
      const cachedData = offlineCache.get('home_recommend_spots');
      
      const res = await networkMonitor.request(
        () => app.request({
          url: '/api/scenic-spots',
          data: { limit: 6, status: 1, sortBy: 'hot' },
        }),
        {
          useCache: true,
          cacheData: cachedData
        }
      );

      if (res.success) {
        const responseData = res.data;
        const list = Array.isArray(responseData) ? responseData : (responseData.list || []);
        const recommendSpots = list.map(s => ({ ...s, cover_image: app.fullImageUrl(s.cover_image) }));
        if (!res.fromCache && list.length > 0) {
          offlineCache.set('home_recommend_spots', list, 600000);
          imagePreloader.preloadImages(recommendSpots.map(s => s.cover_image).filter(Boolean));
        }
        this.setData({ recommendSpots });
      } else if (res.fromCache && cachedData) {
        const list = Array.isArray(cachedData) ? cachedData : (cachedData.list || []);
        this.setData({ recommendSpots: list.map(s => ({ ...s, cover_image: app.fullImageUrl(s.cover_image) })) });
      }
    } catch (error) {
      console.error('Load spots error:', error);
      // 失败时尝试使用缓存
      const cachedData = offlineCache.get('home_recommend_spots');
      if (cachedData) {
        const list = Array.isArray(cachedData) ? cachedData : (cachedData.list || []);
        this.setData({ recommendSpots: list.map(s => ({ ...s, cover_image: app.fullImageUrl(s.cover_image) })) });
      }
    }
  },

  /**
   * 加载推荐商品
   */
  async loadRecommendProducts() {
    try {
      const cachedData = offlineCache.get('home_recommend_products');
      
      const res = await networkMonitor.request(
        () => app.request({
          url: '/api/products',
          data: { limit: 4, is_recommend: true },
        }),
        {
          useCache: true,
          cacheData: cachedData
        }
      );

      if (res.success) {
        // networkMonitor.request 返回 { success, data, fromCache }，列表在 res.data.list（与 mall 页一致）
        const responseData = res.data || {};
        const products = Array.isArray(responseData.list) ? responseData.list : [];
        const recommendProducts = products.map(p => normalizeRecommendProduct(p, app));
        if (!res.fromCache) {
          offlineCache.set('home_recommend_products', products, 600000);
          if (recommendProducts.length > 0) {
            imagePreloader.preloadImages(recommendProducts.map(p => p.cardImage).filter(Boolean));
          }
        }
        this.setData({ recommendProducts });
      } else if (res.fromCache && cachedData) {
        const products = Array.isArray(cachedData) ? cachedData : (cachedData.list || []);
        this.setData({ recommendProducts: products.map(p => normalizeRecommendProduct(p, app)) });
      }
    } catch (error) {
      console.error('加载推荐商品失败:', error);
      const cachedData = offlineCache.get('home_recommend_products');
      if (cachedData) {
        const products = Array.isArray(cachedData) ? cachedData : (cachedData.list || []);
        this.setData({ recommendProducts: products.map(p => normalizeRecommendProduct(p, app)) });
      }
    }
  },

  /**
   * 加载推荐攻略
   */
  async loadRecommendPosts() {
    try {
      const res = await app.request({
        url: '/api/posts',
        // 首页「热门攻略」预览条数（与后端 getPostList 的 limit 一致；需要更多可改此处）
        data: { limit: 6, is_recommend: true },
      });
      const postList = Array.isArray(res.list) ? res.list : [];
      const recommendPosts = postList.map(p => ({
        ...p,
        images: app.fullImageUrls(p.images || []),
        user: p.user ? { ...p.user, avatar: app.fullImageUrl(p.user.avatar) } : p.user,
      }));
      this.setData({ recommendPosts });
    } catch (error) {
      console.error('加载推荐攻略失败:', error);
      // 失败时设置为空数组
      this.setData({ recommendPosts: [] });
    }
  },

  /**
   * 导航到指定页面
   */
  navigateTo(e) {
    const { url } = e.currentTarget.dataset;
    if (url.includes('pages/user')) {
      wx.switchTab({ url });
    } else if (url.includes('pages/mall') || url.includes('pages/hotel') || url.includes('pages/community')) {
      wx.switchTab({ url });
    } else {
      wx.navigateTo({ url });
    }
  },

  /** 公告列表（含正文详情） */
  navigateToNoticeList() {
    wx.navigateTo({ url: '/pages/notice/index' });
  },

  /**
   * 导航到景点详情
   */
  navigateToSpot(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/scenic/detail?id=${id}`,
    });
  },

  /**
   * 导航到商品详情
   */
  navigateToProduct(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product/detail?id=${id}`,
    });
  },

  /**
   * 导航到攻略详情
   */
  navigateToPost(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/community/detail?id=${id}`,
    });
  },

  /**
   * 轮播点击：按 Banner linkType 跳转
   */
  onBannerClick(e) {
    const { item } = e.currentTarget.dataset;
    if (!item) return;

    switch (item.linkType) {
      case 'scenic':
        if (item.linkValue) {
          wx.navigateTo({ url: `/pages/scenic/detail?id=${item.linkValue}` });
        }
        break;
      case 'product':
        if (item.linkValue) {
          wx.navigateTo({ url: `/pages/product/detail?id=${item.linkValue}` });
        }
        break;
      case 'post':
        if (item.linkValue) {
          wx.navigateTo({ url: `/pages/community/detail?id=${item.linkValue}` });
        }
        break;
      case 'url':
        if (item.linkValue) {
          wx.navigateTo({
            url: `/pages/webview/index?url=${encodeURIComponent(item.linkValue)}`,
          });
        }
        break;
      default:
        break;
    }
  },
});

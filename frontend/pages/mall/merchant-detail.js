// pages/mall/merchant-detail.js
const app = getApp();
const offlineCache = require('../../utils/offline-cache');
const networkMonitor = require('../../utils/network-monitor');
const imagePreloader = require('../../utils/image-preloader');

Page({
  data: {
    keyword: '',
    merchantId: '',
    merchantName: '',
    merchantAddress: '',
    activeProductType: 'souvenir', // souvenir-特产，food-餐饮
    activeCategory: 'all', // 全部；与 van-tab name="all" 对应
    products: [],
    page: 1,
    limit: 10,
    loading: false,
    noMore: false,
    cartCount: 0,
    isOffline: false,
    fromCache: false,
    orderBy: '', // '' | sales | price_asc | price_desc
  },

  onLoad(options) {
    if (options.merchant_id) {
      this.setData({ merchantId: String(options.merchant_id).trim() });
    }
    if (options.merchant_name) {
      this.setData({ merchantName: decodeURIComponent(options.merchant_name) });
    }
    if (options.merchant_address) {
      this.setData({ merchantAddress: decodeURIComponent(options.merchant_address) });
    }
    networkMonitor.addListener(this.handleNetworkChange);
    this.loadProducts();
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
      this.refreshData();
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabBar();
    }

    this.loadCartCount();
  },

  /**
   * 下拉刷新
   */
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

    this.setData({
      page: 1,
      products: [],
      noMore: false,
      fromCache: false
    });
    this.loadProducts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (!this.data.loading && !this.data.noMore) {
      this.setData({ page: this.data.page + 1 });
      this.loadProducts();
    }
  },

  /**
   * 搜索输入变化
   */
  onSearchChange(e) {
    this.setData({ keyword: e.detail });
  },

  /**
   * 搜索
   */
  onSearch() {
    this.setData({
      page: 1,
      products: [],
      noMore: false,
    });
    this.loadProducts();
  },

  /**
   * 商品类型切换：特产 / 餐饮
   */
  onProductTypeChange(e) {
    const type = e.currentTarget.dataset.type || 'souvenir';
    if (type === this.data.activeProductType) return;
    this.setData({
      activeProductType: type,
      activeCategory: 'all',
      orderBy: '',
      page: 1,
      products: [],
      noMore: false,
    });
    this.loadProducts();
  },

  onSortSales() {
    // 切换三态：'' -> 'sales' (降序) -> 'sales_asc' (升序) -> ''
    let orderBy = '';
    if (!this.data.orderBy) orderBy = 'sales';
    else if (this.data.orderBy === 'sales') orderBy = 'sales_asc';
    else orderBy = '';

    this.setData({ orderBy, page: 1, products: [], noMore: false });
    this.loadProducts();
  },

  onSortPrice() {
    let orderBy = this.data.orderBy === 'price_asc' ? 'price_desc' : 'price_asc';
    this.setData({ orderBy, page: 1, products: [], noMore: false });
    this.loadProducts();
  },

  /**
   * 分类切换（仅特产时有效）
   * 「全部」对应 name=all，请求 API 时转为 category 空表示不按分类筛
   */
  onCategoryChange(e) {
    const category = e.detail.name;
    this.setData({
      activeCategory: category,
      page: 1,
      products: [],
      noMore: false,
    });
    this.loadProducts();
  },

  /**
   * 加载商品列表
   */
  async loadProducts() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const cacheKey = `products_${this.data.page}_${this.data.keyword}_${this.data.merchantId}_${this.data.activeProductType}_${this.data.activeCategory}_${this.data.orderBy}`;
      const cachedData = offlineCache.get(cacheKey);
      const categoryParam = this.data.activeCategory === 'all' ? '' : this.data.activeCategory;
      const requestData = {
        product_type: this.data.activeProductType,
        category: categoryParam,
        keyword: this.data.keyword,
        page: this.data.page,
        limit: this.data.limit,
        order_by: this.data.orderBy || undefined,
      };
      if (this.data.merchantId) {
        requestData.merchant_id = this.data.merchantId;
      }
      const res = await networkMonitor.request(
        () => app.request({
          url: '/api/products',
          data: requestData,
        }),
        {
          useCache: true,
          cacheData: cachedData
        }
      );

      console.log('[Merchant Detail] Load products response:', res);
      
      const responseData = res.data;
      const rawList = Array.isArray(responseData.list) ? responseData.list : [];
      const products = rawList.map(p => ({
        ...p,
        cover_image: app.fullImageUrl(p.cover_image),
        images: app.fullImageUrls(p.images || []),
      }));

      if (!res.fromCache) {
        offlineCache.set(cacheKey, responseData, 600000);
        if (products.length > 0) {
          const networkType = networkMonitor.getNetworkType();
          imagePreloader.smartPreload(
            products.map(product => product.cover_image).filter(url => url),
            networkType
          );
        }
      }

      if (products.length === 0) {
        this.setData({ noMore: true });
      } else {
        const newProducts = this.data.page === 1 ? products : [...this.data.products, ...products];
        this.setData({
          products: newProducts,
          fromCache: res.fromCache
        });
        
        if (products.length < this.data.limit) {
          this.setData({ noMore: true });
        }
      }

      // 如果是从缓存加载的，显示提示
      if (res.fromCache && !cachedData) {
        wx.showToast({
          title: '已加载缓存数据',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('加载商品失败:', error);
      
      // 如果是离线错误，尝试从缓存加载
      if (error.isOffline) {
        this.loadFromCache();
      } else {
        wx.showToast({
          title: '加载失败',
          icon: 'none',
        });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 从缓存加载数据
   */
  loadFromCache() {
    const cacheKey = `products_${this.data.page}_${this.data.keyword}_${this.data.merchantId}_${this.data.activeProductType}_${this.data.activeCategory}_${this.data.orderBy}`;
    const cachedData = offlineCache.get(cacheKey);
    
    if (cachedData) {
      const rawList = Array.isArray(cachedData.list) ? cachedData.list : (Array.isArray(cachedData) ? cachedData : []);
      const products = rawList.map(p => ({
        ...p,
        cover_image: app.fullImageUrl(p.cover_image),
        images: app.fullImageUrls(p.images || []),
      }));
      this.setData({
        products,
        fromCache: true,
        noMore: products.length < this.data.limit
      });
      
      wx.showToast({
        title: '已加载缓存数据',
        icon: 'none',
        duration: 2000
      });
    } else {
      wx.showToast({
        title: '无缓存数据',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 刷新数据
   */
  refreshData() {
    this.setData({
      products: [],
      page: 1,
      noMore: false,
      fromCache: false
    }, () => {
      this.loadProducts();
    });
  },

  /**
   * 导航到商品详情
   */
  navigateToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/product/detail?id=${id}`,
    });
  },

  /**
   * 加载购物车数量
   */
  async loadCartCount() {
    // 未登录不显示购物车数量
    if (!app.globalData.token) {
      this.setData({ cartCount: 0 });
      return;
    }

    try {
      const res = await app.request({
        url: '/api/shopping-cart/count',
        method: 'GET',
        needAuth: true,  // 需要认证
      });

      // app.request() 已经解析了响应，res 就是 data 对象 { count: number }
      if (res && res.count !== undefined) {
        this.setData({ cartCount: res.count });
      }
    } catch (error) {
      console.error('加载购物车数量失败:', error);
    }
  },

  /**
   * 跳转到购物车
   */
  navigateToCart() {
    wx.navigateTo({
      url: '/pages/cart/index',
    });
  },
});
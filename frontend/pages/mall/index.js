// pages/mall/index.js
const app = getApp();
const offlineCache = require('../../utils/offline-cache');
const networkMonitor = require('../../utils/network-monitor');
const imagePreloader = require('../../utils/image-preloader');

Page({
  data: {
    keyword: '',
    merchantId: '', // 从商品详情「店铺」进入时传入，只显示该商家商品
    activeProductType: 'souvenir', // souvenir-特产，food-餐饮
    activeCategory: 'all', // 全部；与 van-tab name="all" 对应
    products: [],
    merchants: [],
    currentMerchant: null, // 当前商家信息（从商家列表进入时）
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
    if (options.keyword) {
      this.setData({ keyword: options.keyword });
    }
    if (options.merchant_id) {
      this.setData({ merchantId: String(options.merchant_id).trim() });
    }
    if (options.merchant_name) {
      const merchantName = decodeURIComponent(options.merchant_name);
      const currentMerchant = this.data.currentMerchant || {};
      this.setData({
        currentMerchant: {
          ...currentMerchant,
          business_name: merchantName,
        }
      });
    }
    if (options.merchant_address) {
      const merchantAddress = decodeURIComponent(options.merchant_address);
      const currentMerchant = this.data.currentMerchant || {};
      this.setData({
        currentMerchant: {
          ...currentMerchant,
          address: merchantAddress,
        }
      });
    }
    networkMonitor.addListener(this.handleNetworkChange);
    if (this.data.merchantId) {
      this.loadProducts();
    } else {
      this.loadMerchants();
    }
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
      if (this.data.merchantId) {
        this.loadFromCache();
      } else {
        this.loadMerchantsFromCache();
      }
    } else {
      // 网络恢复，重新加载数据
      this.refreshData();
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabBar();
    }

    // 从商品详情点「店铺」跳转过来时，通过 globalData 传入 merchant_id，此处读取并跳转到商家商品列表页
    const merchantIdToShow = app.globalData.merchantIdToShow;
    if (merchantIdToShow) {
      app.globalData.merchantIdToShow = null;
      const merchantNameToShow = app.globalData.merchantNameToShow || '';
      const merchantAddressToShow = app.globalData.merchantAddressToShow || '';
      app.globalData.merchantNameToShow = null;
      app.globalData.merchantAddressToShow = null;
      const encodedName = encodeURIComponent(merchantNameToShow);
      const encodedAddress = encodeURIComponent(merchantAddressToShow);
      wx.navigateTo({
        url: `/pages/mall/merchant-detail?merchant_id=${merchantIdToShow}&merchant_name=${encodedName}&merchant_address=${encodedAddress}`,
      });
      return;
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
      merchants: [],
      noMore: false,
      fromCache: false
    });
    if (this.data.merchantId) {
      this.loadProducts().finally(() => {
        wx.stopPullDownRefresh();
      });
    } else {
      this.loadMerchants().finally(() => {
        wx.stopPullDownRefresh();
      });
    }
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (!this.data.loading && !this.data.noMore) {
      this.setData({ page: this.data.page + 1 });
      if (this.data.merchantId) {
        this.loadProducts();
      } else {
        this.loadMerchants();
      }
    }
  },

  /**
   * 搜索输入改变
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
      merchants: [],
      noMore: false,
    });
    if (this.data.merchantId) {
      this.loadProducts();
    } else {
      this.loadMerchants();
    }
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
   * 加载商家列表
   */
  async loadMerchants() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const cacheKey = `merchants_${this.data.page}_${this.data.keyword}`;
      const cachedData = offlineCache.get(cacheKey);
      const requestData = {
        page: this.data.page,
        limit: this.data.limit,
        keyword: this.data.keyword,
      };
      const res = await networkMonitor.request(
        () => app.request({
          url: '/api/merchants',
          data: requestData,
        }),
        {
          useCache: true,
          cacheData: cachedData
        }
      );

      console.log('[Mall] Load merchants response:', res);
      
      const responseData = res.data;
      const rawList = Array.isArray(responseData.list) ? responseData.list : [];
      const merchants = rawList.map(m => ({
        ...m,
        avatar: app.fullImageUrl(m.avatar),
        shop_images: m.shop_images ? m.shop_images.map(img => app.fullImageUrl(img)) : [],
      }));

      if (!res.fromCache) {
        offlineCache.set(cacheKey, responseData, 600000);
        if (merchants.length > 0) {
          const networkType = networkMonitor.getNetworkType();
          imagePreloader.smartPreload(
            merchants.map(merchant => merchant.avatar).filter(url => url),
            networkType
          );
        }
      }

      if (merchants.length === 0) {
        this.setData({ noMore: true });
      } else {
        const newMerchants = this.data.page === 1 ? merchants : [...this.data.merchants, ...merchants];
        this.setData({
          merchants: newMerchants,
          fromCache: res.fromCache
        });
        
        if (merchants.length < this.data.limit) {
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
      console.error('加载商家失败:', error);
      
      // 如果是离线错误，尝试从缓存加载
      if (error.isOffline) {
        this.loadMerchantsFromCache();
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
   * 从缓存加载商家数据
   */
  loadMerchantsFromCache() {
    const cacheKey = `merchants_${this.data.page}_${this.data.keyword}`;
    const cachedData = offlineCache.get(cacheKey);
    
    if (cachedData) {
      const rawList = Array.isArray(cachedData.list) ? cachedData.list : (Array.isArray(cachedData) ? cachedData : []);
      const merchants = rawList.map(m => ({
        ...m,
        avatar: app.fullImageUrl(m.avatar),
        shop_images: m.shop_images ? m.shop_images.map(img => app.fullImageUrl(img)) : [],
      }));
      this.setData({
        merchants,
        fromCache: true,
        noMore: merchants.length < this.data.limit
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
        keyword: this.data.keyword,
        product_type: this.data.activeProductType,
        category: categoryParam,
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

      // networkMonitor.request 返回 { success, data, fromCache }
      // app.request 返回的 data 是 { total, page, limit, list }
      console.log('[Mall] Load products response:', res);
      
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
      merchants: [],
      page: 1,
      noMore: false,
      fromCache: false
    }, () => {
      if (this.data.merchantId) {
        this.loadProducts();
      } else {
        this.loadMerchants();
      }
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
   * 导航到商家详情
   */
  navigateToMerchantDetail(e) {
    const { id } = e.currentTarget.dataset;
    const merchant = this.data.merchants.find(m => String(m.id) === String(id));
    if (merchant) {
      const encodedName = encodeURIComponent(merchant.business_name || '');
      const encodedAddress = encodeURIComponent(merchant.address || '');
      wx.navigateTo({
        url: `/pages/mall/merchant-detail?merchant_id=${id}&merchant_name=${encodedName}&merchant_address=${encodedAddress}`,
      });
    } else {
      wx.navigateTo({
        url: `/pages/mall/merchant-detail?merchant_id=${id}`,
      });
    }
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

// app.js
const networkMonitor = require('./utils/network-monitor');
const offlineCache = require('./utils/offline-cache');

// 默认后端地址（可被 storage 中的 apiBaseUrl 覆盖）
const DEFAULT_API_BASE = 'http://localhost:7001';

function normalizeApiBase(url) {
  if (!url || typeof url !== 'string') return '';
  return String(url).trim().replace(/\/+$/, '');
}

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: DEFAULT_API_BASE, // 后端API地址（onLaunch 时会按本地配置覆盖）
    apiBaseUrl: DEFAULT_API_BASE, // 与 baseUrl 一致，供部分页面使用
    currentPage: null, // 当前页面路径
    pageShowTime: null, // 页面显示时间
    targetId: null, // 当前页面目标ID
    isOnline: true, // 网络状态
    needRefreshRecommendPosts: false, // 首页热门攻略是否需要刷新
    needRefreshCommunityPosts: false, // 攻略列表页是否需要刷新（如隐藏/解除隐藏后）
    merchantIdToShow: null, // 从商品详情点「店铺」时传入，商城页 onShow 时读取并跳转到商家商品列表页
    merchantNameToShow: null, // 商家名称
    merchantAddressToShow: null, // 商家地址
  },

  /**
   * 将相对路径图片 URL 拼接为完整可访问地址（所有前端显示图片统一使用）
   * @param {string} url - 相对路径如 /uploads/user/xxx.jpg 或完整 http(s) URL
   * @returns {string} 完整 URL 或空字符串
   */
  fullImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = this.globalData.baseUrl || '';
    return base ? base + (url.startsWith('/') ? url : '/' + url) : url;
  },

  /**
   * 批量将相对路径拼接为完整 URL
   * @param {string[]} urls
   * @returns {string[]}
   */
  fullImageUrls(urls) {
    if (!Array.isArray(urls)) return [];
    return urls.map(u => this.fullImageUrl(u)).filter(Boolean);
  },

  onLaunch(options) {
    // 允许通过 storage 动态配置后端地址，便于真机切换到局域网 IP
    const customBase = normalizeApiBase(wx.getStorageSync('apiBaseUrl'));
    const finalBase = customBase || DEFAULT_API_BASE;
    this.globalData.baseUrl = finalBase;
    this.globalData.apiBaseUrl = finalBase;

    // 真机环境使用 localhost 会导致图片/接口指向手机本机，基本不可用
    try {
      const info = wx.getSystemInfoSync();
      const platform = info && info.platform ? String(info.platform) : '';
      const isDevtools = platform === 'devtools';
      if (!isDevtools && /localhost|127\.0\.0\.1/.test(finalBase)) {
        wx.showModal({
          title: '调试提示',
          content: '当前后端地址是 localhost，真机无法访问你电脑服务。请改成电脑局域网IP并加入小程序合法域名。',
          showCancel: false,
        });
      }
    } catch (e) {
      // ignore
    }

    // 初始化网络监听
    networkMonitor.init();
    this.globalData.isOnline = networkMonitor.isOnline();

    // 清理过期缓存
    offlineCache.clearExpired();

    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
    }

    // 检查用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }

    // 启动路径（「添加编译模式」指定页面时会有，不要用工作台覆盖掉）
    const entryPath = (options && options.path) ? String(options.path).replace(/^\//, '') : '';
    const isAdminSubPage = entryPath.startsWith('admin/pages/') && entryPath !== 'admin/pages/dashboard/index';
    const isMerchantSubPage = entryPath.startsWith('merchant/pages/') && entryPath !== 'merchant/pages/dashboard/index';

    // 管理员/商家已登录时进入工作台（仅默认入口）；指定了管理端/商户端子页时尊重编译模式
    if (token && userInfo && userInfo.role) {
      if (userInfo.role === 'admin' && !isAdminSubPage) {
        wx.reLaunch({ url: '/admin/pages/dashboard/index' });
      } else if (userInfo.role === 'merchant' && !isMerchantSubPage) {
        wx.reLaunch({ url: '/merchant/pages/dashboard/index' });
      }
    }

    // 监听网络状态变化
    networkMonitor.addListener((isConnected, networkType) => {
      this.globalData.isOnline = isConnected;
      console.log('[App] Network status changed:', isConnected, networkType);
      
      // 如果网络恢复，同步离线数据
      if (isConnected) {
        this.syncOfflineData();
      }
    });

    // 预加载关键数据
    this.preloadCriticalData();
  },

  /**
   * 运行时更新 API 地址（并持久化）
   * @param {string} baseUrl
   */
  setApiBase(baseUrl) {
    const next = normalizeApiBase(baseUrl);
    if (!next) return false;
    this.globalData.baseUrl = next;
    this.globalData.apiBaseUrl = next;
    wx.setStorageSync('apiBaseUrl', next);
    return true;
  },

  /**
   * 页面显示时触发埋点
   */
  onShow() {
    // 获取当前页面栈
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      const route = currentPage.route;
      
      // 记录页面显示时间
      this.globalData.pageShowTime = Date.now();
      this.globalData.currentPage = route;
      
      // 尝试获取页面中的目标ID（如景点ID、路线ID等）
      if (currentPage.data && currentPage.data.id) {
        this.globalData.targetId = currentPage.data.id;
      } else {
        this.globalData.targetId = null;
      }
      
      // 如果已登录，记录页面访问行为
      if (this.globalData.token) {
        // PV/UV 统计（写入 page_views），静默上报
        this.trackPageView(route);
        this.trackBehavior('view', route, this.globalData.targetId);
      }
    }
  },

  /**
   * 页面隐藏时记录停留时长
   */
  onHide() {
    if (this.globalData.pageShowTime && this.globalData.currentPage) {
      const stayDuration = Math.floor((Date.now() - this.globalData.pageShowTime) / 1000);
      
      // 如果停留时长超过1秒，记录行为
      if (stayDuration > 1 && this.globalData.token) {
        this.trackBehavior('view', this.globalData.currentPage, this.globalData.targetId, stayDuration);
      }
      
      // 重置
      this.globalData.pageShowTime = null;
      this.globalData.currentPage = null;
      this.globalData.targetId = null;
    }
  },

  /**
   * 行为埋点
   */
  trackBehavior(actionType, pagePath, targetId = null, stayDuration = null) {
    // 如果未登录，不记录
    if (!this.globalData.token) {
      return;
    }

    // 解析目标类型
    let targetType = null;
    if (pagePath) {
      if (pagePath.includes('/scenic/')) {
        targetType = 'scenic';
      } else if (pagePath.includes('/product/') || pagePath.includes('/mall/')) {
        targetType = 'product';
      }
    }

    const data = {
      page_path: pagePath,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      stay_duration: stayDuration,
    };

    // 异步发送埋点数据，不影响页面加载
    wx.request({
      url: `${this.globalData.baseUrl}/api/behavior/track`,
      method: 'POST',
      data,
      header: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${this.globalData.token}`,
      },
      success: () => {
        // 埋点成功，不做处理
      },
      fail: (err) => {
        // 埋点失败，静默处理
        console.error('行为埋点失败:', err);
      },
    });
  },

  /**
   * 页面访问统计（PV/UV）
   * 说明：小程序端通常拿不到真实公网 IP，IP 由后端使用 ctx.ip 兜底。
   */
  trackPageView(pagePath) {
    if (!this.globalData.token || !pagePath) return;

    wx.request({
      url: `${this.globalData.baseUrl}/api/statistics/page-view`,
      method: 'POST',
      data: { page_path: pagePath },
      header: {
        'content-type': 'application/json',
        'Authorization': `Bearer ${this.globalData.token}`,
      },
      success: () => {},
      fail: () => {},
    });
  },

  /**
   * 检查登录状态
   */
  checkLogin() {
    if (!this.globalData.token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
      });
      
      // 跳转到用户中心页面
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/user/index',
        });
      }, 1500);
      
      return false;
    }
    return true;
  },

  /**
   * 封装请求方法（支持离线缓存）
   */
  request(options) {
    const { url, method = 'GET', data = {}, needAuth = false, useCache = false, cacheKey = null } = options;

    const header = {
      'content-type': 'application/json',
    };

    // 如果需要认证，添加 token（globalData 偶发未同步时从 storage 兜底）
    if (needAuth) {
      if (!this.globalData.token) {
        const t = wx.getStorageSync('token');
        if (t) this.globalData.token = t;
      }
      if (this.globalData.token) {
        header.Authorization = `Bearer ${this.globalData.token}`;
      }
    }

    // 如果启用缓存且离线，尝试从缓存获取
    if (useCache && cacheKey && !this.globalData.isOnline) {
      const cachedData = offlineCache.get(cacheKey);
      if (cachedData) {
        console.log('[App] Using cached data for:', cacheKey);
        return Promise.resolve(cachedData);
      }
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.globalData.baseUrl}${url}`,
        method,
        data,
        header,
        success: res => {
          if (res.statusCode === 200) {
            if (res.data.code === 200) {
              const responseData = res.data.data;
              
              // 如果启用缓存，保存到本地
              if (useCache && cacheKey && method === 'GET') {
                offlineCache.set(cacheKey, responseData, 600000); // 缓存10分钟
              }
              
              resolve(responseData);
            } else {
              // 如果请求失败且有缓存，返回缓存数据
              if (useCache && cacheKey) {
                const cachedData = offlineCache.get(cacheKey);
                if (cachedData) {
                  console.log('[App] Request failed, using cached data');
                  wx.showToast({
                    title: '网络错误，正在使用缓存数据',
                    icon: 'none',
                    duration: 2000,
                  });
                  resolve(cachedData);
                  return;
                }
              }
              
              // 对于位置服务的错误，不显示toast，因为不影响核心功能
              if (!url.includes('/api/location/reverse-geocode')) {
                wx.showToast({
                  title: res.data.message || '请求失败',
                  icon: 'none',
                });
              }
              reject(res.data);
            }
          } else if (res.statusCode === 401) {
            // token 相关错误：区分管理员后台接口与普通接口
            console.error('❌ 401 错误详情:', {
              url,
              method,
              needAuth,
              hasToken: !!this.globalData.token,
              token: this.globalData.token ? this.globalData.token.substring(0, 20) + '...' : 'none',
              timestamp: new Date().toISOString()
            });

            const isAdminRequest = url.indexOf('/api/statistics') === 0
              || url.indexOf('/api/admin/') === 0;

            if (isAdminRequest && this.globalData.userInfo && this.globalData.userInfo.role === 'admin') {
              // 管理员后台接口 401：只提示，不强制退出登录，避免自动跳回用户端
              wx.showToast({
                title: '加载后台数据失败，请稍后重试',
                icon: 'none',
              });
              reject(res);
              return;
            }

            wx.showToast({
              title: '登录已过期，请重新登录',
              icon: 'none',
            });

            // 清除登录信息
            this.globalData.token = null;
            this.globalData.userInfo = null;
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');

            setTimeout(() => {
              wx.switchTab({
                url: '/pages/user/index',
              });
            }, 1500);

            reject(res);
          } else if (res.statusCode >= 400 && res.statusCode < 500) {
            // 4xx 为请求错误，显示后端返回的文案，不显示「网络错误」
            const msg = (res.data && res.data.message) ? res.data.message : '请求失败';
            wx.showToast({ title: msg, icon: 'none' });
            reject(res);
          } else {
            // 5xx 等：登录接口由登录页统一提示，避免「网络错误」和「登录失败」重复
            const isLoginReq = url.indexOf('admin-login') !== -1 || url.indexOf('/api/user/login') !== -1;
            if (!isLoginReq) {
              wx.showToast({ title: '网络错误', icon: 'none' });
            }
            reject(res);
          }
        },
        fail: err => {
          // 如果请求失败且有缓存，返回缓存数据
          if (useCache && cacheKey) {
            const cachedData = offlineCache.get(cacheKey);
            if (cachedData) {
                  console.log('[App] Request failed, using cached data');
              wx.showToast({
                title: '网络错误，正在使用缓存数据',
                icon: 'none',
                duration: 2000,
              });
              resolve(cachedData);
              return;
            }
          }
          // 登录接口由登录页统一提示，避免重复
          const isLoginReq = url.indexOf('admin-login') !== -1 || url.indexOf('/api/user/login') !== -1;
          if (!isLoginReq) {
            wx.showToast({ title: '网络错误', icon: 'none' });
          }
          reject(err);
        },
      });
    });
  },

  /**
   * 上传图片（存到 uploads/{module}/images/）
   * @param {string} filePath 本地临时路径
   * @param {string} [module] 模块名：user|merchant|post|product|food|hotel|scenic|banner|comment|common
   */
  uploadImage(filePath, module = 'common') {
    return this._uploadFile(filePath, module, 'image');
  },

  /**
   * 上传文件（存到 uploads/{module}/files/，支持图片+PDF）
   * @param {string} filePath 本地临时路径
   * @param {string} [module] 模块名
   */
  uploadFile(filePath, module = 'common') {
    return this._uploadFile(filePath, module, 'file');
  },

  _uploadFile(filePath, module = 'common', type = 'image') {
    const base = `${this.globalData.baseUrl}/api/upload`;
    const url = `${base}?module=${encodeURIComponent(module)}&type=${type}`;
    const token = this.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录后再上传', icon: 'none' });
      return Promise.reject(new Error('No token'));
    }
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath,
        name: 'file',
        header: {
          'Authorization': `Bearer ${token}`,
        },
        success: res => {
          let data;
          try {
            data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          } catch (e) {
            wx.showToast({ title: '上传失败，响应格式异常', icon: 'none' });
            reject(new Error('Invalid response'));
            return;
          }
          if (res.statusCode !== 200) {
            const rawMsg = (data && data.message) ? data.message : '';
            const safeMsg = (rawMsg && /SQL|syntax|near\s*'|ER_/.test(rawMsg)) ? '上传失败，请重试' : (rawMsg || `请求失败(${res.statusCode})`);
            wx.showToast({ title: safeMsg, icon: 'none' });
            reject(new Error(safeMsg));
            return;
          }
          if (data.code === 200 && data.data && data.data.url) {
            resolve(data.data.url);
          } else {
            const rawMsg = (data && data.message) || '没有上传成功';
            const safeMsg = (rawMsg && /SQL|syntax|near\s*'|ER_/.test(rawMsg)) ? '上传失败，请重试' : rawMsg;
            wx.showToast({ title: safeMsg, icon: 'none' });
            reject(data || new Error(safeMsg));
          }
        },
        fail: err => {
          const msg = (err && err.errMsg) ? err.errMsg : '上传失败';
          wx.showToast({ title: msg.indexOf('auth') !== -1 ? '请先登录' : '上传失败', icon: 'none' });
          reject(err);
        },
      });
    });
  },

  /**
   * 预加载关键数据
   */
  preloadCriticalData() {
    console.log('[App] Preloading critical data...');

    // 预加载景点列表
    this.request({
      url: '/api/scenic-spots',
      method: 'GET',
      useCache: true,
      cacheKey: 'scenic_list_1',
    }).then(data => {
      console.log('[App] Preloaded scenic list:', data);
    }).catch(err => {
      console.error('[App] Failed to preload scenic list:', err);
    });

    // 预加载轮播图
    this.request({
      url: '/api/banners/active',
      method: 'GET',
      useCache: true,
      cacheKey: 'banners',
    }).then(data => {
      console.log('[App] Preloaded banners:', data);
    }).catch(err => {
      console.error('[App] Failed to preload banners:', err);
    });
  },

  /**
   * 同步离线数据
   */
  async syncOfflineData() {
    if (!this.globalData.token) {
      return;
    }

    console.log('[App] Syncing offline data...');

    try {
      // 同步离线操作队列
      const operations = offlineCache.getOfflineOperations();
      let didSyncOperations = false;
      if (operations.length > 0) {
        console.log('[App] Found', operations.length, 'offline operations to sync');
        didSyncOperations = true;
        for (const op of operations) {
          try {
            await this.syncOperation(op);
          } catch (error) {
            console.error('[App] Failed to sync operation:', error);
          }
        }
        offlineCache.clearOfflineOperations();
      }

      // 刷新缓存数据（静默，不打扰用户）
      await this.refreshCachedData();

      // 仅当本次有同步过离线操作时才提示，避免与上传失败等错误提示混淆
      if (didSyncOperations) {
        wx.showToast({
          title: '数据同步完成',
          icon: 'success',
          duration: 1500,
        });
      }
    } catch (error) {
      console.error('[App] Sync offline data error:', error);
    }
  },

  /**
   * 同步单个操作
   */
  syncOperation(operation) {
    return new Promise((resolve, reject) => {
      const { type, url, method, data } = operation;

      wx.request({
        url: `${this.globalData.baseUrl}${url}`,
        method: method || 'POST',
        data,
        header: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.globalData.token}`,
        },
        success: res => {
          if (res.data.code === 200) {
            console.log('[App] Synced operation:', type);
            resolve(res.data);
          } else {
            reject(res.data);
          }
        },
        fail: reject,
      });
    });
  },

  /**
   * 刷新缓存数据
   */
  async refreshCachedData() {
    console.log('[App] Refreshing cached data...');

    // 刷新景点列表
    try {
      const scenicList = await this.request({
        url: '/api/scenic-spots',
        method: 'GET',
      });
      offlineCache.setScenicList(scenicList);
    } catch (error) {
      console.error('[App] Failed to refresh scenic list:', error);
    }

    // 如果已登录，刷新足迹数据
    if (this.globalData.token) {
      try {
        const footprints = await this.request({
          url: '/api/behavior/footprint',
          method: 'GET',
          needAuth: true,
        });
        offlineCache.setFootprints(footprints);
      } catch (error) {
        console.error('[App] Failed to refresh footprints:', error);
      }
    }

    // 如果已登录，刷新优惠券
    if (this.globalData.token) {
      try {
        const coupons = await this.request({
          url: '/api/coupons/my',
          method: 'GET',
          needAuth: true,
        });
        offlineCache.setCoupons(coupons);
      } catch (error) {
        console.error('[App] Failed to refresh coupons:', error);
      }
    }
  },
});

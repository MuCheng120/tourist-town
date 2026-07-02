// 网络监听工具
class NetworkMonitor {
  constructor() {
    this.isConnected = true;
    this.networkType = 'unknown';
    this.listeners = [];
    this.offlineQueue = [];
  }

  /**
   * 初始化网络监听
   */
  init() {
    // 监听网络状态变化
    wx.onNetworkStatusChange(this.handleNetworkChange.bind(this));
    
    // 获取当前网络状态
    wx.getNetworkType({
      success: (res) => {
        this.networkType = res.networkType;
        this.isConnected = res.networkType !== 'none';
        console.log('[Network] Init network type:', this.networkType);
      }
    });

    // 监听应用启动和显示，检查网络恢复
    wx.onAppShow(this.handleAppShow.bind(this));
  }

  /**
   * 处理网络状态变化
   */
  handleNetworkChange(res) {
    const wasConnected = this.isConnected;
    this.isConnected = res.isConnected;
    this.networkType = res.networkType;

    console.log('[Network] Status changed:', {
      isConnected: this.isConnected,
      networkType: this.networkType,
      wasConnected: wasConnected
    });

    // 通知所有监听器
    this.notifyListeners();

    // 如果从离线恢复到在线，处理离线队列
    if (!wasConnected && this.isConnected) {
      console.log('[Network] Network recovered, processing offline queue...');
      this.processOfflineQueue();
    }
  }

  /**
   * 处理应用显示
   */
  handleAppShow() {
    wx.getNetworkType({
      success: (res) => {
        this.networkType = res.networkType;
        this.isConnected = res.networkType !== 'none';
        console.log('[Network] App show, network type:', this.networkType);
        this.notifyListeners();

        // 如果网络恢复，处理离线队列
        if (this.isConnected) {
          this.processOfflineQueue();
        }
      }
    });
  }

  /**
   * 添加网络状态监听器
   * @param {function} listener - 监听器函数 (isConnected, networkType) => {}
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
      // 立即通知当前状态
      listener(this.isConnected, this.networkType);
    }
  }

  /**
   * 移除网络状态监听器
   * @param {function} listener - 监听器函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.isConnected, this.networkType);
      } catch (error) {
        console.error('[Network] Listener error:', error);
      }
    });
  }

  /**
   * 检查是否在线
   */
  isOnline() {
    return this.isConnected;
  }

  /**
   * 检查是否离线
   */
  isOffline() {
    return !this.isConnected;
  }

  /**
   * 获取网络类型
   */
  getNetworkType() {
    return this.networkType;
  }

  /**
   * 检查是否为WiFi
   */
  isWiFi() {
    return this.networkType === 'wifi';
  }

  /**
   * 添加离线操作到队列
   * @param {object} operation - 操作对象 {type, handler, context}
   */
  addOfflineOperation(operation) {
    this.offlineQueue.push({
      ...operation,
      timestamp: Date.now()
    });
    console.log('[Network] Add offline operation, queue size:', this.offlineQueue.length);
  }

  /**
   * 处理离线队列
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log('[Network] Processing offline queue, size:', this.offlineQueue.length);

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    let success = 0;
    let failed = 0;

    for (const operation of queue) {
      try {
        if (typeof operation.handler === 'function') {
          await operation.handler(operation.context);
          success++;
        }
      } catch (error) {
        console.error('[Network] Process operation failed:', error);
        failed++;
        // 失败的操作重新加入队列
        this.offlineQueue.push(operation);
      }
    }

    console.log('[Network] Queue processed, success:', success, 'failed:', failed);

    // 如果还有失败的操作，延迟重试
    if (this.offlineQueue.length > 0) {
      setTimeout(() => {
        if (this.isConnected) {
          this.processOfflineQueue();
        }
      }, 5000);
    }
  }

  /**
   * 清空离线队列
   */
  clearOfflineQueue() {
    this.offlineQueue = [];
    console.log('[Network] Clear offline queue');
  }

  /**
   * 获取离线队列大小
   */
  getOfflineQueueSize() {
    return this.offlineQueue.length;
  }

  /**
   * 带网络检查的请求封装
   * @param {function} requestFn - 请求函数
   * @param {object} options - 选项 {useCache, cacheKey, cacheData}
   */
  async request(requestFn, options = {}) {
    const { useCache = false, cacheKey = null, cacheData = null } = options;

    // 如果在线，直接执行请求
    if (this.isConnected) {
      try {
        const result = await requestFn();
        return { success: true, data: result, fromCache: false };
      } catch (error) {
        // 如果请求失败且允许使用缓存，返回缓存数据
        if (useCache && cacheData) {
          console.log('[Network] Request failed, using cache');
          return { success: true, data: cacheData, fromCache: true };
        }
        throw error;
      }
    }

    // 如果离线
    if (useCache && cacheData) {
      console.log('[Network] Offline, using cache');
      return { success: true, data: cacheData, fromCache: true };
    }

    // 离线且无缓存，返回错误
    const error = new Error('网络不可用，请检查网络连接');
    error.isOffline = true;
    throw error;
  }

  /**
   * 显示网络状态提示
   */
  showNetworkTip() {
    if (this.isOffline()) {
      wx.showToast({
        title: '当前网络不可用',
        icon: 'none',
        duration: 2000
      });
    }
  }

  /**
   * 显示离线模式提示
   */
  showOfflineModeTip() {
    wx.showModal({
      title: '离线模式',
      content: '当前处于离线模式，部分功能可能不可用。已为您加载缓存数据。',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
}

// 创建单例
const networkMonitor = new NetworkMonitor();

module.exports = networkMonitor;

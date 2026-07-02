// components/offline-bar/offline-bar.js
const networkMonitor = require('../../utils/network-monitor');

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示
    show: {
      type: Boolean,
      value: false
    },
    // 提示文本
    text: {
      type: String,
      value: '当前网络不可用，正在使用离线模式'
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    isConnected: true,
    networkType: 'unknown',
    visible: false
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      this.initNetworkMonitor();
    },

    detached() {
      // 移除监听器（可选，如果需要的话）
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 初始化网络监听
     */
    initNetworkMonitor() {
      // 添加网络状态监听器
      networkMonitor.addListener((isConnected, networkType) => {
        this.setData({
          isConnected,
          networkType,
          visible: !isConnected
        });

        // 触发网络状态变化事件
        this.triggerEvent('networkchange', {
          isConnected,
          networkType
        });
      });

      // 初始检查
      this.setData({
        isConnected: networkMonitor.isOnline(),
        networkType: networkMonitor.getNetworkType(),
        visible: networkMonitor.isOffline()
      });
    },

    /**
     * 手动隐藏提示栏
     */
    hide() {
      this.setData({
        visible: false
      });
    },

    /**
     * 手动显示提示栏
     */
    show() {
      this.setData({
        visible: true
      });
    }
  }
});

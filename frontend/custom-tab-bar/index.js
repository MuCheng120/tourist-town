Component({
  data: {
    selected: 0,
    color: "#7A7E83",
    selectedColor: "#3cc51f",
    userRole: 'consumer', // consumer | merchant | admin
    showTabBar: true, // 是否显示TabBar
    list: [], // 动态列表
    // 游客端TabBar（唯一需要TabBar的角色）
    touristList: [
      {
        pagePath: "pages/index/index",
        icon: "wap-home-o",
        selectedIcon: "wap-home",
        text: "首页"
      },
      {
        pagePath: "pages/mall/index",
        icon: "shopping-cart-o",
        selectedIcon: "shopping-cart",
        text: "特产商城"
      },
      {
        pagePath: "pages/hotel/index",
        icon: "logistics",
        selectedIcon: "logistics",
        text: "酒店预订"
      },
      {
        pagePath: "pages/community/index",
        icon: "chat-o",
        selectedIcon: "chat",
        text: "社区"
      },
      {
        pagePath: "pages/user/index",
        icon: "user-o",
        selectedIcon: "user",
        text: "我的"
      }
    ]
  },

  lifetimes: {
    attached() {
      console.log('[TabBar] Component attached');
      this.updateTabBar();
    }
  },

  pageLifetimes: {
    show() {
      console.log('[TabBar] Page show');
      this.updateTabBar();
    }
  },

  methods: {
    /**
     * 根据用户角色更新TabBar
     * 只有游客端显示TabBar，商户端和管理端隐藏
     */
    updateTabBar() {
      try {
        const app = getApp();
        console.log('[TabBar] ========== Updating TabBar ==========');
        
        // 获取用户信息和token
        const token = app.globalData.token || wx.getStorageSync('token');
        const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
        
        console.log('[TabBar] Token exists:', !!token);
        console.log('[TabBar] User info:', userInfo);
        
        // 确定用户角色：未登录或游客都显示TabBar
        let role = 'consumer';
        if (userInfo && userInfo.role && (userInfo.role === 'merchant' || userInfo.role === 'admin')) {
          role = userInfo.role;
        }
        
        console.log('[TabBar] Final role:', role);
        
        // 只有游客端显示TabBar
        if (role === 'consumer') {
          const list = this.data.touristList;

          // 更新当前选中的Tab索引
          const pages = getCurrentPages();
          if (!pages || pages.length === 0) {
            console.warn('[TabBar] No pages in stack when updating TabBar');
            this.setData({
              userRole: role,
              list: list,
              selected: 0,
              showTabBar: true,
            });
            return;
          }

          const currentPage = pages[pages.length - 1];
          const currentRoute = currentPage && currentPage.route ? currentPage.route : '';
          console.log('[TabBar] Current route:', currentRoute);

          const selectedIndex = currentRoute
            ? list.findIndex(item => item.pagePath === currentRoute)
            : 0;
          console.log('[TabBar] Selected index:', selectedIndex);
          
          this.setData({
            userRole: role,
            list: list,
            selected: selectedIndex >= 0 ? selectedIndex : 0,
            showTabBar: true
          });
          
          console.log('[TabBar] Consumer TabBar set with', list.length, 'items');
        } else {
          // 商户端和管理端不显示TabBar
          console.log('[TabBar] Hiding TabBar for role:', role);
          this.setData({
            userRole: role,
            list: [],
            selected: 0,
            showTabBar: false
          });
        }
      } catch (error) {
        console.error('[TabBar] Update error:', error);
        // 出错时显示默认TabBar（游客端）
        this.setData({
          userRole: 'consumer',
          list: this.data.touristList,
          selected: 0,
          showTabBar: true
        });
      }
    },

    /**
     * 切换Tab
     */
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = '/' + data.path; // 添加前导斜杠

      console.log('[TabBar] Switch to:', url);
      
      wx.switchTab({
        url: url
      });
    }
  }
});

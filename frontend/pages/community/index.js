// pages/community/index.js
const app = getApp();

Page({
  data: {
    posts: [],
    activeTab: 'all',
    searchKeyword: '',
    loading: false,
    page: 1,
    hasMore: true,
    categoryMap: {
      scenery: '景点',
      food: '美食',
      accommodation: '住宿',
      guide: '综合',
    },
  },

  onLoad() {},

  onShow() {
    // 设置当前 tabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabBar();
    }
    // 每次显示都刷新列表，保证收藏数、点赞数等为最新（从详情返回或切换 tab 后）
    this.setData({ page: 1, hasMore: true });
    this.loadPosts();
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true });
    this.loadPosts().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMorePosts();
    }
  },

  /**
   * 加载攻略列表
   */
  async loadPosts() {
    this.setData({ loading: true });

    try {
      const result = await app.request({
        url: '/api/posts',
        method: 'GET',
        data: {
          page: 1,
          limit: 10,
          category: this.data.activeTab !== 'all' ? this.data.activeTab : '',
          keyword: this.data.searchKeyword,
        },
      });

      // 从返回对象中提取数组
      const posts = result.list || [];
      const total = result.total || 0;

      const processedPosts = posts.map(post => {
        const user = post.user || {};
        return {
          ...post,
          images: app.fullImageUrls(post.images || []),
          userAvatar: app.fullImageUrl(user.avatar) || '',
          userName: user.nickname || '匿名用户',
          categoryLabel: this.data.categoryMap[post.category] || '综合'
        };
      });

      this.setData({
        posts: processedPosts,
        page: 1,
        hasMore: total > this.data.page * 10,
      });
    } catch (error) {
      console.error('加载攻略失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 加载更多攻略
   */
  async loadMorePosts() {
    this.setData({ loading: true });

    try {
      const nextPage = this.data.page + 1;
      const result = await app.request({
        url: '/api/posts',
        method: 'GET',
        data: {
          page: nextPage,
          limit: 10,
          category: this.data.activeTab !== 'all' ? this.data.activeTab : '',
          keyword: this.data.searchKeyword,
        },
      });

      // 从返回对象中提取数组
      const newPosts = result.list || [];
      const total = result.total || 0;

      const processedNewPosts = newPosts.map(post => {
        const user = post.user || {};
        return {
          ...post,
          images: app.fullImageUrls(post.images || []),
          userAvatar: app.fullImageUrl(user.avatar) || '',
          userName: user.nickname || '匿名用户',
          categoryLabel: this.data.categoryMap[post.category] || '综合'
        };
      });

      this.setData({
        posts: [...this.data.posts, ...processedNewPosts],
        page: nextPage,
        hasMore: total > nextPage * 10,
      });
    } catch (error) {
      console.error('加载更多失败:', error);
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 切换分类标签
   * 默认「全部」下搜索后 activeTab 仍为 all，再次点「全部」若直接 return 则不会重新拉列表，用户看不到全量；此时应清空关键词并刷新
   */
  switchTab(e) {
    const { tab } = e.currentTarget.dataset;
    if (!tab) return;

    const isAll = tab === 'all';
    const sameTab = tab === this.data.activeTab;
    const keywordTrim = String(this.data.searchKeyword || '').trim();
    const hasKeyword = keywordTrim.length > 0;

    if (sameTab && !(isAll && hasKeyword)) return;

    const patch = { activeTab: tab, page: 1, hasMore: true };
    if (isAll && sameTab && hasKeyword) patch.searchKeyword = '';

    this.setData(patch, () => this.loadPosts());
  },

  /**
   * 搜索输入变化
   */
  onSearchChange(e) {
    this.setData({ searchKeyword: e.detail });
  },

  /**
   * 搜索
   */
  onSearch() {
    this.setData({
      page: 1,
      hasMore: true,
    });
    this.loadPosts();
  },

  /**
   * 导航到攻略详情
   */
  navigateToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/community/detail?id=${id}`,
    });
  },

  /**
   * 发布攻略（未登录时弹出登录弹窗）
   */
  publishPost() {
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/index' });
          }
        },
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/community/publish',
    });
  },
});

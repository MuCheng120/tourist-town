const app = getApp();

Page({
  data: {
    activeTab: 0,
    tabs: ['全部', '景点', '商品'],
    footprintList: [],
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
  },

  onLoad() {
    this.loadFootprint();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.setData({
      page: 1,
      footprintList: [],
      hasMore: true,
    });
    this.loadFootprint();
  },

  // 切换标签
  onTabChange(e) {
    const index = e.detail.index;
    this.setData({
      activeTab: index,
      page: 1,
      footprintList: [],
      hasMore: true,
    });
    this.loadFootprint();
  },

  // 加载足迹数据
  async loadFootprint() {
    if (this.data.loading || !this.data.hasMore) return;

    this.setData({ loading: true });

    try {
      const targetTypes = ['all', 'scenic', 'product'];
      const targetType = targetTypes[this.data.activeTab];

      const res = await app.request({
        url: '/api/behavior/footprint',
        method: 'GET',
        data: {
          target_type: targetType,
          page: this.data.page,
          pageSize: this.data.pageSize,
        },
      });

      // app.request 返回的是数据对象本身，约定为 { list, ... }
      const rawList = Array.isArray(res) ? res : (res.list || res.data || []);
      const list = rawList.map(item => ({ ...item, cover_image: app.fullImageUrl(item.cover_image) }));
      const footprintList = this.data.page === 1 ? list : [...this.data.footprintList, ...list];

      this.setData({
        footprintList,
        hasMore: list.length >= this.data.pageSize,
        page: this.data.page + 1,
      });
    } catch (error) {
      console.error('加载足迹失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      footprintList: [],
      hasMore: true,
    });
    this.loadFootprint().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 上拉加载更多
  onReachBottom() {
    this.loadFootprint();
  },

  // 跳转到详情页
  goToDetail(e) {
    const { type, id } = e.currentTarget.dataset;

    const urlMap = {
      scenic: `/pages/scenic/detail?id=${id}`,
      product: `/pages/product/detail?id=${id}`,
    };

    const url = urlMap[type];
    if (url) {
      wx.navigateTo({ url });
    }
  },

  // 获取类型名称
  getTypeName(type) {
    const typeMap = {
      scenic: '景点',
      route: '路线',
      product: '商品',
    };
    return typeMap[type] || type;
  },
});

// pages/favorite/index.js - 我的收藏（后端 user_favorites 表）
const app = getApp();

const TABS = [
  { key: 'hotel', label: '酒店' },
  { key: 'scenic', label: '景点' },
  { key: 'post', label: '攻略' },
  { key: 'product', label: '商品' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: 'hotel', // 默认显示攻略，进入即可看到收藏的攻略
    list: [],
    loading: false,
  },

  onShow() {
    this.loadFavorites(this.data.activeTab);
  },

  onTabChange(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key });
    // setData 异步，直接传 key 请求对应类型，避免拿到旧 activeTab
    this.loadFavorites(key);
  },

  loadFavorites(type) {
    if (!app.globalData.token) {
      this.setData({ list: [] });
      return;
    }
    const targetType = type !== undefined ? type : this.data.activeTab;
    this.setData({ loading: true });
    // GET 请求将参数拼到 URL，确保后端收到 target_type（攻略为 post）
    const query = `target_type=${encodeURIComponent(targetType)}&page=1&pageSize=100`;
    app.request({
      url: `/api/favorites?${query}`,
      method: 'GET',
      needAuth: true,
    }).then((res) => {
      const rawList = res && res.list ? res.list : [];
      const list = rawList.map(item => {
        const out = { ...item };
        if (item.cover_image) out.cover_image = app.fullImageUrl(item.cover_image);
        if (item.images && Array.isArray(item.images)) out.images = app.fullImageUrls(item.images);
        else if (item.images) out.images = app.fullImageUrls(Array.isArray(item.images) ? item.images : []);
        if (item.user && item.user.avatar) out.user = { ...item.user, avatar: app.fullImageUrl(item.user.avatar) };
        return out;
      });
      this.setData({ list, loading: false });
    }).catch(() => {
      this.setData({ loading: false, list: [] });
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || 'hotel';
    if (!id) return;
    if (type === 'post') {
      wx.navigateTo({ url: `/pages/community/detail?id=${id}` });
    } else if (type === 'product') {
      wx.navigateTo({ url: `/pages/product/detail?id=${id}` });
    } else if (type === 'scenic') {
      wx.navigateTo({ url: `/pages/scenic/detail?id=${id}` });
    } else {
      wx.navigateTo({ url: `/pages/hotel/detail?id=${id}` });
    }
  },
});

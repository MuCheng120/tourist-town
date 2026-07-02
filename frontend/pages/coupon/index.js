// 用户端 - 我的优惠券
const app = getApp();
const { formatExpiryDate } = require('../../utils/date');

Page({
  data: {
    tabs: ['可使用', '已使用', '已过期'],
    activeTab: 0,
    couponList: [],
    loading: false,
    // 与后端 UserCoupon.status 一致：unused / used / expired
    statusMap: {
      0: 'unused',
      1: 'used',
      2: 'expired',
    },
  },

  onLoad() {
    this.loadCoupons();
  },

  onShow() {
    // 从其他页面返回时刷新列表
    this.loadCoupons();
  },

  // 切换标签（普通 view 点击用 dataset，不是 detail）
  onTabChange(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    if (isNaN(index) || index === this.data.activeTab) return;
    this.setData({ activeTab: index });
    this.loadCoupons();
  },

  // 加载优惠券列表
  async loadCoupons() {
    const { activeTab, statusMap } = this.data;
    const status = statusMap[activeTab];

    this.setData({ loading: true });

    try {
      const result = await app.request({
        url: '/api/coupons/my',
        data: { status },
        needAuth: true,
      });

      const rawList = result.list || [];
      const couponList = rawList.map(item => {
        const coupon = item.coupon || item;
        return {
          ...item,
          coupon: {
            ...coupon,
            expiry_date_display: formatExpiryDate(coupon.expiry_date),
          },
        };
      });
      this.setData({
        couponList,
        loading: false,
      });
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    }
  },

  // 去逛逛（空状态时）
  goMall() {
    wx.switchTab({ url: '/pages/mall/index' });
  },

  // 去使用
  goUse(e) {
    const { coupon } = e.currentTarget.dataset;
    
    // 根据优惠券类型跳转到对应页面
    if (coupon.type === 'shop') {
      // 店铺券，跳转到该商家的商品列表
      wx.navigateTo({
        url: `/pages/mall/index?merchant_id=${coupon.coupon.merchant_id}`,
      });
    } else if (coupon.type === 'platform') {
      // 平台券，跳转到商城首页
      wx.switchTab({
        url: '/pages/mall/index',
      });
    } else {
      wx.showToast({
        title: '暂无适用场景',
        icon: 'none',
      });
    }
  },

  // 查看详情
  viewDetail(e) {
    const { coupon } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '优惠券详情',
      content: `优惠券：${coupon.coupon.title}\n优惠金额：¥${coupon.coupon.value}\n使用条件：${coupon.coupon.min_spend > 0 ? '满¥' + coupon.coupon.min_spend : '无门槛'}\n有效期至：${coupon.coupon.expiry_date_display || formatExpiryDate(coupon.coupon.expiry_date) || coupon.coupon.expiry_date}`,
      showCancel: false,
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadCoupons().then(() => {
      wx.stopPullDownRefresh();
    });
  },
});

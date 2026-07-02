// pages/hotel/index.js - 顶部搜索框样式，左侧点击弹窗选位置/日期/人数
const app = getApp();
const { formatDate, formatDateLabel } = require('../../utils/date');

Page({
  data: {
    hotels: [],
    loading: false,
    // 默认按距离排序
    orderBy: 'distance',
    order: 'asc',
    keyword: '',
    // 顶部左侧展示
    locationText: '我的位置',
    checkInStr: '',
    checkOutStr: '',
    roomCount: 1,
    guestCount: 1,
    adultCount: 1,
    childCount: 0,
    checkInDate: '',
    checkOutDate: '',
    checkInLabel: '',
    checkOutLabel: '',
    nightCount: 1,
    minDateStr: '',
    maxDateStr: '',
    // 弹窗
    showCriteriaPopup: false,
    showRoomGuestPopup: false,
    childAges: [],
  },

  async resolveCityFromLocation(latitude, longitude) {
    try {
      const res = await app.request({
        url: '/api/location/reverse-geocode',
        method: 'GET',
        data: { latitude, longitude },
      });
      const data = res && res.data ? res.data : res;
      const city = data && data.city ? String(data.city) : '';
      if (city) return city;
    } catch (e) {
      console.log('获取城市名称失败:', e.message);
    }
    return '';
  },

  onLoad() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minStr = formatDate(today);
    const max = new Date(today);
    max.setFullYear(max.getFullYear() + 1);
    const maxStr = formatDate(max);
    const checkIn = minStr;
    const checkOut = formatDate(tomorrow);
    this.setData({
      checkInDate: checkIn,
      checkOutDate: checkOut,
      checkInStr: checkIn.slice(5).replace('-', '-'),
      checkOutStr: checkOut.slice(5).replace('-', '-'),
      checkInLabel: formatDateLabel(checkIn),
      checkOutLabel: formatDateLabel(checkOut),
      nightCount: 1,
      minDateStr: minStr,
      maxDateStr: maxStr,
      guestCount: 1,
    });
    
    // 页面加载时尝试获取用户位置，以便默认的距离排序能正常工作
    wx.getLocation({
      type: 'gcj02',
      success: async (res) => {
        app.globalData.hotelSearchLocation = { latitude: res.latitude, longitude: res.longitude };
        this.setData({ locationText: '定位中...' });
        // 尝试获取城市名称，但不影响距离排序
        try {
          const city = await this.resolveCityFromLocation(res.latitude, res.longitude);
          this.setData({ locationText: city || '已定位' });
        } catch (e) {
          // 忽略获取城市名称的错误
          this.setData({ locationText: '已定位' });
        }
        this.loadHotels();
      },
      fail: () => {
        // 获取位置失败时，仍然加载酒店列表（会使用默认排序）
        this.loadHotels();
      },
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().updateTabBar();
    }
    const result = app.globalData.hotelCalendarResult;
    if (result) {
      this.setData({
        checkInDate: result.checkInDate,
        checkOutDate: result.checkOutDate,
        checkInStr: result.checkInStr,
        checkOutStr: result.checkOutStr,
        checkInLabel: result.checkInLabel,
        checkOutLabel: result.checkOutLabel,
        nightCount: result.nightCount,
      });
      delete app.globalData.hotelCalendarResult;
    }
    const c = app.globalData.hotelSearchCriteria;
    if (c) {
      const patch = {};
      if (c.checkInDate && c.checkOutDate) {
        patch.checkInDate = c.checkInDate;
        patch.checkOutDate = c.checkOutDate;
        patch.checkInStr = c.checkInDate.slice(5).replace('-', '-');
        patch.checkOutStr = c.checkOutDate.slice(5).replace('-', '-');
        patch.checkInLabel = formatDateLabel(c.checkInDate);
        patch.checkOutLabel = formatDateLabel(c.checkOutDate);
        const start = new Date(c.checkInDate);
        const end = new Date(c.checkOutDate);
        patch.nightCount = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
      }
      if (typeof c.roomCount === 'number') patch.roomCount = c.roomCount;
      if (typeof c.adultCount === 'number') patch.adultCount = c.adultCount;
      if (typeof c.childCount === 'number') patch.childCount = c.childCount;
      if (Array.isArray(c.childAges)) patch.childAges = c.childAges;
      if (Object.keys(patch).length) {
        const ac = patch.adultCount != null ? patch.adultCount : this.data.adultCount;
        const cc = patch.childCount != null ? patch.childCount : this.data.childCount;
        patch.guestCount = ac + cc;
        this.setData(patch);
      }
    }
  },

  openCriteriaPopup() {
    this.setData({ showCriteriaPopup: true });
  },

  onSearchAreaTap() {
    // 点击右侧搜索区不打开条件弹窗，仅使用搜索框
  },

  closeCriteriaPopup() {
    this.setData({ showCriteriaPopup: false });
  },

  onGetLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: async (res) => {
        const { latitude, longitude } = res;
        this.setData({
          locationText: '定位中...',
        });
        app.globalData.hotelSearchLocation = { latitude, longitude };
        const city = await this.resolveCityFromLocation(latitude, longitude);
        this.setData({ locationText: city || '已定位' });
        wx.showToast({ title: city ? `当前：${city}` : '已获取位置', icon: 'success' });
        if (this.data.orderBy === 'distance') {
          this.loadHotels();
        }
      },
      fail: () => {
        wx.showToast({ title: '获取位置失败', icon: 'none' });
      },
    });
  },

  openDatePicker() {
    this.setData({ showCriteriaPopup: false });
    const { checkInDate, checkOutDate } = this.data;
    wx.navigateTo({
      url: `/pages/hotel/calendar?checkIn=${checkInDate || ''}&checkOut=${checkOutDate || ''}`,
    });
  },

  openRoomGuestPopup() {
    this.setData({ showRoomGuestPopup: true });
  },

  closeRoomGuestPopup() {
    this.setData({ showRoomGuestPopup: false });
  },

  onRoomGuestPopupConfirm(e) {
    const d = e.detail;
    if (!d) return;
    const childAges = Array.isArray(d.childAges) ? d.childAges : [];
    const prev = app.globalData.hotelSearchCriteria || {};
    app.globalData.hotelSearchCriteria = {
      ...prev,
      checkInDate: this.data.checkInDate,
      checkOutDate: this.data.checkOutDate,
      roomCount: d.roomCount,
      adultCount: d.adultCount,
      childCount: d.childCount,
      childAges,
    };
    this.setData({
      showRoomGuestPopup: false,
      roomCount: d.roomCount,
      adultCount: d.adultCount,
      childCount: d.childCount,
      childAges,
      guestCount: d.guestCount,
    });
  },

  confirmCriteria() {
    this.setData({
      showCriteriaPopup: false,
      checkInStr: this.data.checkInDate ? this.data.checkInDate.slice(5).replace('-', '-') : this.data.checkInStr,
      checkOutStr: this.data.checkOutDate ? this.data.checkOutDate.slice(5).replace('-', '-') : this.data.checkOutStr,
      guestCount: this.data.adultCount + this.data.childCount,
    });
  },

  onSearchChange(e) {
    let keyword = '';
    if (typeof e.detail === 'string') {
      keyword = e.detail;
    } else if (e.detail && typeof e.detail.value === 'string') {
      keyword = e.detail.value;
    } else if (typeof e.value === 'string') {
      keyword = e.value;
    }
    this.setData({ keyword });
  },

  onSearch() {
    this.loadHotels();
  },

  onSortChange(e) {
    const { orderBy, orderby, order: orderParam } = e.currentTarget.dataset || {};
    const orderByParam = orderBy || orderby;
    if (!orderByParam) return;

    // 价格：同一个按钮点击切换升/降序
    if (orderByParam === 'price') {
      let nextOrder = 'asc';
      if (this.data.orderBy === 'price') {
        nextOrder = this.data.order === 'asc' ? 'desc' : 'asc';
      } else if (orderParam) {
        nextOrder = orderParam;
      }
      if (this.data.orderBy === 'price' && this.data.order === nextOrder) return;
      this.setData({ orderBy: 'price', order: nextOrder });
      this.loadHotels();
      return;
    }

    // 距离排序：点击当前已选排序项则切换 asc <-> desc
    if (orderByParam === 'distance') {
      const loc = app.globalData.hotelSearchLocation;
      if (!loc || loc.latitude == null || loc.longitude == null) {
        wx.getLocation({
          type: 'gcj02',
          success: async (res) => {
            app.globalData.hotelSearchLocation = { latitude: res.latitude, longitude: res.longitude };
            this.setData({ locationText: '定位中...' });
            // 尝试获取城市名称，但不影响距离排序
            try {
              const city = await this.resolveCityFromLocation(res.latitude, res.longitude);
              this.setData({ locationText: city || '已定位' });
            } catch (e) {
              // 忽略获取城市名称的错误，继续执行距离排序
              this.setData({ locationText: '已定位' });
            }
            this.setData({
              orderBy: 'distance',
              order: orderParam || 'asc',
            });
            this.loadHotels();
          },
          fail: () => {
            wx.showToast({ title: '需要位置权限才能按距离排序', icon: 'none' });
          },
        });
        return;
      }
      // 如果已经有位置信息，支持切换排序方向
      if (this.data.orderBy === 'distance') {
        const nextOrder = (this.data.order === 'asc') ? 'desc' : 'asc';
        this.setData({ orderBy: 'distance', order: nextOrder });
        this.loadHotels();
        return;
      }
      // 首次点击距离排序，使用默认排序方向
      this.setData({ orderBy: 'distance', order: orderParam || 'asc' });
      this.loadHotels();
      return;
    }

    // 评分排序：点击当前已选排序项则切换 asc <-> desc
    if (orderByParam === 'rating') {
      if (this.data.orderBy === 'rating') {
        const nextOrder = (this.data.order === 'asc') ? 'desc' : 'asc';
        this.setData({ orderBy: 'rating', order: nextOrder });
        this.loadHotels();
        return;
      }
      this.setData({ orderBy: 'rating', order: orderParam || 'desc' });
      this.loadHotels();
      return;
    }

    this.setData({ orderBy: orderByParam, order: orderParam || 'asc' });
    this.loadHotels();
  },

  async loadHotels() {
    const { orderBy, order, keyword } = this.data;
    const loc = app.globalData.hotelSearchLocation;
    const data = { orderBy, order };
    if (orderBy === 'distance' && loc && loc.latitude != null && loc.longitude != null) {
      data.latitude = loc.latitude;
      data.longitude = loc.longitude;
    }
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/api/hotels',
        method: 'GET',
        data,
      });
      const list = Array.isArray(res) ? res : (res && res.list ? res.list : []);
      const hotels = list.map(h => ({
        ...h,
        cover_image: app.fullImageUrl(h.cover_image),
        favorite_count_display: (h.favorite_count > 9999) ? ((h.favorite_count / 10000).toFixed(1) + '万') : String(h.favorite_count || 0),
        comment_count_display: (h.comment_count > 9999) ? ((h.comment_count / 10000).toFixed(1) + '万') : String(h.comment_count || 0),
        rating_display: (h.rating != null && Number(h.rating) > 0) ? (Math.round(Number(h.rating) * 10) / 10).toFixed(1) : '',
      })).filter(h => {
        const kw = (keyword || '').trim().toLowerCase();
        if (!kw) return true;
        const tagText = Array.isArray(h.tags) ? h.tags.map(t => t && t.name ? t.name : '').join(' ') : '';
        const haystack = `${h.name || ''} ${h.address || ''} ${h.introduction || ''} ${tagText}`.toLowerCase();
        return haystack.includes(kw);
      });
      this.setData({ hotels });
    } catch (error) {
      console.error('加载酒店列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const { checkInDate, checkOutDate, roomCount, adultCount, childCount, childAges } = this.data;
    app.globalData.hotelSearchCriteria = { checkInDate, checkOutDate, roomCount, adultCount, childCount, childAges };
    wx.navigateTo({
      url: `/pages/hotel/detail?id=${id}`,
    });
  },
});

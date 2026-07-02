// pages/hotel/detail.js - 酒店详情：酒店信息 + 日期选择 + 该酒店房型列表
const app = getApp();
const { formatDate, formatTime, stayNightCalendarKeys, normalizeStockDateKey } = require('../../utils/date');
const { hotelRoomAndChildTotal } = require('../../utils/hotel-child-price');

/** 有儿童时：名称含家庭/亲子等优先，其次优先 max_occupancy 满足总人数的房型；无儿童不调整顺序 */
function sortRoomTypesForChildren(roomTypes, adultCount, childCount) {
  const cc = Number(childCount) || 0;
  if (cc <= 0 || !Array.isArray(roomTypes) || roomTypes.length < 2) return roomTypes;
  const ac = Number(adultCount) || 0;
  const guestTotal = Math.max(1, ac + cc);
  const familyRe = /家庭|亲子|儿童/;
  const wrapped = roomTypes.map((r, index) => {
    const familyHit = familyRe.test(String(r.name || '')) ? 1 : 0;
    const maxOcc = parseInt(r.max_occupancy, 10);
    const fits = !Number.isNaN(maxOcc) && maxOcc >= guestTotal ? 1 : 0;
    return { r, index, familyHit, fits };
  });
  wrapped.sort((a, b) => {
    if (b.familyHit !== a.familyHit) return b.familyHit - a.familyHit;
    if (b.fits !== a.fits) return b.fits - a.fits;
    return a.index - b.index;
  });
  return wrapped.map(x => x.r);
}

Page({
  data: {
    hotelId: null,
    hotel: null,
    headerCover: '',
    headerCoverFallback: '',
    isFavorited: false,
    roomTypes: [],
    activeGalleryTab: 'cover',
    reviewQuote: '',
    reviewOverallText: '',
    reviewDimItems: [],
    /** 住客点评区：有文字内容的评价列表（与 loadFirstReview 同一次请求） */
    guestReviewList: [],
    checkInDate: '',
    checkOutDate: '',
    checkInDateObj: null,
    checkOutDateObj: null,
    checkInShortLabel: '今天',
    checkOutShortLabel: '明天',
    checkInDisplay: '',
    checkOutDisplay: '',
    nightCount: 1,
    roomCount: 1,
    adultCount: 1,
    childCount: 0,
    childAges: [],
    guestCount: 1,
    loading: false,
    showRangeCalendarPopup: false,
    showRoomGuestPopup: false,
  },

  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const criteria = app.globalData.hotelSearchCriteria;
    let checkInStr = formatDate(today);
    let checkOutStr = formatDate(tomorrow);
    let nightCount = 1;
    if (criteria && criteria.checkInDate && criteria.checkOutDate) {
      checkInStr = criteria.checkInDate;
      checkOutStr = criteria.checkOutDate;
      const start = new Date(checkInStr);
      const end = new Date(checkOutStr);
      nightCount = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
    }
    const checkInObj = new Date(checkInStr);
    const checkOutObj = new Date(checkOutStr);
    const roomCount = (criteria && criteria.roomCount) || 1;
    const adultCount = (criteria && criteria.adultCount) || 1;
    const childCount = (criteria && criteria.childCount) || 0;
    const childAges = (criteria && Array.isArray(criteria.childAges)) ? criteria.childAges : [];
    const guestCount = adultCount + childCount;

    this.setData({
      hotelId: id,
      checkInDate: checkInStr,
      checkOutDate: checkOutStr,
      checkInDateObj: checkInObj,
      checkOutDateObj: checkOutObj,
      nightCount,
      roomCount,
      adultCount,
      childCount,
      childAges,
      guestCount,
      checkInShortLabel: this._shortDateLabel(checkInObj),
      checkOutShortLabel: this._shortDateLabel(checkOutObj),
      checkInDisplay: this._displayDate(checkInObj),
      checkOutDisplay: this._displayDate(checkOutObj),
    });

    this.loadHotelDetail();
    // 勿依赖 setData 后立即读 this.data：部分基础库下仍为旧值，导致未传 hotel_id/check_in 而列表无库存
    this.loadRoomTypes({
      hotelId: id,
      checkInDate: checkInStr,
      checkOutDate: checkOutStr,
      adultCount,
      childCount,
    });
    this.syncFavoritedState();
  },

  onShow() {
    this.syncFavoritedState();
    const c = app.globalData.hotelSearchCriteria;
    if (!c) return;
    const patch = {};
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
  },

  onNavBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/hotel/index' });
  },

  syncFavoritedState() {
    const id = this.data.hotelId;
    if (!id) return;
    if (!app.globalData.token) {
      this.setData({ isFavorited: false });
      return;
    }
    app.request({
      url: '/api/favorites/check',
      method: 'GET',
      data: { target_type: 'hotel', target_id: id },
      needAuth: true,
    }).then(res => {
      this.setData({ isFavorited: res.favorited === true });
    }).catch(() => {
      this.setData({ isFavorited: false });
    });
  },

  toggleFavorite() {
    const id = Number(this.data.hotelId);
    if (!id) return;
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录后收藏',
        confirmText: '去登录',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }); },
      });
      return;
    }
    const isFavorited = this.data.isFavorited;
    if (isFavorited) {
      app.request({
        url: `/api/favorites/hotel/${id}`,
        method: 'DELETE',
        needAuth: true,
      }).then(() => {
        wx.showToast({ title: '已取消收藏', icon: 'none' });
        this.setData({ isFavorited: false });
      }).catch(() => wx.showToast({ title: '取消失败', icon: 'none' }));
    } else {
      app.request({
        url: '/api/favorites',
        method: 'POST',
        needAuth: true,
        data: { target_type: 'hotel', target_id: id },
      }).then(() => {
        wx.showToast({ title: '已收藏', icon: 'success' });
        this.setData({ isFavorited: true });
      }).catch(() => wx.showToast({ title: '收藏失败', icon: 'none' }));
    }
  },

  async loadHotelDetail() {
    try {
      const hotel = await app.request({
        url: `/api/hotels/${this.data.hotelId}`,
        method: 'GET',
      });
      const hotelDisplay = hotel ? { ...hotel, cover_image: app.fullImageUrl(hotel.cover_image) } : {};
      const ratingNum = Number(hotelDisplay.rating) || 0;
      hotelDisplay.rating_label = this.getRatingLabel(ratingNum);
      hotelDisplay.rating_has_value = ratingNum > 0;
      hotelDisplay.tags = this.decorateHotelTags(hotelDisplay.tags);
      const nextCover = hotelDisplay.cover_image || this.data.headerCoverFallback || '';
      const dim = hotelDisplay.review_dimension_avg || {};
      const fmtDim = v => {
        if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
        return Number(v).toFixed(1);
      };
      const reviewDimItems = [
        { key: 'hygiene', name: '卫生', value: fmtDim(dim.hygiene) },
        { key: 'environment', name: '环境', value: fmtDim(dim.environment) },
        { key: 'service', name: '服务', value: fmtDim(dim.service) },
        { key: 'facility', name: '设施', value: fmtDim(dim.facility) },
      ];
      const reviewOverallText = ratingNum > 0 ? ratingNum.toFixed(1) : '—';
      this.setData({
        hotel: hotelDisplay,
        headerCover: nextCover,
        reviewDimItems,
        reviewOverallText,
      });
      this.loadFirstReview();
    } catch (error) {
      console.error('加载酒店详情失败:', error);
    }
  },

  getRatingLabel(score) {
    const n = Number(score) || 0;
    if (n >= 4.8) return '超棒';
    if (n >= 4.5) return '很好';
    if (n >= 4.0) return '不错';
    if (n > 0) return '一般';
    return '暂无评分';
  },

  decorateHotelTags(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.map(tag => {
      const name = tag && tag.name ? String(tag.name) : '';
      return {
        ...tag,
        icon_name: this.getTagIconName(name),
      };
    });
  },

  getTagIconName(tagName) {
    const n = (tagName || '').trim();
    if (!n) return 'passed';
    if (n.includes('前台')) return 'hotel-o';
    if (n.includes('入住')) return 'underway-o';
    if (n.includes('健身')) return 'fire-o';
    if (n.includes('洗衣')) return 'after-sale';
    if (n.includes('叫醒')) return 'clock-o';
    if (n.includes('停车')) return 'logistics';
    if (n.includes('早餐')) return 'shop-o';
    if (n.includes('泳池')) return 'photo-o';
    if (n.includes('接送')) return 'location-o';
    if (n.includes('会议')) return 'notes-o';
    if (n.includes('亲子')) return 'friends-o';
    if (n.includes('温泉')) return 'fire-o';
    if (n.includes('WiFi') || n.includes('wifi')) return 'points';
    return 'passed';
  },

  async loadFirstReview() {
    const id = this.data.hotelId;
    if (!id) return;
    try {
      const res = await app.request({
        url: `/api/hotels/${id}/comments`,
        method: 'GET',
        // 拉取一批：顶部摘要用最高分一条；住客点评区展示列表
        data: { page: 1, pageSize: 30 },
      });
      const list = (res && res.list) ? res.list : [];
      const withContent = list.filter(item => item && item.content && String(item.content).trim());
      withContent.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
      const quote = withContent.length ? String(withContent[0].content).trim() : '';
      const guestReviewList = list
        .filter(item => item && String(item.content || '').trim())
        .slice(0, 8)
        .map(item => ({
          id: item.id,
          content: String(item.content).trim(),
          nickname: (item.user && item.user.nickname) ? item.user.nickname : '匿名用户',
          avatarUrl: item.user && item.user.avatar ? app.fullImageUrl(item.user.avatar) : '',
          scoreText: item.score != null && Number(item.score) > 0 ? Number(item.score).toFixed(1) : '',
          timeText: formatTime(item.created_at || item.createdAt) || '',
        }));
      this.setData({ reviewQuote: quote, guestReviewList });
    } catch (e) {
      this.setData({ reviewQuote: '', guestReviewList: [] });
    }
  },

  _shortDateLabel(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    if (d.getTime() === today.getTime()) return '今天';
    if (d.getTime() === tomorrow.getTime()) return '明天';
    if (d.getTime() === dayAfterTomorrow.getTime()) return '后天';
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekNames[d.getDay()];
  },

  _displayDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  _updateDateLabels() {
    const { checkInDateObj, checkOutDateObj } = this.data;
    if (!checkInDateObj || !checkOutDateObj) return;
    this.setData({
      checkInShortLabel: this._shortDateLabel(checkInDateObj),
      checkOutShortLabel: this._shortDateLabel(checkOutDateObj),
      checkInDisplay: this._displayDate(checkInDateObj),
      checkOutDisplay: this._displayDate(checkOutDateObj),
    });
  },

  switchGalleryTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'review') this.goComments();
    else if (tab === 'album') wx.showToast({ title: '暂无更多相册', icon: 'none' });
    else this.setData({ activeGalleryTab: tab });
  },

  openMap() {
    const { hotel } = this.data;
    if (!hotel || (hotel.latitude == null && hotel.longitude == null)) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: Number(hotel.latitude),
      longitude: Number(hotel.longitude),
      name: hotel.name || '酒店',
      address: hotel.address || '',
    });
  },

  goComments() {
    this.goGuestReviewsAnchor();
  },

  goGuestReviewsAnchor() {
    wx.createSelectorQuery()
      .select('#guest-review-panel')
      .boundingClientRect()
      .selectViewport()
      .scrollOffset()
      .exec(res => {
        const rect = res[0];
        const scroll = res[1];
        if (!rect || !scroll) return;
        const top = rect.top + scroll.scrollTop - 12;
        wx.pageScrollTo({ scrollTop: Math.max(0, top), duration: 280 });
      });
  },

  goFacilityPolicy() {
    const id = this.data.hotelId;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/hotel/facility-policy?id=${id}&target=policies`,
    });
  },

  openRoomGuestPicker() {
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
    const { hotelId, checkInDate, checkOutDate } = this.data;
    this.setData({
      showRoomGuestPopup: false,
      roomCount: d.roomCount,
      adultCount: d.adultCount,
      childCount: d.childCount,
      childAges,
      guestCount: d.guestCount,
    });
    this.loadRoomTypes({
      hotelId,
      checkInDate,
      checkOutDate,
      adultCount: d.adultCount,
      childCount: d.childCount,
    });
  },

  calculateNightCount(checkIn, checkOut) {
    const diff = checkOut.getTime() - checkIn.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  },

  async loadRoomTypes(override) {
    const hotelId = (override && override.hotelId != null) ? override.hotelId : this.data.hotelId;
    const checkInDate = (override && override.checkInDate) ? override.checkInDate : this.data.checkInDate;
    const checkOutDate = (override && override.checkOutDate) ? override.checkOutDate : this.data.checkOutDate;
    const adultCount = (override && override.adultCount != null) ? override.adultCount : (this.data.adultCount || 0);
    const childCount = (override && override.childCount != null) ? override.childCount : (this.data.childCount || 0);
    if (!hotelId || !checkInDate || !checkOutDate) return;

    this.setData({ loading: true });

    try {
      const result = await app.request({
        url: '/api/room-types',
        method: 'GET',
        data: {
          hotel_id: hotelId,
          check_in: checkInDate,
          check_out: checkOutDate,
          page: 1,
          pageSize: 50,
        },
      });

      const list = Array.isArray(result.list) ? result.list : [];
      const roomTypes = list.map(room => {
        let images = room.images;
        if (typeof images === 'string') {
          try {
            images = JSON.parse(images || '[]');
          } catch (e) {
            images = [];
          }
        }
        const imagesArr = Array.isArray(images) ? images : [];
        let featuresArr = room.amenities;
        if (typeof featuresArr === 'string') {
          try {
            featuresArr = JSON.parse(featuresArr || '[]');
          } catch (e) {
            featuresArr = [];
          }
        }
        return {
          ...room,
          images: app.fullImageUrls(imagesArr),
          features: Array.isArray(featuresArr) ? featuresArr : [],
          available: this.checkRoomStock(room, checkInDate, checkOutDate),
        };
      });

      const sortedRoomTypes = sortRoomTypesForChildren(roomTypes, adultCount, childCount);

      const firstRoomCover = sortedRoomTypes.length && sortedRoomTypes[0].images && sortedRoomTypes[0].images[0]
        ? sortedRoomTypes[0].images[0]
        : '';
      this.setData({
        roomTypes: sortedRoomTypes,
        headerCoverFallback: firstRoomCover || '',
        headerCover: this.data.headerCover || firstRoomCover || '',
      });
    } catch (error) {
      console.error('加载房型失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  onHeaderImageLoad(e) {
    // no-op: 保留回调用于必要时快速调试
  },

  onHeaderImageError(e) {
    console.error('[hotel detail] 顶部封面加载失败:', e && e.detail, this.data.headerCover);
    // 若酒店封面加载失败，尝试回退到首个房型图；仍失败则显示占位
    const fallback = this.data.headerCoverFallback || '';
    if (fallback && fallback !== this.data.headerCover) {
      this.setData({
        headerCover: fallback,
      });
      return;
    }
    this.setData({
      headerCover: '',
    });
  },

  checkRoomStock(room, checkInOverride, checkOutOverride) {
    if (!room.stocks || room.stocks.length === 0) return false;
    const checkInDate = checkInOverride != null && checkInOverride !== '' ? checkInOverride : this.data.checkInDate;
    const checkOutDate = checkOutOverride != null && checkOutOverride !== '' ? checkOutOverride : this.data.checkOutDate;
    if (!checkInDate || !checkOutDate) return false;

    const expectedDates = stayNightCalendarKeys(checkInDate, checkOutDate);
    if (expectedDates.length === 0) return false;

    const stockMap = {};
    room.stocks.forEach(s => {
      const d = normalizeStockDateKey(s.date);
      if (!d) return;
      stockMap[d] = Number(s.remained_count) || 0;
    });

    return expectedDates.every(d => stockMap[d] > 0);
  },

  canBook(room) {
    return !!(room && room.available);
  },

  openRangeCalendarPopup() {
    this.setData({ showRangeCalendarPopup: true });
  },

  onCloseRangeCalendarPopup() {
    this.setData({ showRangeCalendarPopup: false });
  },

  onRangeCalendarConfirm(e) {
    const d = e.detail;
    if (!d || !d.checkInDate || !d.checkOutDate) return;
    const checkInObj = new Date(d.checkInDate);
    const checkOutObj = new Date(d.checkOutDate);
    const criteria = app.globalData.hotelSearchCriteria || {};
    app.globalData.hotelSearchCriteria = {
      ...criteria,
      checkInDate: d.checkInDate,
      checkOutDate: d.checkOutDate,
    };
    this.setData({
      checkInDate: d.checkInDate,
      checkOutDate: d.checkOutDate,
      checkInDateObj: checkInObj,
      checkOutDateObj: checkOutObj,
      nightCount: d.nightCount || this.calculateNightCount(checkInObj, checkOutObj),
      showRangeCalendarPopup: false,
      checkInShortLabel: this._shortDateLabel(checkInObj),
      checkOutShortLabel: this._shortDateLabel(checkOutObj),
      checkInDisplay: this._displayDate(checkInObj),
      checkOutDisplay: this._displayDate(checkOutObj),
    });
    this.loadRoomTypes();
  },

  goRoomDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const hotelId = this.data.hotelId;
    wx.navigateTo({
      url: `/pages/hotel/room-detail?id=${id}&hotelId=${hotelId || ''}`,
    });
  },

  handleBook(e) {
    const id = e.currentTarget.dataset.id;
    let room = id != null && this.data.roomTypes && this.data.roomTypes.length
      ? this.data.roomTypes.find(r => r.id == id)
      : null;
    if (!room) room = e.currentTarget.dataset.room;
    if (!room || !room.id) return;
    if (!this.canBook(room)) {
      wx.showToast({ title: '该房型已满房', icon: 'none' });
      return;
    }

    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }

    const ac = this.data.adultCount || 1;
    const cc = this.data.childCount || 0;
    const ages = this.data.childAges || [];
    const { total: totalPrice } = hotelRoomAndChildTotal(room.price, this.data.nightCount, cc);
    const params = encodeURIComponent(JSON.stringify({
      room_type_id: room.id,
      room_name: room.name,
      check_in: this.data.checkInDate,
      check_out: this.data.checkOutDate,
      night_count: this.data.nightCount,
      price: room.price,
      total_price: totalPrice,
      adult_count: ac,
      child_count: cc,
      child_ages: ages,
      merchant_id: room.merchant_id != null ? room.merchant_id : undefined,
    }));

    wx.navigateTo({
      url: `/pages/hotel/confirm?data=${params}`,
    });
  },
});

const app = getApp();
const { formatDate } = require('../../utils/date');

// 默认票种（后端未配置 ticket_types 时使用）
function defaultTicketTypes(price) {
  const p = parseFloat(price) || 0;
  return [
    { type: 'adult', name: '成人票', price: p, remark: '' },
    { type: 'child', name: '儿童票', price: (p * 0.5).toFixed(2), remark: '6-18周岁' },
    { type: 'student', name: '学生票', price: (p * 0.6).toFixed(2), remark: '需凭学生证检票' },
  ];
}

function getOpenStatusText(status) {
  const map = { open: '开放中', closed: '暂停开放', limit: '限流中' };
  return map[status] || '开放中';
}

Page({
  data: {
    spotId: null,
    spot: null,
    contactPhone: '',
    isFavorited: false,
    images: [],
    currentImageIndex: 0,
    mapMarkers: [],
    // 展示用
    openStatusText: '开放中',
    stopTimesText: '',
    displayAddress: '',
    // Tab
    activeTab: 'book',
    // 预订
    showDatePicker: false,
    playDate: null,
    playDateStr: '',
    minDate: null,
    maxDate: null,
    ticketTypeList: [],
    selectedTicketType: 'adult',
    selectedTicketPrice: 0,
    selectedTicketName: '成人票',
    quantity: 1,
    totalPrice: '0',
    // 评论
    comments: [],
    commentPage: 1,
    commentPageSize: 10,
    hasMoreComments: true,
    showCommentDialog: false,
    commentContent: '',
    commentScore: 5,
    reviewOrderId: null,
    reviewableOrders: [],
    orderIdFromQuery: null,
    // 电话弹窗
    showPhoneDialog: false,
  },

  onLoad(options) {
    if (options.id) {
      const orderIdFromQuery = options.orderId != null && options.orderId !== '' ? options.orderId : null;
      this.setData({ spotId: options.id, orderIdFromQuery });
      this.loadSpotDetail();
      this.loadComments();
    }
  },

  onShareAppMessage() {
    const { spot } = this.data;
    return {
      title: spot ? spot.name : '景点详情',
      path: `/pages/scenic/detail?id=${this.data.spotId}`,
    };
  },

  async loadSpotDetail() {
    wx.showLoading({ title: '加载中...' });
    try {
      const spot = await app.request({ url: `/api/scenic-spots/${this.data.spotId}`, method: 'GET' });
      let images = [];
      try {
        images = typeof spot.images === 'string' ? JSON.parse(spot.images) : spot.images;
      } catch (e) {
        images = [];
      }
      const coverFull = app.fullImageUrl(spot.cover_image);
      const imagesFull = app.fullImageUrls(Array.isArray(images) ? images : []);
      const mapMarkers = [];
      if (spot.latitude && spot.longitude) {
        mapMarkers.push({ id: 1, latitude: spot.latitude, longitude: spot.longitude, title: spot.name });
      }
      const address = spot.address || '';
      const ticketTypeList = Array.isArray(spot.ticket_types) && spot.ticket_types.length > 0
        ? spot.ticket_types
        : defaultTicketTypes(spot.price);
      const firstTicket = ticketTypeList[0] || { type: 'adult', name: '成人票', price: spot.price };
      const openStatusText = getOpenStatusText(spot.open_status);
      let stopTimesText = '';
      if (spot.stop_sale_time || spot.stop_entry_time) {
        const parts = [];
        if (spot.stop_sale_time) parts.push(spot.stop_sale_time + '停止售票');
        if (spot.stop_entry_time) parts.push(spot.stop_entry_time + '停止入园');
        stopTimesText = ' (' + parts.join(', ') + ')';
      }
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      this.setData({
        spot: { ...spot, cover_image: coverFull },
        images: [coverFull, ...imagesFull],
        mapMarkers,
        displayAddress: address || '暂无地址',
        openStatusText,
        stopTimesText,
        ticketTypeList,
        selectedTicketType: firstTicket.type,
        selectedTicketPrice: parseFloat(firstTicket.price) || 0,
        selectedTicketName: firstTicket.name,
        quantity: 1,
        totalPrice: String(parseFloat(firstTicket.price) || 0),
        playDate: tomorrow.getTime(),
        playDateStr: formatDate(tomorrow),
        minDate: new Date().getTime(),
        maxDate: maxDate.getTime(),
      });
      this.loadCheckFavorite(this.data.spotId);
      this.loadContactPhone();
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async loadContactPhone() {
    try {
      const res = await app.request({ url: '/api/settings/contact-phone' });
      const phone = (res.data && res.data.contact_phone) ? res.data.contact_phone : (res.contact_phone || '');
      this.setData({ contactPhone: (phone && String(phone).trim()) || '' });
    } catch (e) {
      this.setData({ contactPhone: '' });
    }
  },

  loadCheckFavorite(spotId) {
    if (!spotId || !app.globalData.token) {
      this.setData({ isFavorited: false });
      return;
    }
    app.request({
      url: '/api/favorites/check',
      method: 'GET',
      data: { target_type: 'scenic', target_id: spotId },
      needAuth: true,
    }).then(res => this.setData({ isFavorited: res.favorited === true })).catch(() => this.setData({ isFavorited: false }));
  },

  toggleFavorite() {
    const id = Number(this.data.spotId);
    if (!id) return;
    if (!app.globalData.token) {
      wx.showModal({ title: '提示', content: '请先登录后收藏', confirmText: '去登录', success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }); } });
      return;
    }
    const isFavorited = this.data.isFavorited;
    if (isFavorited) {
      app.request({ url: `/api/favorites/scenic/${id}`, method: 'DELETE', needAuth: true })
        .then(() => { wx.showToast({ title: '已取消收藏', icon: 'none' }); this.setData({ isFavorited: false }); })
        .catch(() => wx.showToast({ title: '取消失败', icon: 'none' }));
    } else {
      app.request({ url: '/api/favorites', method: 'POST', needAuth: true, data: { target_type: 'scenic', target_id: id } })
        .then(() => { wx.showToast({ title: '已收藏', icon: 'success' }); this.setData({ isFavorited: true }); })
        .catch(() => wx.showToast({ title: '收藏失败', icon: 'none' }));
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    if (tab === 'comment') this.loadComments();
  },

  switchToCommentTab() {
    this.setData({ activeTab: 'comment' }, () => this.loadComments());
  },

  onImageChange(e) {
    this.setData({ currentImageIndex: e.detail.current });
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({ current: this.data.images[index], urls: this.data.images });
  },

  openMap() {
    const { spot } = this.data;
    if (!spot || !spot.latitude || !spot.longitude) {
      wx.showToast({ title: '暂无位置信息', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: Number(spot.latitude),
      longitude: Number(spot.longitude),
      name: spot.name,
      address: this.data.displayAddress || '',
    });
  },

  showPhonePopup() {
    this.setData({ showPhoneDialog: true });
  },

  closePhoneDialog() {
    this.setData({ showPhoneDialog: false });
  },

  callContactFromDialog() {
    const { contactPhone } = this.data;
    if (!contactPhone || !contactPhone.trim()) {
      wx.showToast({ title: '暂未设置咨询电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: contactPhone.replace(/\s/g, '') });
  },

  callContact() {
    const { contactPhone } = this.data;
    if (!contactPhone || !contactPhone.trim()) {
      wx.showToast({ title: '暂未设置咨询电话', icon: 'none' });
      return;
    }
    wx.makePhoneCall({ phoneNumber: contactPhone.replace(/\s/g, '') });
  },

  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  closeDatePicker() {
    this.setData({ showDatePicker: false });
  },

  onDateConfirm(e) {
    const date = new Date(e.detail);
    this.setData({
      playDate: date.getTime(),
      playDateStr: formatDate(date),
      showDatePicker: false,
    });
  },

  selectTicketType(e) {
    const { type, price, name } = e.currentTarget.dataset;
    const quantity = this.data.quantity;
    const p = parseFloat(price) || 0;
    this.setData({
      selectedTicketType: type,
      selectedTicketPrice: p,
      selectedTicketName: name,
      totalPrice: (p * quantity).toFixed(2),
    });
  },

  onQuantityChange(e) {
    const quantity = e.detail;
    const price = this.data.selectedTicketPrice;
    this.setData({
      quantity,
      totalPrice: (price * quantity).toFixed(2),
    });
  },

  goToConfirm() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '预订门票需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    const { spotId, spot, playDateStr, selectedTicketType, selectedTicketName, quantity, totalPrice } = this.data;
    if (!playDateStr) {
      wx.showToast({ title: '请选择游玩日期', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/scenic/confirm?id=${spotId}&playDate=${playDateStr}&ticketType=${selectedTicketType}&ticketName=${encodeURIComponent(selectedTicketName)}&quantity=${quantity}&total=${totalPrice}&name=${encodeURIComponent(spot.name)}`,
    });
  },

  async loadComments() {
    try {
      const res = await app.request({
        url: `/api/scenic-spots/${this.data.spotId}/comments`,
        data: { page: this.data.commentPage, pageSize: this.data.commentPageSize },
      });
      const rawList = Array.isArray(res) ? res : (res.list || res.data || []);
      const list = rawList.map(c => ({
        ...c,
        user: c.user ? { ...c.user, avatar: app.fullImageUrl(c.user.avatar) } : c.user,
      }));
      this.setData({
        comments: this.data.commentPage === 1 ? list : [...this.data.comments, ...list],
        hasMoreComments: list.length >= this.data.commentPageSize,
      });
    } catch (e) {
      console.error('加载评论失败', e);
    }
  },

  loadMoreComments() {
    if (!this.data.hasMoreComments) return;
    this.setData({ commentPage: this.data.commentPage + 1 }, () => this.loadComments());
  },

  async openCommentDialog() {
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '发表评论需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    try {
      const eligibility = await app.request({
        url: `/api/scenic-spots/${this.data.spotId}/comment-eligibility`,
        method: 'GET',
        needAuth: true,
      });
      if (!eligibility || !eligibility.canComment) {
        wx.showModal({
          title: '暂不可评价',
          content: (eligibility && eligibility.message) || '请先核销该景点门票后再评论',
          showCancel: false,
          confirmText: '我知道了',
        });
        return;
      }
      const list = eligibility.reviewableOrders || [];
      let pickId = this.data.orderIdFromQuery;
      if (pickId != null && !list.some(o => String(o.id) === String(pickId))) {
        wx.showToast({ title: '该订单暂不可评价', icon: 'none' });
        pickId = null;
      }
      if (pickId == null) {
        if (list.length === 1) {
          pickId = list[0].id;
        } else if (list.length > 1) {
          const labels = list.map(o => o.order_no ? `订单 ${o.order_no}` : `订单 #${o.id}`);
          const chosen = await new Promise(resolve => {
            wx.showActionSheet({
              itemList: labels,
              success: res => resolve(list[res.tapIndex]),
              fail: () => resolve(null),
            });
          });
          if (!chosen) return;
          pickId = chosen.id;
        }
      }
      if (pickId == null) {
        wx.showToast({ title: '请选择要评价的订单', icon: 'none' });
        return;
      }
      this.setData({
        reviewableOrders: list,
        reviewOrderId: pickId,
        showCommentDialog: true,
        commentContent: '',
        commentScore: 5,
      });
    } catch (e) {
      wx.showToast({ title: e.message || '暂时无法发起评价', icon: 'none' });
    }
  },

  closeCommentDialog() {
    this.setData({ showCommentDialog: false });
  },

  onScoreChange(e) {
    this.setData({ commentScore: e.detail });
  },

  onCommentInput(e) {
    this.setData({ commentContent: e.detail });
  },

  async submitComment() {
    const { commentContent, commentScore, reviewOrderId } = this.data;
    if (!commentContent || !commentContent.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }
    const token = app.globalData.token || wx.getStorageSync('token');
    if (!token) {
      wx.showModal({
        title: '提示',
        content: '发表评论需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: res => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
        },
      });
      return;
    }
    if (reviewOrderId == null) {
      wx.showToast({ title: '请选择要评价的订单', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      await app.request({
        url: `/api/scenic-spots/${this.data.spotId}/comments`,
        method: 'POST',
        needAuth: true,
        data: {
          content: commentContent.trim(),
          score: commentScore,
          order_id: reviewOrderId,
        },
      });
      wx.showToast({ title: '评论成功，等待审核', icon: 'success' });
      this.closeCommentDialog();
      this.setData({ commentPage: 1, comments: [] });
      this.loadComments();
      this.loadSpotDetail();
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});

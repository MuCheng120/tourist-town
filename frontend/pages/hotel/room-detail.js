// 房型详情页：房型介绍、设施介绍、政策服务（退改/儿童加床）
const app = getApp();
const { hotelRoomAndChildTotal } = require('../../utils/hotel-child-price');

Page({
  data: {
    roomTypeId: null,
    hotelId: null,
    room: null,
    checkInDate: '',
    checkOutDate: '',
    nightCount: 1,
    roomCount: 1,
    adultCount: 1,
    childCount: 0,
    childAges: [],
    loading: false,
    available: true,
    currentImageIndex: 1,
    totalImages: 1,
  },

  onLoad(options) {
    const id = options.id;
    const hotelId = options.hotelId;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    const criteria = app.globalData.hotelSearchCriteria || {};
    const checkIn = criteria.checkInDate || options.checkIn || '';
    const checkOut = criteria.checkOutDate || options.checkOut || '';
    let nightCount = 1;
    if (checkIn && checkOut) {
      const start = new Date(checkIn);
      const end = new Date(checkOut);
      nightCount = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
    }
    this.setData({
      roomTypeId: id,
      hotelId: hotelId || '',
      checkInDate: checkIn,
      checkOutDate: checkOut,
      nightCount,
      roomCount: criteria.roomCount || 1,
      adultCount: criteria.adultCount || 1,
      childCount: criteria.childCount || 0,
      childAges: criteria.childAges || [],
    });
    this.loadRoomDetail();
  },

  async loadRoomDetail() {
    const { roomTypeId, hotelId, checkInDate, checkOutDate } = this.data;
    this.setData({ loading: true });
    try {
      const room = await app.request({
        url: `/api/room-types/${roomTypeId}`,
        method: 'GET',
      });
      let images = room.images;
      if (typeof images === 'string') {
        try { images = JSON.parse(images || '[]'); } catch (e) { images = []; }
      }
      const imagesArr = Array.isArray(images) ? images : [];
      const imageUrls = app.fullImageUrls(imagesArr);
      let amenities = room.amenities;
      if (typeof amenities === 'string') {
        try { amenities = JSON.parse(amenities || '[]'); } catch (e) { amenities = []; }
      }
      const features = Array.isArray(amenities) ? amenities : [];
      let available = true;
      if (checkInDate && checkOutDate) {
        try {
          const stockRes = await app.request({
            url: `/api/room-types/${roomTypeId}/stock`,
            method: 'GET',
            data: { startDate: checkInDate, endDate: checkOutDate },
          });
          available = stockRes.available === true;
        } catch (e) {
          available = false;
        }
      }
      const breakfast_info = room.breakfast_info || null;
      const toiletries = Array.isArray(room.toiletries) ? room.toiletries : [];
      this.setData({
        room: {
          ...room,
          images: imageUrls,
          features,
          breakfast_info,
          toiletries,
        },
        loading: false,
        available,
        totalImages: imageUrls.length || 1,
      });
      if (room.name) wx.setNavigationBarTitle({ title: room.name });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onSwipeChange(e) {
    const idx = (e.detail && e.detail.current) != null ? e.detail.current : 0;
    this.setData({ currentImageIndex: idx + 1 });
  },

  handleBook() {
    const { room, checkInDate, checkOutDate, nightCount, roomCount, adultCount, childCount, childAges } = this.data;
    if (!room) return;
    if (!this.data.available) {
      wx.showToast({ title: '该日期暂无房', icon: 'none' });
      return;
    }
    if (!app.globalData.token) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        confirmText: '去登录',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/login/index' }); },
      });
      return;
    }
    const { total: totalPrice } = hotelRoomAndChildTotal(room.price, nightCount || 1, childCount || 0);
    const params = encodeURIComponent(JSON.stringify({
      room_type_id: room.id,
      room_name: room.name,
      check_in: checkInDate,
      check_out: checkOutDate,
      night_count: nightCount,
      price: room.price,
      total_price: totalPrice,
      adult_count: adultCount,
      child_count: childCount,
      child_ages: childAges || [],
      merchant_id: room.merchant_id != null ? room.merchant_id : undefined,
    }));
    wx.navigateTo({
      url: `/pages/hotel/confirm?data=${params}`,
    });
  },
});

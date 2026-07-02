// 酒店入住日期：完整日历页，选择入住/退房后回传并返回
const app = getApp();

Page({
  data: {
    initialCheckIn: '',
    initialCheckOut: '',
  },

  onBack() {
    wx.navigateBack();
  },

  onConfirmFromComponent(e) {
    const d = e.detail;
    if (!d || !d.checkInDate || !d.checkOutDate) return;
    this.applyRangeAndBack(d);
  },

  onLoad(options) {
    const checkIn = options.checkIn || '';
    const checkOut = options.checkOut || '';
    this.setData({
      initialCheckIn: checkIn,
      initialCheckOut: checkOut,
    });
  },

  applyRangeAndBack(payload) {
    const {
      checkInDate,
      checkOutDate,
      checkInStr,
      checkOutStr,
      checkInLabel,
      checkOutLabel,
      nightCount,
    } = payload;
    const criteria = app.globalData.hotelSearchCriteria || {};
    app.globalData.hotelSearchCriteria = {
      ...criteria,
      checkInDate,
      checkOutDate,
    };
    app.globalData.hotelCalendarResult = {
      checkInDate,
      checkOutDate,
      checkInStr,
      checkOutStr,
      checkInLabel,
      checkOutLabel,
      nightCount,
    };
    const pages = getCurrentPages();
    const normalizeRoute = r => String(r || '').replace(/^\//, '');
    const patch = {
      checkInDate,
      checkOutDate,
      checkInStr,
      checkOutStr,
      checkInLabel,
      checkOutLabel,
      nightCount,
    };
    for (let i = pages.length - 2; i >= 0; i--) {
      const p = pages[i];
      if (p && normalizeRoute(p.route) === 'pages/hotel/index') {
        p.setData(patch);
        break;
      }
    }
    wx.navigateBack();
  },
});

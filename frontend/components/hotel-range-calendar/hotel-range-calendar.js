const { buildConfirmPayload } = require('../../utils/hotel-calendar-range');

Component({
  properties: {
    /** 入住 yyyy-MM-dd */
    checkInDate: { type: String, value: '' },
    /** 退房 yyyy-MM-dd */
    checkOutDate: { type: String, value: '' },
    /** 底部弹层内使用时为 true，控制高度 */
    embedded: { type: Boolean, value: false },
  },

  data: {
    minDate: Date.now(),
    maxDate: (() => {
      const t = new Date();
      t.setFullYear(t.getFullYear() + 1);
      return t.getTime();
    })(),
    defaultDate: [],
    selectedRange: null,
  },

  observers: {
    'checkInDate, checkOutDate': function (ci, co) {
      this.applyProps(ci, co);
    },
  },

  lifetimes: {
    attached() {
      this.applyProps(this.properties.checkInDate, this.properties.checkOutDate);
    },
  },

  methods: {
    applyProps(checkIn, checkOut) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let start = checkIn ? new Date(checkIn).getTime() : today.getTime();
      let end = checkOut ? new Date(checkOut).getTime() : tomorrow.getTime();
      if (end <= start) end = tomorrow.getTime();
      const defaultDate = [start, end];
      this.setData({
        defaultDate,
        selectedRange: [new Date(start), new Date(end)],
      });
    },

    onSelect(e) {
      const detail = e.detail;
      if (!detail || !Array.isArray(detail)) return;
      const start = detail[0];
      if (!start) return;
      const end = detail.length > 1 ? detail[1] : null;
      // 区间未选满时 Vant 会 emit [入住, null]，必须写入，否则确认仍用进入页面前的旧区间
      this.setData({ selectedRange: [start, end] });
    },

    onBack() {
      this.triggerEvent('cancel');
    },

    onConfirmTap() {
      const range = this.data.selectedRange;
      if (!range || !Array.isArray(range) || !range[0]) {
        wx.showToast({ title: '请选择入住日期', icon: 'none' });
        return;
      }
      const end = range.length > 1 ? range[1] : null;
      if (!end) {
        wx.showToast({ title: '请选择离店日期', icon: 'none' });
        return;
      }
      const tIn = range[0].getTime ? range[0].getTime() : new Date(range[0]).getTime();
      const tOut = end.getTime ? end.getTime() : new Date(end).getTime();
      if (!(tOut > tIn)) {
        wx.showToast({ title: '离店日期需晚于入住日期', icon: 'none' });
        return;
      }
      const payload = buildConfirmPayload(range);
      if (!payload) {
        wx.showToast({ title: '请选择入住和退房日期', icon: 'none' });
        return;
      }
      this.triggerEvent('confirm', payload);
    },
  },
});

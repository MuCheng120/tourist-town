Component({
  properties: {
    show: { type: Boolean, value: false },
    roomCount: { type: Number, value: 1 },
    adultCount: { type: Number, value: 1 },
    childCount: { type: Number, value: 0 },
    childAges: { type: Array, value: [] },
  },

  data: {
    roomCount: 1,
    adultCount: 1,
    childCount: 0,
    childAges: [],
    guestCount: 1,
    showChildAgePopup: false,
    childAgePickerTitle: '选择儿童年龄',
    childAgeOptions: (() => {
      const arr = [];
      for (let i = 0; i <= 17; i++) arr.push({ name: `${i}岁`, value: i });
      return arr;
    })(),
  },

  observers: {
    show(val) {
      if (val) this.syncFromProps();
    },
  },

  methods: {
    syncFromProps() {
      const p = this.properties;
      const childAges = Array.isArray(p.childAges) ? [...p.childAges] : [];
      const adultCount = typeof p.adultCount === 'number' ? p.adultCount : 1;
      const childCount = typeof p.childCount === 'number' ? p.childCount : 0;
      const roomCount = typeof p.roomCount === 'number' ? p.roomCount : 1;
      this.setData({
        roomCount,
        adultCount,
        childCount,
        childAges,
        guestCount: adultCount + childCount,
        showChildAgePopup: false,
      });
    },

    onPopupClose() {
      this.setData({ showChildAgePopup: false });
      this.triggerEvent('close');
    },

    onRoomCountChange(e) {
      const v = typeof e.detail === 'number' ? e.detail : (e.detail && e.detail.value);
      const n = typeof v === 'number' ? v : parseInt(v, 10) || 1;
      const guestCount = this.data.adultCount + this.data.childCount;
      this.setData({ roomCount: n, guestCount });
    },

    onAdultCountChange(e) {
      const v = typeof e.detail === 'number' ? e.detail : (e.detail && e.detail.value);
      const n = typeof v === 'number' ? v : parseInt(v, 10) || 1;
      const guestCount = n + this.data.childCount;
      this.setData({ adultCount: n, guestCount });
    },

    onChildCountChange(e) {
      const v = typeof e.detail === 'number' ? e.detail : (e.detail && e.detail.value);
      const n = typeof v === 'number' ? v : parseInt(v, 10) || 0;
      const { childAges } = this.data;
      const guestCount = this.data.adultCount + n;
      if (n < childAges.length) {
        this.setData({
          childCount: n,
          guestCount,
          childAges: childAges.slice(0, n),
        });
        return;
      }
      this.setData({ childCount: n, guestCount });
      if (n > childAges.length) {
        this.setData({
          childAgePickerTitle: `选择儿童${childAges.length + 1}的年龄`,
          showChildAgePopup: true,
        });
      }
    },

    onChildAgeSelect(e) {
      const item = e.detail;
      if (!item || item.value == null) return;
      const age = typeof item.value === 'number' ? item.value : parseInt(item.value, 10);
      const { childAges, childCount } = this.data;
      const nextAges = [...childAges, age];
      this.setData({
        childAges: nextAges,
        showChildAgePopup: false,
      });
      if (nextAges.length < childCount) {
        this.setData({
          childAgePickerTitle: `选择儿童${nextAges.length + 1}的年龄`,
          showChildAgePopup: true,
        });
      }
    },

    onCloseChildAgePopup() {
      const { childAges, childCount } = this.data;
      if (childAges.length < childCount) {
        this.setData({
          childCount: childAges.length,
          guestCount: this.data.adultCount + childAges.length,
          showChildAgePopup: false,
        });
      } else {
        this.setData({ showChildAgePopup: false });
      }
    },

    confirmRoomGuest() {
      const { roomCount, adultCount, childCount, childAges, guestCount } = this.data;
      this.triggerEvent('confirm', {
        roomCount,
        adultCount,
        childCount,
        childAges: childAges || [],
        guestCount,
      });
    },
  },
});

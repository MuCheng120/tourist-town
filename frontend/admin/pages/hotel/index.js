// 管理员 - 酒店管理：参考前端酒店列表/详情与数据表字段
const app = getApp();

Page({
  data: {
    hotels: [],
    loading: false,
    status: '',
    statusIndex: 0,
    statusOptions: [
      { label: '全部', value: '' },
      { label: '显示', value: '1' },
      { label: '隐藏', value: '0' },
    ],
  },

  onLoad() {
    this.loadHotels();
  },

  onStatusPickerChange(e) {
    const i = parseInt(e.detail.value, 10);
    const status = this.data.statusOptions[i].value;
    this.setData({ statusIndex: i, status });
    this.loadHotels();
  },

  onShow() {
    const needRefresh = wx.getStorageSync('admin_hotel_need_refresh');
    if (needRefresh) {
      wx.removeStorageSync('admin_hotel_need_refresh');
    }
    this.loadHotels();
  },

  async loadHotels() {
    this.setData({ loading: true });
    try {
      const { status } = this.data;
      const res = await app.request({
        url: '/api/admin/hotels',
        method: 'GET',
        needAuth: true,
        data: status ? { status: parseInt(status, 10) } : {},
      });
      const list = (Array.isArray(res) ? res : (res && res.list ? res.list : []) || []).map(h => ({
        ...h,
        cover_image: h.cover_image ? app.fullImageUrl(h.cover_image) : '',
        statusText: h.status === 1 ? '显示' : '隐藏',
        min_price: h.min_price != null ? h.min_price : null,
      }));
      this.setData({ hotels: list, loading: false });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  goToAddHotel() {
    wx.navigateTo({
      url: '/admin/pages/hotel/edit',
    });
  },

  goToEditHotel(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/admin/pages/hotel/edit?id=${id}`,
    });
  },

  deleteHotel(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.hotels || []).find(h => h.id == id);
    if (!item) return;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除酒店「${item.name}」吗？其下房型将无法关联显示。`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await app.request({
            url: `/api/admin/hotels/${item.id}`,
            method: 'DELETE',
            needAuth: true,
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.loadHotels();
        } catch (err) {
          wx.showToast({ title: err.message || '删除失败', icon: 'none' });
        }
      },
    });
  },

  goRoomTypes(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || '';
    wx.navigateTo({
      url: `/admin/pages/hotel/room-types?hotelId=${id}&name=${encodeURIComponent(name)}`,
    });
  },
});

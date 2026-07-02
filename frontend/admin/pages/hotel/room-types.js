// 管理员 - 在指定酒店下管理房型（添加/编辑/删除/库存）
const app = getApp();
const {
  showImpactConfirm,
  showFinalConfirm,
  saveActionError,
  clearActionError,
  showLastActionError,
} = require('../../utils/risky-action');

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 本地日历日 YYYY-MM-DD */
function localYmd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localTodayYmd() {
  return localYmd(new Date());
}

/** 与后端入住区间一致：左闭右开，check_in=今日、check_out=明日 仅含今日一晚库存 */
function localTomorrowYmd() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localYmd(d);
}

function stockRowDateKey(dateVal) {
  if (dateVal == null || dateVal === '') return '';
  if (typeof dateVal === 'string') {
    const m = dateVal.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  return '';
}

Page({
  data: {
    hotelId: null,
    hotelName: '',
    roomTypes: [],
    loading: false,
    showAddModal: false,
    showEditModal: false,
    showStockModal: false,
    currentRoom: null,
    formData: {
      name: '',
      price: '',
      description: '',
      images: [],
      area: '',
      bed_type: '',
      max_occupancy: 2,
      initial_daily_stock: 10,
      status: 1,
    },
    dateRange: { start: '', end: '' },
    stockCount: 10,
    lastActionError: null,
  },

  /** 提交前统一为相对路径，避免把带局域网 IP 的完整 URL 写入库 */
  toRelativeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const s = url.trim();
    if (!s.startsWith('http://') && !s.startsWith('https://')) {
      return s.startsWith('/') ? s : `/${s}`;
    }
    const base = String(app.globalData.baseUrl || '').replace(/\/+$/, '');
    if (base && s.indexOf(base) === 0) {
      const rest = s.slice(base.length);
      return rest.startsWith('/') ? rest : `/${rest}`;
    }
    const uploadsIdx = s.indexOf('/uploads/');
    if (uploadsIdx !== -1) return s.slice(uploadsIdx);
    return s;
  },

  onLoad(options) {
    const hotelId = options.hotelId ? parseInt(options.hotelId, 10) : null;
    const hotelName = options.name ? decodeURIComponent(options.name) : '酒店';
    if (!hotelId) {
      wx.showToast({ title: '缺少酒店信息', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ hotelId, hotelName });
    wx.setNavigationBarTitle({ title: `${hotelName} - 房型` });
    this.loadRoomTypes();
  },

  async loadRoomTypes() {
    if (!this.data.hotelId) return;
    this.setData({ loading: true });
    try {
      const todayYmd = localTodayYmd();
      const res = await app.request({
        url: '/api/room-types',
        method: 'GET',
        data: {
          hotel_id: this.data.hotelId,
          pageSize: 100,
          include_offline: 1,
          check_in: todayYmd,
          check_out: localTomorrowYmd(),
        },
      });
      const data = res.data || res;
      const list = (data.list || []).map(r => {
        const images = r.images;
        let arr = [];
        if (typeof images === 'string') {
          try { arr = JSON.parse(images); } catch (e) { arr = []; }
        } else if (Array.isArray(images)) arr = images;
        const { stocks = [], ...rest } = r;
        let todayStockDisplay = '未录入';
        if (Array.isArray(stocks)) {
          const row = stocks.find(s => stockRowDateKey(s.date) === todayYmd);
          if (row) todayStockDisplay = String(Number(row.remained_count) || 0);
        }
        return {
          ...rest,
          images: arr.map(u => app.fullImageUrl(u)).filter(Boolean),
          todayStockDisplay,
        };
      });
      this.setData({ roomTypes: list, loading: false });
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  showAddDialog() {
    this.setData({
      showAddModal: true,
      formData: {
        name: '',
        price: '',
        description: '',
        images: [],
        area: '',
        bed_type: '',
        max_occupancy: 2,
        initial_daily_stock: 10,
        status: 1,
      },
    });
  },

  closeAddDialog() {
    this.setData({ showAddModal: false });
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    let value = e.detail.value;
    if (field === 'max_occupancy' || field === 'status') value = parseInt(value, 10);
    if (field === 'initial_daily_stock') {
      if (value === '' || value === undefined) value = '';
      else {
        const n = parseInt(value, 10);
        value = Number.isNaN(n) ? 0 : Math.max(0, n);
      }
    }
    if (field === 'price') value = value ? parseFloat(value) : '';
    this.setData({ [`formData.${field}`]: value });
  },

  async chooseImage() {
    try {
      const res = await wx.chooseImage({
        count: 3 - (this.data.formData.images || []).length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      if (!res.tempFilePaths || !res.tempFilePaths.length) return;
      const relUrls = await Promise.all(res.tempFilePaths.map(path => app.uploadImage(path, 'hotel')));
      const displayUrls = relUrls.map(u => app.fullImageUrl(u)).filter(Boolean);
      const prev = this.data.formData.images || [];
      this.setData({ 'formData.images': [...prev, ...displayUrls] });
    } catch (e) {
      wx.showToast({ title: '选择失败', icon: 'none' });
    }
  },

  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [ ...(this.data.formData.images || []) ];
    if (index < 0 || index >= images.length) return;
    images.splice(index, 1);
    this.setData({ 'formData.images': images });
  },

  async submitAdd() {
    const { formData, hotelId } = this.data;
    if (!formData.name || !formData.name.trim()) {
      wx.showToast({ title: '请填写房型名称', icon: 'none' });
      return;
    }
    if (!formData.price && formData.price !== 0) {
      wx.showToast({ title: '请填写价格', icon: 'none' });
      return;
    }
    let initialDaily = formData.initial_daily_stock;
    if (initialDaily === '' || initialDaily === undefined || initialDaily === null) {
      initialDaily = 10;
    } else {
      initialDaily = parseInt(initialDaily, 10);
      if (Number.isNaN(initialDaily)) initialDaily = 10;
    }
    try {
      await app.request({
        url: '/api/room-types',
        method: 'POST',
        needAuth: true,
        data: {
          hotel_id: hotelId,
          name: formData.name.trim(),
          price: parseFloat(formData.price),
          description: (formData.description || '').trim(),
          images: JSON.stringify(
            (formData.images || []).map(u => this.toRelativeImageUrl(u)).filter(Boolean)
          ),
          amenities: JSON.stringify([]),
          area: (formData.area || '').trim() || null,
          bed_type: (formData.bed_type || '').trim() || null,
          max_occupancy: formData.max_occupancy != null ? formData.max_occupancy : 2,
          initial_daily_stock: initialDaily,
          status: formData.status != null ? formData.status : 1,
        },
      });
      wx.showToast({ title: '添加成功', icon: 'success' });
      this.setData({ lastActionError: null });
      this.closeAddDialog();
      this.loadRoomTypes();
    } catch (e) {
      wx.showToast({ title: e.message || '添加失败', icon: 'none' });
    }
  },

  showEditDialog(e) {
    const item = e.currentTarget.dataset.item;
    const images = Array.isArray(item.images) ? item.images : [];
    this.setData({
      showEditModal: true,
      currentRoom: item,
      formData: {
        name: item.name || '',
        price: item.price != null ? item.price : '',
        description: item.description || '',
        images,
        area: item.area || '',
        bed_type: item.bed_type || '',
        max_occupancy: item.max_occupancy != null ? item.max_occupancy : 2,
        status: item.status != null ? item.status : 1,
      },
    });
  },

  closeEditDialog() {
    this.setData({ showEditModal: false, currentRoom: null });
  },

  async submitEdit() {
    const { formData, currentRoom } = this.data;
    if (!formData.name || !formData.name.trim()) {
      wx.showToast({ title: '请填写房型名称', icon: 'none' });
      return;
    }
    try {
      await app.request({
        url: `/api/room-types/${currentRoom.id}`,
        method: 'PUT',
        needAuth: true,
        data: {
          name: formData.name.trim(),
          price: parseFloat(formData.price),
          description: (formData.description || '').trim(),
          images: JSON.stringify(
            (formData.images || []).map(u => this.toRelativeImageUrl(u)).filter(Boolean)
          ),
          amenities: JSON.stringify([]),
          area: (formData.area || '').trim() || null,
          bed_type: (formData.bed_type || '').trim() || null,
          max_occupancy: formData.max_occupancy != null ? formData.max_occupancy : 2,
          status: formData.status != null ? formData.status : 1,
        },
      });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.setData({ lastActionError: null });
      this.closeEditDialog();
      this.loadRoomTypes();
    } catch (e) {
      wx.showToast({ title: e.message || '更新失败', icon: 'none' });
    }
  },

  showLastActionError() {
    showLastActionError(this, 'lastActionError', '房型ID');
  },

  async toggleStatus(e) {
    const item = e.currentTarget.dataset.item;
    const newStatus = item.status === 1 ? 0 : 1;
    const actionName = newStatus === 1 ? '上架房型' : '下架房型';
    const impactConfirmed = await showImpactConfirm(
      actionName,
      newStatus === 1 ? '上架后该房型可被用户下单。' : '下架后该房型将暂不可售，不影响历史订单。'
    );
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm(actionName);
    if (!confirmed) return;
    try {
      await app.request({
        url: `/api/room-types/${item.id}`,
        method: 'PUT',
        needAuth: true,
        data: { status: newStatus },
      });
      wx.showToast({ title: newStatus === 1 ? '已上架' : '已下架', icon: 'success' });
      clearActionError(this, 'lastActionError');
      this.loadRoomTypes();
    } catch (e) {
      saveActionError(this, actionName, item.id, e, { status: newStatus }, 'lastActionError');
      wx.showToast({ title: e.message || '操作失败，可查看失败记录', icon: 'none' });
    }
  },

  async deleteRoom(e) {
    const item = e.currentTarget.dataset.item;
    const impactConfirmed = await showImpactConfirm(
      '删除房型',
      `将永久删除房型「${item.name}」，请确认该房型无未完成订单。`
    );
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm('删除房型');
    if (!confirmed) return;
    try {
      await app.request({
        url: `/api/room-types/${item.id}`,
        method: 'DELETE',
        needAuth: true,
      });
      wx.showToast({ title: '删除成功', icon: 'success' });
      clearActionError(this, 'lastActionError');
      this.loadRoomTypes();
    } catch (err) {
      saveActionError(this, '删除房型', item.id, err, {}, 'lastActionError');
      wx.showToast({ title: err.message || '删除失败，可查看失败记录', icon: 'none' });
    }
  },

  showStockDialog(e) {
    const item = e.currentTarget.dataset.item;
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    const format = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.setData({
      showStockModal: true,
      currentRoom: item,
      dateRange: { start: format(today), end: format(end) },
      stockCount: 10,
    });
  },

  onStartDateChange(e) {
    this.setData({ 'dateRange.start': e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ 'dateRange.end': e.detail.value });
  },

  onStockCountChange(e) {
    const raw = e.detail && e.detail.value;
    const num = parseInt(raw, 10);
    this.setData({ stockCount: Number.isNaN(num) ? '' : num });
  },

  closeStockDialog() {
    this.setData({ showStockModal: false, currentRoom: null });
  },

  async setStock() {
    const { currentRoom, dateRange, stockCount } = this.data;
    if (!stockCount || stockCount < 0) {
      wx.showToast({ title: '请填写有效库存', icon: 'none' });
      return;
    }
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      wx.showToast({ title: '日期范围不正确', icon: 'none' });
      return;
    }
    const impactConfirmed = await showImpactConfirm('批量设置库存', '该操作会覆盖所选日期内的库存值，请确认范围与数量。');
    if (!impactConfirmed) return;
    const confirmed = await showFinalConfirm('批量设置库存');
    if (!confirmed) return;
    const dates = [];
    let cur = new Date(start);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    const stockList = dates.map(date => ({ date, count: stockCount }));
    try {
      await app.request({
        url: `/api/room-types/${currentRoom.id}/stock`,
        method: 'POST',
        needAuth: true,
        data: { stockList },
      });
      wx.showToast({ title: '设置成功', icon: 'success' });
      clearActionError(this, 'lastActionError');
      this.closeStockDialog();
    } catch (e) {
      saveActionError(this, '设置库存', currentRoom && currentRoom.id, e, {
        start: dateRange.start,
        end: dateRange.end,
        stockCount,
      }, 'lastActionError');
      wx.showToast({ title: e.message || '设置失败，可查看失败记录', icon: 'none' });
    }
  },
});

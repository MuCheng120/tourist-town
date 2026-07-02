// pages/address/index.js
const app = getApp();

Page({
  data: {
    addressList: [],
    fromOrder: false, // 是否从订单页跳转
    manageMode: false, // 是否处于管理模式（多选删除）
    selectedIds: [],   // 管理模式下选中的地址 id 列表
  },

  onLoad(options) {
    if (options.fromOrder) {
      wx.setNavigationBarTitle({ title: '选择地址' });
      this.setData({ fromOrder: true });
    }
  },

  onShow() {
    this.loadAddressList();
  },

  /**
   * 加载地址列表（后端可能返回 snake_case，统一转成前端用的 camelCase）
   */
  async loadAddressList() {
    try {
      const list = await app.request({
        url: '/api/address/list',
        method: 'GET',
        needAuth: true,
      });
      const rawList = (list || []).map(item => ({
        id: item.id,
        userName: item.userName || item.user_name,
        telNumber: item.tel_number || item.telNumber,
        provinceName: item.provinceName || item.province_name,
        cityName: item.cityName || item.city_name,
        countyName: item.countyName || item.county_name,
        detailInfo: item.detailInfo || item.detail_info,
        postalCode: item.postal_code || item.postalCode,
        default: item.is_default != null ? item.is_default : item.default,
      }));
      const selectedIds = this.data.selectedIds || [];
      const addressList = rawList.map(addr => ({
        ...addr,
        selected: selectedIds.some(sid => String(sid) === String(addr.id)),
      }));
      this.setData({ addressList });
    } catch (error) {
      console.error('加载地址列表失败:', error);
    }
  },

  /**
   * 选择收货地址（调用微信chooseAddress接口）
   */
  chooseAddress() {
    const that = this;
    
    wx.chooseAddress({
      success(res) {
        // 用户选择或添加了地址
        that.saveAddress(res);
      },
      fail(err) {
        console.error('选择地址失败:', err);
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要您授权使用收货地址功能',
            success(modalRes) {
              if (modalRes.confirm) {
                wx.openSetting();
              }
            },
          });
        }
      },
    });
  },

  /**
   * 保存地址到后端（微信 chooseAddress 回调或手动填写提交）
   */
  async saveAddress(addressInfo) {
    try {
      await app.request({
        url: '/api/address/create',
        method: 'POST',
        needAuth: true,
        data: {
          userName: addressInfo.userName || addressInfo.user_name,
          telNumber: addressInfo.telNumber || addressInfo.tel_number,
          provinceName: addressInfo.provinceName || addressInfo.province_name,
          cityName: addressInfo.cityName || addressInfo.city_name,
          countyName: addressInfo.countyName || addressInfo.county_name,
          detailInfo: addressInfo.detailInfo || addressInfo.detail_info,
          postalCode: addressInfo.postalCode || addressInfo.postal_code,
        },
      });

      wx.showToast({
        title: '添加成功',
        icon: 'success',
      });
      this.loadAddressList();
    } catch (error) {
      console.error('保存地址失败:', error);
      wx.showToast({
        title: '添加失败',
        icon: 'none',
      });
    }
  },

  /**
   * 选择地址（从订单页跳转时，非管理模式下点击条目）
   */
  selectAddress(e) {
    if (this.data.manageMode) return;
    const address = e.currentTarget.dataset.address;
    if (this.data.fromOrder) {
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        prevPage.setData({ selectedAddress: address });
        wx.navigateBack();
      }
    }
  },

  /**
   * 进入/退出管理模式
   */
  toggleManageMode() {
    const next = !this.data.manageMode;
    const addressList = (this.data.addressList || []).map(addr => ({
      ...addr,
      selected: next ? false : addr.selected,
    }));
    this.setData({
      manageMode: next,
      selectedIds: next ? [] : this.data.selectedIds,
      addressList,
    });
  },

  /**
   * 管理模式下勾选/取消勾选
   */
  toggleSelect(e) {
    const rawId = e.currentTarget.dataset.id;
    if (rawId == null) return;
    const list = this.data.addressList || [];
    const currentIds = this.data.selectedIds || [];
    const addr = list.find(a => String(a.id) === String(rawId));
    if (!addr) return;
    const idx = currentIds.findIndex(sid => String(sid) === String(addr.id));
    const selectedIds = idx >= 0
      ? currentIds.filter((_, i) => i !== idx)
      : [...currentIds, addr.id];
    const addressList = list.map(a => ({
      ...a,
      selected: selectedIds.some(sid => String(sid) === String(a.id)),
    }));
    this.setData({ selectedIds, addressList });
  },

  /**
   * 全选 / 取消全选
   */
  toggleSelectAll() {
    const { addressList, selectedIds } = this.data;
    const ids = (addressList || []).map(item => item.id);
    const allSelected = ids.length > 0 && ids.every(id => selectedIds.indexOf(id) >= 0);
    this.setData({
      selectedIds: allSelected ? [] : ids,
    });
  },

  /**
   * 删除选中的地址（批量）
   */
  async deleteSelected() {
    const { selectedIds } = this.data;
    if (!selectedIds || selectedIds.length === 0) {
      wx.showToast({ title: '请先勾选要删除的地址', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '提示',
      content: `确定删除选中的 ${selectedIds.length} 个地址？`,
      success: async (res) => {
        if (!res.confirm) return;
        try {
          for (const id of selectedIds) {
            await app.request({
              url: `/api/address/${id}`,
              method: 'DELETE',
              needAuth: true,
            });
          }
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.setData({ manageMode: false, selectedIds: [] });
          this.loadAddressList();
        } catch (error) {
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      },
    });
  },

  /**
   * 设为默认地址
   */
  async setDefault(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await app.request({
        url: `/api/address/${id}/default`,
        method: 'PUT',
        needAuth: true,
      });
      wx.showToast({ title: '设置成功', icon: 'success' });
      this.loadAddressList();
    } catch (error) {
      wx.showToast({ title: error.message || '设置失败', icon: 'none' });
    }
  },

  /**
   * 跳转编辑/新增页（手动填写）
   */
  goEdit(e) {
    const id = e.currentTarget.dataset.id;
    const url = id ? `/pages/address/edit?id=${id}` : '/pages/address/edit';
    wx.navigateTo({ url });
  },

  /**
   * 删除地址
   */
  deleteAddress(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '提示',
      content: '确定要删除该地址吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await app.request({
            url: `/api/address/${id}`,
            method: 'DELETE',
            needAuth: true,
          });
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.loadAddressList();
        } catch (error) {
          wx.showToast({ title: error.message || '删除失败', icon: 'none' });
        }
      },
    });
  },
});

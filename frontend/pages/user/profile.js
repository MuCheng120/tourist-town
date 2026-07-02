// pages/user/profile.js 个人资料：展示与编辑（头像、背景、昵称、性别、年龄）
const app = getApp();

const GENDER_MAP = { male: '男', female: '女', other: '其他' };

Page({
  data: {
    userInfo: null,
    avatarUrl: '',
    backgroundUrl: '',
    genderText: '',
    saving: false,
    showPwdPopup: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    changingPassword: false,
  },

  onLoad() {
    this.loadUser();
  },

  onShow() {
    const u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!u) return;
    // 合并当前页已上传但未保存的头像/背景，避免先传头像再传背景时 onShow 用旧数据覆盖
    const current = this.data.userInfo;
    const merged = { ...u };
    if (current && current.avatar) merged.avatar = current.avatar;
    if (current && current.background) merged.background = current.background;
    this.setUserData(merged);
  },

  loadUser() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    app.request({ url: '/api/user/info', method: 'GET', needAuth: true })
      .then(userInfo => {
        this.setUserData(userInfo);
      })
      .catch(() => {
        wx.showToast({ title: '获取信息失败', icon: 'none' });
      });
  },

  setUserData(userInfo) {
    const avatarUrl = app.fullImageUrl(userInfo.avatar);
    const backgroundUrl = app.fullImageUrl(userInfo.background);
    const genderText = GENDER_MAP[userInfo.gender] || '';
    // van-field 的 value 必须是字符串，不能为 null；年龄在页面内统一用字符串，提交时再转数字
    const ageStr = (userInfo.age != null && userInfo.age !== '') ? String(userInfo.age) : '';
    const normalized = {
      ...userInfo,
      nickname: userInfo.nickname != null ? userInfo.nickname : '',
      real_name: userInfo.real_name != null ? userInfo.real_name : '',
      age: ageStr,
    };
    this.setData({
      userInfo: normalized,
      avatarUrl: avatarUrl || '',
      backgroundUrl: backgroundUrl || '',
      genderText,
    });
  },

  onNicknameChange(e) {
    const val = e.detail;
    const nickname = (typeof val === 'string' ? val : (val && val.value)) || '';
    this.setData({ 'userInfo.nickname': nickname });
  },

  onRealNameChange(e) {
    const val = e.detail;
    const real_name = (typeof val === 'string' ? val : (val && val.value)) || '';
    this.setData({ 'userInfo.real_name': real_name });
  },

  onAgeChange(e) {
    const val = e.detail;
    // type="number" 时 e.detail 可能是数字；页面内年龄统一用字符串，避免传 null 给 van-field
    const raw = (typeof val === 'number' ? String(val) : (typeof val === 'string' ? val : (val && val.value))) || '';
    const ageStr = raw ? String(parseInt(raw, 10)) : '';
    this.setData({ 'userInfo.age': ageStr });
  },

  showGenderPicker() {
    const items = [ { text: '男', value: 'male' }, { text: '女', value: 'female' }, { text: '其他', value: 'other' } ];
    wx.showActionSheet({
      itemList: items.map(i => i.text),
      success: res => {
        const item = items[res.tapIndex];
        this.setData({
          'userInfo.gender': item.value,
          genderText: item.text,
        });
      },
    });
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: [ 'image' ],
      sizeType: [ 'compressed' ],
      success: async (res) => {
        const path = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中' });
        try {
          const url = await app.uploadImage(path, 'user');
          this.setData({
            'userInfo.avatar': url,
            avatarUrl: app.fullImageUrl(url),
          });
          wx.hideLoading();
          wx.showToast({ title: '头像已上传，请点击「保存修改」保存到服务器', icon: 'none', duration: 2500 });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e.message || '头像上传失败，请重试', icon: 'none', duration: 2000 });
        }
      },
    });
  },

  chooseBackground() {
    wx.chooseMedia({
      count: 1,
      mediaType: [ 'image' ],
      sizeType: [ 'compressed' ],
      success: async (res) => {
        const path = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '上传中' });
        try {
          const url = await app.uploadImage(path, 'user');
          this.setData({
            'userInfo.background': url,
            backgroundUrl: app.fullImageUrl(url),
          });
          wx.hideLoading();
          wx.showToast({ title: '背景已上传，请点击「保存修改」保存到服务器', icon: 'none', duration: 2500 });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: e.message || '背景上传失败，请重试', icon: 'none', duration: 2000 });
        }
      },
    });
  },

  async submit() {
    const { userInfo } = this.data;
    if (!userInfo) return;
    const payload = {
      nickname: userInfo.nickname,
      avatar: userInfo.avatar || undefined,
      background: userInfo.background || undefined,
      gender: userInfo.gender,
      age: (userInfo.age !== '' && userInfo.age != null) ? parseInt(userInfo.age, 10) : undefined,
      real_name: userInfo.real_name || undefined,
    };
    this.setData({ saving: true });
    try {
      const updated = await app.request({
        url: '/api/user/update',
        method: 'POST',
        needAuth: true,
        data: payload,
      });
      const normalized = {
        ...updated,
        avatar: updated.avatar != null ? updated.avatar : '',
        background: updated.background != null ? updated.background : '',
        age: (updated.age != null && updated.age !== '') ? String(updated.age) : '',
      };
      this.setData({
        userInfo: normalized,
        avatarUrl: app.fullImageUrl(updated.avatar) || '',
        backgroundUrl: app.fullImageUrl(updated.background) || '',
        saving: false,
      });
      app.globalData.userInfo = updated;
      wx.setStorageSync('userInfo', updated);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (e) {
      this.setData({ saving: false });
      wx.showToast({ title: e.message || '保存失败，请重试', icon: 'none', duration: 2000 });
    }
  },

  openChangePassword() {
    this.setData({
      showPwdPopup: true,
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  },

  closeChangePassword() {
    if (this.data.changingPassword) return;
    this.setData({ showPwdPopup: false });
  },

  onOldPasswordInput(e) {
    const val = (e.detail && e.detail.value != null) ? e.detail.value : e.detail;
    this.setData({ oldPassword: val || '' });
  },

  onNewPasswordInput(e) {
    const val = (e.detail && e.detail.value != null) ? e.detail.value : e.detail;
    this.setData({ newPassword: val || '' });
  },

  onConfirmPasswordInput(e) {
    const val = (e.detail && e.detail.value != null) ? e.detail.value : e.detail;
    this.setData({ confirmPassword: val || '' });
  },

  async submitPasswordChange() {
    if (this.data.changingPassword) return;
    const oldPwd = (this.data.oldPassword || '').trim();
    const newPwd = (this.data.newPassword || '').trim();
    const confirmPwd = (this.data.confirmPassword || '').trim();
    if (!oldPwd || !newPwd || !confirmPwd) {
      wx.showToast({ title: '请完整填写密码信息', icon: 'none' });
      return;
    }
    if (newPwd !== confirmPwd) {
      wx.showToast({ title: '两次输入的新密码不一致', icon: 'none' });
      return;
    }

    this.setData({ changingPassword: true });
    try {
      await app.request({
        url: '/api/user/change-password',
        method: 'POST',
        needAuth: true,
        data: {
          old_password: oldPwd,
          new_password: newPwd,
        },
      });
      wx.showToast({ title: '密码修改成功', icon: 'success' });
      this.setData({
        changingPassword: false,
        showPwdPopup: false,
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (e) {
      this.setData({ changingPassword: false });
      wx.showToast({ title: (e && e.message) || '修改失败，请重试', icon: 'none' });
    }
  },
});

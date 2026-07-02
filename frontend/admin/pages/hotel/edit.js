const app = getApp();

function parsePolicyInfo(policyInfo) {
  if (!policyInfo) return {};
  if (typeof policyInfo === 'string') {
    try {
      return JSON.parse(policyInfo);
    } catch (e) {
      return {};
    }
  }
  return typeof policyInfo === 'object' ? policyInfo : {};
}

function isValidTimeText(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || '').trim());
}

function looksLikePolicyInfoObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = ['check_in', 'check_out', 'deposit', 'invoice', 'children_extra_bed', 'rich_text_html'];
  return keys.some(k => Object.prototype.hasOwnProperty.call(obj, k));
}

Page({
  data: {
    id: null,
    isEdit: false,
    loading: false,
    allTags: [],
    displayedTags: [],
    selectedTagList: [],
    baseVisibleTagCount: 12,
    visibleTagCount: 12,
    hasMoreTags: false,
    displayCover: '',
    form: {
      name: '',
      introduction: '',
      address: '',
      latitude: '',
      longitude: '',
      list_stock_tip: '',
      cover_image: '',
      sort_order: 0,
      status: 1,
      tag_ids: [],
      policy_check_in_from: '14:00',
      policy_check_in_to: '23:59',
      policy_check_in_note: '',
      policy_check_out_before: '12:00',
      policy_check_out_note: '',
      policy_deposit_required: false,
      policy_deposit_amount: '',
      policy_deposit_currency: '元',
      policy_deposit_note: '',
      policy_invoice_supported: false,
      policy_invoice_types: '',
      policy_invoice_note: '',
      policy_child_free_rule: '',
      policy_extra_bed_supported: false,
      policy_extra_bed_price: '',
      policy_extra_bed_note: '',
      policy_rich_text_html: '',
    },
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: Number(options.id), isEdit: true });
    }
    this.loadTags();
    if (this.data.isEdit) this.loadHotelDetail();
  },

  async loadTags() {
    try {
      const res = await app.request({
        url: '/api/admin/tags',
        method: 'GET',
        needAuth: true,
      });
      const list = Array.isArray(res) ? res : (res && res.data ? res.data : (res && res.list ? res.list : [])) || [];
      this.setTagDisplayState(list, true);
    } catch (e) {
      this.setTagDisplayState([], true);
    }
  },

  setTagDisplayState(allTags, resetVisibleCount = false) {
    const total = Array.isArray(allTags) ? allTags.length : 0;
    const base = this.data.baseVisibleTagCount || 12;
    const visible = resetVisibleCount ? base : this.data.visibleTagCount;
    const safeVisible = Math.min(Math.max(visible, 0), total);
    this.setData({
      allTags,
      visibleTagCount: safeVisible || (total > 0 ? base : 0),
      displayedTags: (allTags || []).slice(0, safeVisible || 0),
      hasMoreTags: total > safeVisible,
    });
    this.refreshSelectedTagList();
  },

  expandMoreTags() {
    const total = this.data.allTags.length;
    const nextVisible = Math.min(this.data.visibleTagCount + 12, total);
    this.setData({
      visibleTagCount: nextVisible,
      displayedTags: this.data.allTags.slice(0, nextVisible),
      hasMoreTags: total > nextVisible,
    });
  },

  collapseTags() {
    const base = this.data.baseVisibleTagCount || 12;
    const total = this.data.allTags.length;
    const nextVisible = Math.min(base, total);
    this.setData({
      visibleTagCount: nextVisible,
      displayedTags: this.data.allTags.slice(0, nextVisible),
      hasMoreTags: total > nextVisible,
    });
  },

  refreshSelectedTagList() {
    const selectedIds = Array.isArray(this.data.form.tag_ids) ? this.data.form.tag_ids : [];
    const all = Array.isArray(this.data.allTags) ? this.data.allTags : [];
    const idToName = new Map(all.map(t => [ Number(t.id), t.name ]));
    const list = selectedIds
      .map(id => {
        const n = idToName.get(Number(id));
        return { id: Number(id), name: n ? String(n) : `标签#${id}` };
      })
      .filter(item => item.id && !Number.isNaN(item.id));
    this.setData({ selectedTagList: list });
  },

  async loadHotelDetail() {
    try {
      const item = await app.request({
        url: `/api/admin/hotels/${this.data.id}`,
        method: 'GET',
        needAuth: true,
      });
      if (!item) {
        wx.showToast({ title: '酒店不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      const policy = parsePolicyInfo(item.policy_info);
      const invoiceTypes = Array.isArray(policy.invoice && policy.invoice.types) ? policy.invoice.types.join(',') : '';
      const tagIds = Array.isArray(item.tags) ? item.tags.map(t => t.id) : [];
      this.setData({
        displayCover: item.cover_image ? app.fullImageUrl(item.cover_image) : '',
        form: {
          name: item.name || '',
          introduction: item.introduction || '',
          address: item.address || '',
          latitude: item.latitude != null ? String(item.latitude) : '',
          longitude: item.longitude != null ? String(item.longitude) : '',
          list_stock_tip: item.list_stock_tip || '',
          cover_image: item.cover_image || '',
          sort_order: item.sort_order != null ? item.sort_order : 0,
          status: item.status != null ? item.status : 1,
          tag_ids: tagIds,
          policy_check_in_from: (policy.check_in && policy.check_in.from) || '14:00',
          policy_check_in_to: (policy.check_in && policy.check_in.to) || '23:59',
          policy_check_in_note: (policy.check_in && policy.check_in.note) || '',
          policy_check_out_before: (policy.check_out && policy.check_out.before) || '12:00',
          policy_check_out_note: (policy.check_out && policy.check_out.note) || '',
          policy_deposit_required: !!(policy.deposit && policy.deposit.required === true),
          policy_deposit_amount: (policy.deposit && policy.deposit.amount != null) ? String(policy.deposit.amount) : '',
          policy_deposit_currency: (policy.deposit && policy.deposit.currency) || '元',
          policy_deposit_note: (policy.deposit && policy.deposit.note) || '',
          policy_invoice_supported: !!(policy.invoice && policy.invoice.supported === true),
          policy_invoice_types: invoiceTypes || '',
          policy_invoice_note: (policy.invoice && policy.invoice.note) || '',
          policy_child_free_rule: (policy.children_extra_bed && policy.children_extra_bed.child_free_rule) || '',
          policy_extra_bed_supported: !!(policy.children_extra_bed && policy.children_extra_bed.extra_bed_supported),
          policy_extra_bed_price: (policy.children_extra_bed && policy.children_extra_bed.extra_bed_price != null) ? String(policy.children_extra_bed.extra_bed_price) : '',
          policy_extra_bed_note: (policy.children_extra_bed && policy.children_extra_bed.extra_bed_note) || '',
          policy_rich_text_html: policy.rich_text_html || '',
        },
      });
      this.refreshSelectedTagList();
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' });
    }
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onSortOrderChange(e) {
    this.setData({ 'form.sort_order': parseInt(e.detail.value, 10) || 0 });
  },

  onStatusChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({ 'form.status': idx === 0 ? 1 : 0 });
  },

  onSwitchChange(e) {
    const { field } = e.currentTarget.dataset;
    const checked = !!e.detail.value;
    this.setData({ [`form.${field}`]: checked });

    if (field === 'policy_deposit_required' && !checked) {
      this.setData({
        'form.policy_deposit_amount': '',
        'form.policy_deposit_currency': '元',
      });
    }
    if (field === 'policy_invoice_supported' && !checked) {
      this.setData({
        'form.policy_invoice_types': '',
      });
    }
    if (field === 'policy_extra_bed_supported' && !checked) {
      this.setData({
        'form.policy_extra_bed_price': '',
      });
    }
  },

  toggleTag(e) {
    const rawId = e.currentTarget.dataset.id;
    const name = String(e.currentTarget.dataset.name || '').trim();
    const id = Number(rawId);
    let finalId = Number.isNaN(id) ? null : id;
    if (finalId == null && name) {
      const match = (this.data.allTags || []).find(t => String(t.name || '').trim() === name);
      if (match && match.id != null) finalId = Number(match.id);
    }
    if (finalId == null || Number.isNaN(finalId)) return;
    const current = Array.isArray(this.data.form.tag_ids) ? this.data.form.tag_ids : [];
    const idx = current.findIndex(t => Number(t) === finalId);
    const next = idx >= 0 ? current.filter(t => Number(t) !== finalId) : [ ...current, finalId ];
    this.setData({ 'form.tag_ids': next });
    this.refreshSelectedTagList();
  },

  removeSelectedTag(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (Number.isNaN(id)) return;
    const current = Array.isArray(this.data.form.tag_ids) ? this.data.form.tag_ids : [];
    this.setData({ 'form.tag_ids': current.filter(t => Number(t) !== id) });
    this.refreshSelectedTagList();
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const address = (res.address || '') ? `${res.name || ''} ${res.address}`.trim() : (res.name || '');
        this.setData({
          'form.address': address || res.address || res.name || '',
          'form.latitude': String(res.latitude),
          'form.longitude': String(res.longitude),
        });
      },
    });
  },

  async chooseCoverImage() {
    try {
      const r = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: [ 'compressed' ],
          sourceType: [ 'album', 'camera' ],
          success: resolve,
          fail: reject,
        });
      });
      if (!r.tempFilePaths || !r.tempFilePaths[0]) return;
      const url = await app.uploadImage(r.tempFilePaths[0], 'hotel');
      this.setData({
        'form.cover_image': url,
        displayCover: app.fullImageUrl(url),
      });
    } catch (e) {
      wx.showToast({ title: '上传失败', icon: 'none' });
    }
  },

  buildPolicyInfo() {
    const f = this.data.form;
    const invoiceTypes = (f.policy_invoice_types || '')
      .split(/[,，]/)
      .map(s => s.trim())
      .filter(Boolean);
    const depositAmount = Number(f.policy_deposit_amount);
    const extraBedPrice = Number(f.policy_extra_bed_price);
    return {
      check_in: {
        from: (f.policy_check_in_from || '').trim(),
        to: (f.policy_check_in_to || '').trim(),
        note: (f.policy_check_in_note || '').trim(),
      },
      check_out: {
        before: (f.policy_check_out_before || '').trim(),
        note: (f.policy_check_out_note || '').trim(),
      },
      deposit: {
        required: !!f.policy_deposit_required,
        amount: f.policy_deposit_required && !Number.isNaN(depositAmount) ? depositAmount : null,
        currency: (f.policy_deposit_currency || '元').trim() || '元',
        note: (f.policy_deposit_note || '').trim(),
      },
      invoice: {
        supported: !!f.policy_invoice_supported,
        types: f.policy_invoice_supported ? invoiceTypes : [],
        note: (f.policy_invoice_note || '').trim(),
      },
      children_extra_bed: {
        child_free_rule: (f.policy_child_free_rule || '').trim(),
        extra_bed_supported: !!f.policy_extra_bed_supported,
        extra_bed_price: Number.isNaN(extraBedPrice) ? null : extraBedPrice,
        extra_bed_note: (f.policy_extra_bed_note || '').trim(),
      },
      rich_text_html: (f.policy_rich_text_html || '').trim(),
    };
  },

  /** 将接口/文档里的 policy_info 对象写回表单字段 */
  policyObjectToForm(policy, baseForm) {
    const next = { ...baseForm };
    const p = policy;
    if (p.check_in && typeof p.check_in === 'object') {
      if (p.check_in.from != null && String(p.check_in.from).trim() !== '') next.policy_check_in_from = String(p.check_in.from).trim();
      if (p.check_in.to != null && String(p.check_in.to).trim() !== '') next.policy_check_in_to = String(p.check_in.to).trim();
      if (p.check_in.note != null) next.policy_check_in_note = String(p.check_in.note);
    }
    if (p.check_out && typeof p.check_out === 'object') {
      if (p.check_out.before != null && String(p.check_out.before).trim() !== '') {
        next.policy_check_out_before = String(p.check_out.before).trim();
      }
      if (p.check_out.note != null) next.policy_check_out_note = String(p.check_out.note);
    }
    if (p.deposit && typeof p.deposit === 'object') {
      next.policy_deposit_required = p.deposit.required === true;
      next.policy_deposit_amount = p.deposit.amount != null ? String(p.deposit.amount) : '';
      next.policy_deposit_currency = (p.deposit.currency && String(p.deposit.currency).trim()) || '元';
      next.policy_deposit_note = p.deposit.note != null ? String(p.deposit.note) : '';
      if (!next.policy_deposit_required) {
        next.policy_deposit_amount = '';
        next.policy_deposit_currency = '元';
      }
    }
    if (p.invoice && typeof p.invoice === 'object') {
      next.policy_invoice_supported = p.invoice.supported === true;
      next.policy_invoice_types = Array.isArray(p.invoice.types) ? p.invoice.types.join(',') : '';
      next.policy_invoice_note = p.invoice.note != null ? String(p.invoice.note) : '';
      if (!next.policy_invoice_supported) next.policy_invoice_types = '';
    }
    if (p.children_extra_bed && typeof p.children_extra_bed === 'object') {
      const c = p.children_extra_bed;
      next.policy_child_free_rule = c.child_free_rule != null ? String(c.child_free_rule) : '';
      next.policy_extra_bed_supported = c.extra_bed_supported === true;
      next.policy_extra_bed_price = c.extra_bed_price != null ? String(c.extra_bed_price) : '';
      next.policy_extra_bed_note = c.extra_bed_note != null ? String(c.extra_bed_note) : '';
      if (!next.policy_extra_bed_supported) next.policy_extra_bed_price = '';
    }
    if (Object.prototype.hasOwnProperty.call(p, 'rich_text_html')) {
      next.policy_rich_text_html = p.rich_text_html == null ? '' : String(p.rich_text_html);
    }
    return next;
  },

  /**
   * 富文本框误贴整段 policy_info JSON 时，解析并映射到表单项。
   * @returns {{ form: object|null, error: string|null }}
   */
  tryMergePolicyJsonFromRichField(form) {
    const raw = String(form.policy_rich_text_html || '').trim();
    if (!raw.startsWith('{')) return { form: null, error: null };
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      return { form: null, error: 'invalid_json' };
    }
    if (!looksLikePolicyInfoObject(obj)) {
      return { form: null, error: 'not_policy' };
    }
    return { form: this.policyObjectToForm(obj, form), error: null };
  },

  validateForm() {
    const f = this.data.form;
    if (!f.name || !f.name.trim()) {
      wx.showToast({ title: '请填写酒店名称', icon: 'none' });
      return false;
    }
    if (!f.cover_image) {
      wx.showToast({ title: '请上传封面图', icon: 'none' });
      return false;
    }

    if (f.latitude !== '' || f.longitude !== '') {
      const lat = Number(f.latitude);
      const lng = Number(f.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        wx.showToast({ title: '经纬度必须为数字', icon: 'none' });
        return false;
      }
      if (lat < -90 || lat > 90) {
        wx.showToast({ title: '纬度范围应为-90~90', icon: 'none' });
        return false;
      }
      if (lng < -180 || lng > 180) {
        wx.showToast({ title: '经度范围应为-180~180', icon: 'none' });
        return false;
      }
    }

    if (!isValidTimeText(f.policy_check_in_from) || !isValidTimeText(f.policy_check_in_to)) {
      wx.showToast({ title: '入住时间格式应为HH:mm', icon: 'none' });
      return false;
    }
    if (!isValidTimeText(f.policy_check_out_before)) {
      wx.showToast({ title: '退房时间格式应为HH:mm', icon: 'none' });
      return false;
    }

    if (f.policy_deposit_required) {
      const amount = Number(f.policy_deposit_amount);
      if (f.policy_deposit_amount === '' || Number.isNaN(amount) || amount <= 0) {
        wx.showToast({ title: '押金金额需大于0', icon: 'none' });
        return false;
      }
    }

    if (f.policy_invoice_supported && !(f.policy_invoice_types || '').trim()) {
      wx.showToast({ title: '请填写发票类型', icon: 'none' });
      return false;
    }

    const rich = String(f.policy_rich_text_html || '').trim();
    if (rich.startsWith('[')) {
      wx.showToast({ title: '富文本不能填 JSON 数组', icon: 'none' });
      return false;
    }

    if (f.policy_extra_bed_supported && (f.policy_extra_bed_price || '').trim()) {
      const extraBedPrice = Number(f.policy_extra_bed_price);
      if (Number.isNaN(extraBedPrice) || extraBedPrice < 0) {
        wx.showToast({ title: '加床费用不能小于0', icon: 'none' });
        return false;
      }
    }
    return true;
  },

  async save() {
    if (this.data.loading) return;

    const { form: mergedForm, error: mergeErr } = this.tryMergePolicyJsonFromRichField(this.data.form);
    if (mergeErr === 'invalid_json') {
      wx.showToast({ title: '富文本框内 JSON 格式有误', icon: 'none' });
      return;
    }
    if (mergeErr === 'not_policy') {
      wx.showToast({ title: '富文本请填 HTML 或纯文字，勿贴无关 JSON', icon: 'none' });
      return;
    }
    if (mergedForm) {
      await new Promise(resolve => {
        this.setData({ form: mergedForm }, resolve);
      });
      wx.showToast({ title: '已把政策 JSON 拆到上方表单项', icon: 'none' });
    }

    if (!this.validateForm()) return;

    const f = this.data.form;
    const payload = {
      name: f.name.trim(),
      introduction: (f.introduction || '').trim(),
      address: (f.address || '').trim() || null,
      latitude: f.latitude !== '' ? Number(f.latitude) : null,
      longitude: f.longitude !== '' ? Number(f.longitude) : null,
      list_stock_tip: (f.list_stock_tip || '').trim() || null,
      cover_image: f.cover_image || null,
      sort_order: parseInt(f.sort_order, 10) || 0,
      status: f.status === 0 ? 0 : 1,
      tag_ids: Array.isArray(f.tag_ids) ? f.tag_ids : [],
      policy_info: this.buildPolicyInfo(),
    };
    this.setData({ loading: true });
    wx.showLoading({ title: '保存中...' });
    try {
      if (this.data.isEdit) {
        await app.request({
          url: `/api/admin/hotels/${this.data.id}`,
          method: 'PUT',
          needAuth: true,
          data: payload,
        });
      } else {
        await app.request({
          url: '/api/admin/hotels',
          method: 'POST',
          needAuth: true,
          data: payload,
        });
      }
      wx.hideLoading();
      wx.setStorageSync('admin_hotel_need_refresh', true);
      wx.showToast({ title: this.data.isEdit ? '更新成功' : '创建成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: e.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  cancel() {
    wx.navigateBack();
  },
});

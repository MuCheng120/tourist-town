// 管理端景点编辑/发布页面（与数据表及用户端详情页字段一致）
const app = getApp()

const OPEN_STATUS_OPTIONS = [
  { value: 'open', label: '开放中' },
  { value: 'closed', label: '暂停开放' },
  { value: 'limit', label: '限流中' },
]

const HHMM_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/
const OPEN_TIME_RANGE_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)\s*-\s*([01]?\d|2[0-3]):([0-5]\d)$/

Page({
  data: {
    id: null,
    isEdit: false,
    openStatusOptions: OPEN_STATUS_OPTIONS,
    form: {
      name: '',
      cover_image: '',
      images: [],
      address: '',
      latitude: '',
      longitude: '',
      open_time: '',
      open_status: 'open',
      stop_sale_time: '',
      stop_entry_time: '',
      price: '',
      ticket_types: [],
      description: '',
      tags: [],
      daily_capacity: 100,
      status: 1,
      is_recommend: 0,
    },
    displayCover: '',
    displayImages: [],
    availableTags: [],
    displayedTags: [],
    baseVisibleTagCount: 5,
    visibleTagCount: 5,
    hasMoreTags: false,
    newTagName: '',
    loading: false,
    openStatusIndex: 0, // picker 选中的索引，0=开放中 1=暂停开放 2=限流中
  },

  onLoad(options) {
    this.loadAvailableTags()
    if (options.id) {
      this.setData({ id: options.id, isEdit: true })
      this.loadSpotDetail()
    }
  },

  async loadAvailableTags() {
    try {
      const res = await app.request({
        url: '/api/admin/tags',
        method: 'GET',
        needAuth: true,
      })
      const list = Array.isArray(res) ? res : (res.list || res.data || [])
      const names = list.map(item => item && item.name ? String(item.name).trim() : '').filter(Boolean)
      this.setTagDisplayState(Array.from(new Set(names)), true)
    } catch (error) {
      console.error('加载标签列表失败:', error)
      this.setTagDisplayState([], true)
    }
  },

  setTagDisplayState(availableTags, resetVisibleCount = false) {
    const total = Array.isArray(availableTags) ? availableTags.length : 0
    const base = this.data.baseVisibleTagCount || 5
    const nextVisible = resetVisibleCount ? base : this.data.visibleTagCount
    const safeVisible = Math.min(nextVisible || base, total)
    this.setData({
      availableTags,
      visibleTagCount: safeVisible || (total > 0 ? base : 0),
      displayedTags: (availableTags || []).slice(0, safeVisible || 0),
      hasMoreTags: total > safeVisible,
    })
  },

  expandMoreTags() {
    const total = this.data.availableTags.length
    const nextVisible = Math.min(this.data.visibleTagCount + 10, total)
    this.setData({
      visibleTagCount: nextVisible,
      displayedTags: this.data.availableTags.slice(0, nextVisible),
      hasMoreTags: total > nextVisible,
    })
  },

  collapseTags() {
    const base = this.data.baseVisibleTagCount || 5
    const total = this.data.availableTags.length
    const nextVisible = Math.min(base, total)
    this.setData({
      visibleTagCount: nextVisible,
      displayedTags: this.data.availableTags.slice(0, nextVisible),
      hasMoreTags: total > nextVisible,
    })
  },

  // 加载景点详情
  async loadSpotDetail() {
    try {
      const res = await app.request({
        url: `/api/scenic-spots/${this.data.id}`,
        method: 'GET',
        needAuth: true,
      })

      const spot = res.data || res
      const cover = spot.cover_image || ''
      const images = Array.isArray(spot.images) ? spot.images : (spot.images ? [] : [])
      const address = spot.address || ''
      const ticketTypes = Array.isArray(spot.ticket_types) ? spot.ticket_types : []
      const detailTagList = Array.isArray(spot.tag_list) ? spot.tag_list : []
      const detailTagNames = detailTagList.map(t => t && t.name ? String(t.name).trim() : '').filter(Boolean)
      const fallbackTagNames = Array.isArray(spot.tags) ? spot.tags.map(t => String(t).trim()).filter(Boolean) : []
      const selectedTagNames = Array.from(new Set([ ...detailTagNames, ...fallbackTagNames ]))

      this.setData({
        'form.name': spot.name || '',
        'form.cover_image': cover,
        'form.images': images,
        displayCover: app.fullImageUrl(cover),
        displayImages: app.fullImageUrls(images),
        'form.address': address,
        'form.latitude': spot.latitude != null ? String(spot.latitude) : '',
        'form.longitude': spot.longitude != null ? String(spot.longitude) : '',
        'form.open_time': spot.open_time || '',
        'form.open_status': spot.open_status || 'open',
        openStatusIndex: (() => { const i = OPEN_STATUS_OPTIONS.findIndex(o => o.value === (spot.open_status || 'open')); return i >= 0 ? i : 0; })(),
        'form.stop_sale_time': spot.stop_sale_time || '',
        'form.stop_entry_time': spot.stop_entry_time || '',
        'form.price': spot.price != null ? String(spot.price) : '',
        'form.ticket_types': ticketTypes.map((item, index) => ({
          type: item.type || `custom_${index + 1}`,
          name: item.name || '',
          price: item.price != null ? String(item.price) : '',
          remark: item.remark || '',
        })),
        'form.description': spot.description || '',
        'form.tags': selectedTagNames,
        'form.daily_capacity': spot.daily_capacity != null ? spot.daily_capacity : 100,
        'form.status': spot.status !== undefined ? spot.status : 1,
        'form.is_recommend': spot.is_recommend ? 1 : 0,
      })
    } catch (error) {
      console.error('加载景点详情失败:', error)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  chooseCoverImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        try {
          wx.showLoading({ title: '上传中...' })
          const uploadRes = await this.uploadImage(tempFilePath)
          wx.hideLoading()
          this.setData({
            'form.cover_image': uploadRes.url,
            displayCover: app.fullImageUrl(uploadRes.url),
          })
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (error) {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      },
    })
  },

  chooseImages() {
    const maxCount = 9 - this.data.form.images.length
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: maxCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePaths = res.tempFilePaths
        wx.showLoading({ title: '上传中...' })
        try {
          const uploadPromises = tempFilePaths.map(path => this.uploadImage(path))
          const uploadResults = await Promise.all(uploadPromises)
          wx.hideLoading()
          const newImages = uploadResults.map(item => item.url)
          const allImages = [...this.data.form.images, ...newImages]
          this.setData({
            'form.images': allImages,
            displayImages: app.fullImageUrls(allImages),
          })
          wx.showToast({ title: '上传成功', icon: 'success' })
        } catch (error) {
          wx.hideLoading()
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      },
    })
  },

  uploadImage(filePath) {
    const base = app.globalData.baseUrl || app.globalData.apiBaseUrl || ''
    const url = `${base}/api/upload?module=scenic`
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath,
        name: 'file',
        header: {
          Authorization: `Bearer ${wx.getStorageSync('token')}`,
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.code === 200 && data.data) resolve(data.data)
            else reject(new Error(data.message || '上传失败'))
          } catch (e) {
            reject(new Error('上传失败'))
          }
        },
        fail: reject,
      })
    })
  },

  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.form.images.slice()
    images.splice(index, 1)
    this.setData({ 'form.images': images, displayImages: app.fullImageUrls(images) })
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        const address = (res.address || '') + (res.name || '')
        this.setData({
          'form.address': address,
          'form.latitude': res.latitude,
          'form.longitude': res.longitude,
        })
      },
    })
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    this.setData({ [`form.${field}`]: value })
  },

  addTicketType() {
    const list = Array.isArray(this.data.form.ticket_types) ? this.data.form.ticket_types.slice() : []
    list.push({
      type: `custom_${Date.now()}`,
      name: '',
      price: '',
      remark: '',
    })
    this.setData({ 'form.ticket_types': list })
  },

  removeTicketType(e) {
    const index = Number(e.currentTarget.dataset.index)
    const list = Array.isArray(this.data.form.ticket_types) ? this.data.form.ticket_types.slice() : []
    if (Number.isNaN(index) || index < 0 || index >= list.length) return
    list.splice(index, 1)
    this.setData({ 'form.ticket_types': list })
  },

  onTicketTypeFieldChange(e) {
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const list = Array.isArray(this.data.form.ticket_types) ? this.data.form.ticket_types.slice() : []
    if (Number.isNaN(index) || index < 0 || index >= list.length) return
    list[index] = {
      ...list[index],
      [field]: value,
    }
    this.setData({ 'form.ticket_types': list })
  },

  onOpenStatusChange(e) {
    const idx = parseInt(e.detail.value, 10)
    const value = OPEN_STATUS_OPTIONS[idx] ? OPEN_STATUS_OPTIONS[idx].value : 'open'
    this.setData({ 'form.open_status': value, openStatusIndex: idx })
  },

  onStatusChange(e) {
    this.setData({ 'form.status': e.detail.value ? 1 : 0 })
  },

  onRecommendChange(e) {
    this.setData({ 'form.is_recommend': e.detail.value ? 1 : 0 })
  },

  toggleTagOption(e) {
    const name = (e.currentTarget.dataset.name || '').trim()
    if (!name) return
    const current = Array.isArray(this.data.form.tags) ? this.data.form.tags.slice() : []
    const idx = current.indexOf(name)
    if (idx >= 0) current.splice(idx, 1)
    else current.push(name)
    this.setData({ 'form.tags': current })
  },

  removeSelectedTag(e) {
    const name = (e.currentTarget.dataset.name || '').trim()
    if (!name) return
    const current = Array.isArray(this.data.form.tags) ? this.data.form.tags.filter(item => item !== name) : []
    this.setData({ 'form.tags': current })
  },

  onNewTagInput(e) {
    this.setData({ newTagName: (e.detail.value || '').trimStart() })
  },

  async createTag() {
    const name = (this.data.newTagName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' })
      return
    }
    try {
      wx.showLoading({ title: '新增中...' })
      await app.request({
        url: '/api/admin/tags',
        method: 'POST',
        needAuth: true,
        data: { name },
      })
      const availableTags = Array.from(new Set([ ...(this.data.availableTags || []), name ]))
      const selectedTags = Array.from(new Set([ ...(this.data.form.tags || []), name ]))
      this.setTagDisplayState(availableTags, false)
      this.setData({ 'form.tags': selectedTags, newTagName: '' })
      wx.showToast({ title: '标签已添加', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '新增标签失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  validateForm() {
    const { name, cover_image, address, description, latitude, longitude, price, open_time, stop_sale_time, stop_entry_time, ticket_types } = this.data.form
    if (!name || !name.trim()) {
      wx.showToast({ title: '请输入景点名称', icon: 'none' })
      return false
    }
    if (!cover_image) {
      wx.showToast({ title: '请上传封面图', icon: 'none' })
      return false
    }
    if (!address || !address.trim()) {
      wx.showToast({ title: '请选择景点位置', icon: 'none' })
      return false
    }
    if (latitude === '' || longitude === '') {
      wx.showToast({ title: '请选择位置生成经纬度', icon: 'none' })
      return false
    }
    const latNum = Number(latitude)
    const lngNum = Number(longitude)
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      wx.showToast({ title: '纬度范围应为-90~90', icon: 'none' })
      return false
    }
    if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      wx.showToast({ title: '经度范围应为-180~180', icon: 'none' })
      return false
    }
    if (price === '' || Number.isNaN(Number(price)) || Number(price) < 0) {
      wx.showToast({ title: '请填写有效门票价格', icon: 'none' })
      return false
    }
    const openTimeText = (open_time || '').trim()
    if (openTimeText && !OPEN_TIME_RANGE_PATTERN.test(openTimeText)) {
      wx.showToast({ title: '开放时间格式应为 HH:mm-HH:mm', icon: 'none' })
      return false
    }
    const stopSaleText = (stop_sale_time || '').trim()
    if (stopSaleText && !HHMM_PATTERN.test(stopSaleText)) {
      wx.showToast({ title: '停售时间格式应为 HH:mm', icon: 'none' })
      return false
    }
    const stopEntryText = (stop_entry_time || '').trim()
    if (stopEntryText && !HHMM_PATTERN.test(stopEntryText)) {
      wx.showToast({ title: '止入时间格式应为 HH:mm', icon: 'none' })
      return false
    }
    const validTicketTypes = (Array.isArray(ticket_types) ? ticket_types : []).filter(item => item && String(item.name || '').trim())
    for (const item of validTicketTypes) {
      const p = Number(item.price)
      if (String(item.name || '').trim().length === 0) {
        wx.showToast({ title: '票种名称不能为空', icon: 'none' })
        return false
      }
      if (Number.isNaN(p) || p < 0) {
        wx.showToast({ title: `票种【${item.name || '未命名'}】价格无效`, icon: 'none' })
        return false
      }
    }
    if (!description || !description.trim()) {
      wx.showToast({ title: '请输入景点描述', icon: 'none' })
      return false
    }
    return true
  },

  async save() {
    if (!this.validateForm() || this.data.loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: '保存中...' })

    try {
      const { form, id } = this.data
      const url = id ? `/api/scenic-spots/${id}` : '/api/scenic-spots'
      const method = id ? 'PUT' : 'POST'

      const payload = {
        name: form.name.trim(),
        cover_image: form.cover_image,
        images: form.images,
        address: form.address.trim(),
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        open_time: (form.open_time || '').trim() || null,
        open_status: form.open_status || 'open',
        stop_sale_time: (form.stop_sale_time || '').trim() || null,
        stop_entry_time: (form.stop_entry_time || '').trim() || null,
        price: form.price !== '' ? parseFloat(form.price) : 0,
        ticket_types: (Array.isArray(form.ticket_types) ? form.ticket_types : [])
          .map((item, index) => ({
            type: (item.type && String(item.type).trim()) || `custom_${index + 1}`,
            name: String(item.name || '').trim(),
            price: item.price !== '' ? parseFloat(item.price) : null,
            remark: String(item.remark || '').trim(),
          }))
          .filter(item => item.name && item.price != null && !Number.isNaN(item.price) && item.price >= 0),
        description: (form.description || '').trim(),
        daily_capacity: form.daily_capacity != null ? parseInt(form.daily_capacity, 10) : 100,
        status: form.status,
        is_recommend: form.is_recommend ? 1 : 0,
      }
      if (form.tags && form.tags.length) payload.tags = Array.from(new Set(form.tags.map(t => String(t).trim()).filter(Boolean)))

      await app.request({
        url,
        method,
        needAuth: true,
        data: payload,
      })

      wx.hideLoading()
      this.setData({ loading: false })

      // app.request 在业务失败时会 reject，这里能走到即表示成功
      wx.showToast({ title: id ? '更新成功' : '创建成功', icon: 'success' })
      wx.setStorageSync('admin_scenic_need_refresh', true)
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (error) {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    }
  },

  cancel() {
    wx.navigateBack()
  },
})

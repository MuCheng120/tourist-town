// 管理端记录商户违规页面
const app = getApp()

Page({
  data: {
    merchantId: null,
    merchantName: '',
    form: {
      violation_type: '',
      reason: ''
    },
    violationTypes: [
      { value: 'warning', label: '警告' },
      { value: 'limit', label: '限流' },
      { value: 'suspend', label: '暂停营业' },
      { value: 'revoke', label: '注销' }
    ],
    typeIndex: -1,
    loading: false
  },

  onLoad(options) {
    if (options.id && options.name) {
      this.setData({
        merchantId: options.id,
        merchantName: decodeURIComponent(options.name)
      })
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  // 选择违规类型
  onTypeChange(e) {
    const index = parseInt(e.detail.value)
    const type = this.data.violationTypes[index]
    this.setData({
      typeIndex: index,
      'form.violation_type': type.value
    })
  },

  // 违规原因输入
  onReasonInput(e) {
    this.setData({
      'form.reason': e.detail.value
    })
  },

  // 表单验证
  validateForm() {
    const { violation_type, reason } = this.data.form

    if (!violation_type) {
      wx.showToast({
        title: '请选择违规类型',
        icon: 'none'
      })
      return false
    }

    if (!reason || !reason.trim()) {
      wx.showToast({
        title: '请输入违规原因',
        icon: 'none'
      })
      return false
    }

    if (reason.length < 10) {
      wx.showToast({
        title: '违规原因至少10个字符',
        icon: 'none'
      })
      return false
    }

    return true
  },

  // 提交违规记录
  async submit() {
    if (!this.validateForm()) return
    if (this.data.loading) return

    this.setData({ loading: true })
    wx.showLoading({ title: '提交中...' })

    try {
      const res = await app.request({
        url: '/api/merchant-credit/violation',
        method: 'POST',
        needAuth: true,
        data: {
          merchant_id: parseInt(this.data.merchantId),
          violation_type: this.data.form.violation_type,
          reason: this.data.form.reason
        }
      })

      wx.hideLoading()
      this.setData({ loading: false })

      if (res.success) {
        wx.showToast({
          title: '记录成功',
          icon: 'success'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (error) {
      wx.hideLoading()
      this.setData({ loading: false })
      console.error('提交失败:', error)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    }
  },

  // 取消
  cancel() {
    wx.navigateBack()
  }
})

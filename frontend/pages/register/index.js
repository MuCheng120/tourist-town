const app = getApp()

Page({
  data: {
    username: '',
    phone: '',
    role: 'consumer', // 默认为游客
    gender: 'male',
    password: '',
    confirmPassword: '',
    businessName: '', // 商家名称（仅商家身份需要）
    contact: '', // 商家联系方式（仅商家身份需要）
    licenseNo: '', // 营业执照号（仅商家身份需要）
    licenseExpiry: '', // 执照到期日期（YYYY-MM-DD）
    licenseFileList: [], // 营业执照照片
    qualificationFileList: [], // 资质文件（支持图片或 PDF）
    qualificationFileExtension: ['pdf', 'jpg', 'jpeg', 'png'],
    idCardFrontFileList: [], // 法人身份证正面
    idCardBackFileList: [], // 法人身份证反面
    merchantAddress: '', // 经营地址
    merchantDesc: '', // 商家简介
    loading: false,
    isUsernameUnique: true,
    usernameCheckTimer: null,
    canSubmit: false,
  },

  onLoad() {},

  recomputeCanSubmit() {
    const {
      username,
      phone,
      role,
      gender,
      password,
      confirmPassword,
      isUsernameUnique,
      businessName,
      contact,
      licenseNo,
      licenseExpiry,
      licenseFileList,
      qualificationFileList,
      idCardFrontFileList,
      idCardBackFileList,
      merchantAddress,
    } = this.data

    const baseValid = (
      username.length > 0 &&
      phone.length > 0 &&
      role &&
      gender &&
      password.length >= 8 &&
      password.length <= 20 &&
      password === confirmPassword &&
      isUsernameUnique
    )

    const merchantExtraValid = role !== 'merchant' || (
      businessName.length > 0 &&
      contact.length > 0 &&
      licenseFileList.length === 1 &&
      qualificationFileList.length > 0 &&
      idCardFrontFileList.length === 1 &&
      idCardBackFileList.length === 1
    )

    const canSubmit = baseValid && merchantExtraValid
    if (canSubmit !== this.data.canSubmit) {
      this.setData({ canSubmit })
    }
  },

  // 用户名输入（防抖）
  onUsernameChange(e) {
    const username = e.detail
    this.setData({ username })

    // 清除之前的定时器
    if (this.data.usernameCheckTimer) {
      clearTimeout(this.data.usernameCheckTimer)
    }

    // 只有输入长度大于0才检查
    if (username.length > 0) {
      // 500ms 防抖
      const timer = setTimeout(() => {
        this.checkUsernameUnique(username)
      }, 500)
      this.setData({ usernameCheckTimer: timer })
    } else {
      this.setData({ isUsernameUnique: true })
    }
    this.recomputeCanSubmit()
  },

  // 检查用户名唯一性
  async checkUsernameUnique(username) {
    try {
      const res = await app.request({
        url: '/api/user/check-username',
        method: 'GET',
        data: { username }
      })
      this.setData({ isUsernameUnique: !!res.unique })
    } catch (error) {
      console.error('检查用户名失败:', error)
      // 网络错误时不阻止用户继续
      this.setData({ isUsernameUnique: true })
    } finally {
      this.recomputeCanSubmit()
    }
  },

  // 手机号输入
  onPhoneChange(e) {
    this.setData({ phone: e.detail })
    this.recomputeCanSubmit()
  },

  // 身份选择
  onRoleChange(e) {
    const role = e.detail
    const nextData = { role }
    // 切回游客时，清空商家资料，避免误提交
    if (role !== 'merchant') {
      Object.assign(nextData, {
        businessName: '',
        contact: '',
        licenseNo: '',
        licenseExpiry: '',
        licenseFileList: [],
        qualificationFileList: [],
        idCardFrontFileList: [],
        idCardBackFileList: [],
        merchantAddress: '',
        merchantDesc: '',
      })
    }
    this.setData(nextData)
    this.recomputeCanSubmit()
  },

  // 性别选择
  onGenderChange(e) {
    this.setData({ gender: e.detail })
    this.recomputeCanSubmit()
  },

  // 密码输入
  onPasswordChange(e) {
    this.setData({ password: e.detail })
    this.recomputeCanSubmit()
  },

  // 确认密码输入
  onConfirmPasswordChange(e) {
    this.setData({ confirmPassword: e.detail })
    this.recomputeCanSubmit()
  },

  // 商家名称输入
  onBusinessNameChange(e) {
    this.setData({ businessName: e.detail })
    this.recomputeCanSubmit()
  },

  // 商家联系方式输入
  onContactChange(e) {
    this.setData({ contact: e.detail })
    this.recomputeCanSubmit()
  },

  onLicenseNoChange(e) {
    this.setData({ licenseNo: e.detail })
    this.recomputeCanSubmit()
  },

  onLicenseExpiryChange(e) {
    this.setData({ licenseExpiry: e.detail.value })
    this.recomputeCanSubmit()
  },

  onMerchantAddressChange(e) {
    this.setData({ merchantAddress: e.detail })
    this.recomputeCanSubmit()
  },

  onMerchantDescChange(e) {
    this.setData({ merchantDesc: e.detail })
  },

  addFilesToList(currentList, file) {
    const files = Array.isArray(file) ? file : [ file ]
    const normalized = files
      .map(f => {
        if (!f) return null
        const url = f.url || f.path || f.tempFilePath || (typeof f === 'string' ? f : null)
        return url ? { url } : null
      })
      .filter(Boolean)
    return currentList.concat(normalized)
  },

  onLicenseAfterRead(e) {
    const next = this.addFilesToList([], e.detail.file)
    this.setData({ licenseFileList: next })
    this.recomputeCanSubmit()
  },

  onLicenseDelete() {
    this.setData({ licenseFileList: [] })
    this.recomputeCanSubmit()
  },

  onQualificationAfterRead(e) {
    const next = this.addFilesToList(this.data.qualificationFileList, e.detail.file)
    this.setData({ qualificationFileList: next })
    this.recomputeCanSubmit()
  },

  onQualificationDelete(e) {
    const { index } = e.detail
    const list = this.data.qualificationFileList.slice()
    list.splice(index, 1)
    this.setData({ qualificationFileList: list })
    this.recomputeCanSubmit()
  },

  onIdCardFrontAfterRead(e) {
    const next = this.addFilesToList([], e.detail.file).slice(0, 1)
    this.setData({ idCardFrontFileList: next })
    this.recomputeCanSubmit()
  },

  onIdCardFrontDelete() {
    this.setData({ idCardFrontFileList: [] })
    this.recomputeCanSubmit()
  },

  onIdCardBackAfterRead(e) {
    const next = this.addFilesToList([], e.detail.file).slice(0, 1)
    this.setData({ idCardBackFileList: next })
    this.recomputeCanSubmit()
  },

  onIdCardBackDelete() {
    this.setData({ idCardBackFileList: [] })
    this.recomputeCanSubmit()
  },

  async uploadFileList(fileList, module = 'merchant', uploadType = 'image') {
    const urls = []
    const upload = uploadType === 'file' ? app.uploadFile.bind(app) : app.uploadImage.bind(app)
    for (const item of fileList) {
      const local = item && item.url
      if (!local) continue
      if (typeof local === 'string' && (local.startsWith('/uploads/') || local.startsWith('/public/uploads/'))) {
        urls.push(local)
        continue
      }
      const url = await upload(local, module)
      urls.push(url)
    }
    return urls
  },

  // 注册
  async handleRegister() {
    this.recomputeCanSubmit()
    if (!this.data.canSubmit) {
      return
    }

    const {
      username,
      phone,
      role,
      gender,
      password,
      businessName,
      contact,
      licenseNo,
      licenseExpiry,
      licenseFileList,
      qualificationFileList,
      idCardFrontFileList,
      idCardBackFileList,
      merchantAddress,
      merchantDesc,
    } = this.data

    // 表单验证
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      wx.showToast({
        title: '用户名必须为3-20位字母、数字或下划线',
        icon: 'none'
      })
      return
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      })
      return
    }

    // 8-20 位，须含字母、数字和特殊符号
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"|,.<>/?])[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"|,.<>/?]{8,20}$/.test(password)) {
      wx.showToast({
        title: '密码须为 8-20 位，且同时包含字母、数字和特殊符号',
        icon: 'none'
      })
      return
    }

    // 如果选择了商家身份，校验商家相关信息（含资质）
    if (role === 'merchant') {
      if (!businessName) {
        wx.showToast({
          title: '请输入商家名称',
          icon: 'none'
        })
        return
      }

      if (!contact || !contact.trim()) {
        wx.showToast({
          title: '请输入商家联系方式',
          icon: 'none'
        })
        return
      }
      // 联系方式须为手机号或微信号（6-20位字母/数字/下划线/减号）
      const phoneReg = /^1[3-9]\d{9}$/
      const wechatReg = /^[a-zA-Z0-9_-]{6,20}$/
      if (!phoneReg.test(contact.trim()) && !wechatReg.test(contact.trim())) {
        wx.showToast({
          title: '联系方式请填写手机号或微信号',
          icon: 'none'
        })
        return
      }

      if (licenseFileList.length !== 1) {
        wx.showToast({
          title: '请上传营业执照照片',
          icon: 'none'
        })
        return
      }

      if (qualificationFileList.length === 0) {
        wx.showToast({
          title: '请上传资质文件',
          icon: 'none'
        })
        return
      }

      if (idCardFrontFileList.length !== 1) {
        wx.showToast({
          title: '请上传身份证正面',
          icon: 'none'
        })
        return
      }
      if (idCardBackFileList.length !== 1) {
        wx.showToast({
          title: '请上传身份证反面',
          icon: 'none'
        })
        return
      }
    }

    this.setData({ loading: true })

    try {
      const payload = {
        username,
        phone,
        gender,
        password,
      }

      const res = await app.request({
        url: '/api/user/register',
        method: 'POST',
        data: payload
      })

      // 保存token
      if (res.token) {
        wx.setStorageSync('token', res.token)
        wx.setStorageSync('userInfo', res.userInfo)
        app.globalData.token = res.token
        app.globalData.userInfo = res.userInfo
      }

      // 若选择商家身份：营业执照/身份证存 images，资质文件存 files
      if (role === 'merchant') {
        const licenseImages = await this.uploadFileList(licenseFileList)
        const qualificationImages = await this.uploadFileList(qualificationFileList, 'merchant', 'file')
        const [frontUrls, backUrls] = await Promise.all([
          this.uploadFileList(idCardFrontFileList),
          this.uploadFileList(idCardBackFileList),
        ])

        await app.request({
          url: '/api/user/apply-merchant',
          method: 'POST',
          needAuth: true,
          data: {
            business_name: businessName,
            contact,
            license_no: licenseNo,
            license_expiry: licenseExpiry,
            license_images: licenseImages,
            qualification_images: qualificationImages,
            idcard_front: frontUrls[0] || '',
            idcard_back: backUrls[0] || '',
            address: merchantAddress,
            description: merchantDesc,
          },
        })
      }

      wx.showToast({
        title: role === 'merchant' ? '注册成功，已提交商家申请' : '注册成功',
        icon: 'success'
      })

      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }, 1500)

    } catch (error) {
      console.error('注册失败:', error)
      wx.showToast({
        title: error.message || '注册失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 跳转到登录页
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/index'
    })
  }
})

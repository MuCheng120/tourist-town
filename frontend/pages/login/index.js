const app = getApp()

Page({
  data: {
    account: '',
    password: '',
    loading: false,
    canSubmit: false,
    showPassword: false,
    // 是否管理员登录模式
    isAdminLogin: false,
  },

  // 账号输入
  onAccountChange(e) {
    const account = e.detail
    const { password } = this.data
    this.setData({ 
      account,
      canSubmit: account.length > 0 && password.length > 0
    })
  },

  // 密码输入
  onPasswordChange(e) {
    const password = e.detail
    const { account } = this.data
    this.setData({ 
      password,
      canSubmit: account.length > 0 && password.length > 0
    })
  },

  // 账号密码登录
  async handleLogin() {
    if (!this.data.canSubmit) {
      return
    }

    const { account, password, isAdminLogin } = this.data

    // 表单验证
    if (password.length < 8) {
      wx.showToast({
        title: '密码不能少于8位',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })

    try {
      const url = isAdminLogin ? '/api/user/admin-login' : '/api/user/login'
      const payload = isAdminLogin
        ? { username: account, password }
        : { account, password }

      const res = await app.request({
        url,
        method: 'POST',
        data: payload,
      })

      // 检查响应结构（app.request 返回的是 res.data.data）
      if (!res) {
        throw new Error('登录响应数据格式错误')
      }

      wx.showToast({
        title: isAdminLogin ? '管理员登录成功' : '登录成功',
        icon: 'success',
      })

      // 保存token和用户信息（res 直接就是 { token, userInfo }）
      if (res.token) {
        wx.setStorageSync('token', res.token)
        wx.setStorageSync('userInfo', res.userInfo)
        
        // 更新全局数据
        app.globalData.token = res.token
        app.globalData.userInfo = res.userInfo
      }

      // 根据角色跳转到对应页面
      setTimeout(() => {
        const role = res.userInfo?.role || 'consumer'
        
        if (role === 'merchant') {
          wx.reLaunch({ url: '/merchant/pages/dashboard/index' })
        } else if (role === 'admin') {
          wx.reLaunch({ url: '/admin/pages/dashboard/index' })
        } else {
          // 游客端使用 switchTab 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          })
        }
      }, 1500)

    } catch (error) {
      console.error('登录失败:', error)
      const statusCode = error && error.statusCode
      // 5xx（如 502）或请求失败：只提示一次，避免与 app.request 的「网络错误」重复
      if (statusCode >= 500 || (!statusCode && !error.message)) {
        wx.showToast({
          title: '无法连接服务器，请确认后端已启动（端口7001）',
          icon: 'none'
        })
        return
      }
      let errorMessage = isAdminLogin ? '管理员登录失败' : '登录失败'
      if (error) {
        if (error.message) {
          errorMessage = error.message
        } else if (error.data && error.data.message) {
          errorMessage = error.data.message
        } else if (typeof error === 'string') {
          errorMessage = error
        }
      }
      wx.showToast({
        title: errorMessage,
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 微信登录
  async handleWechatLogin() {
    wx.showLoading({
      title: '登录中...',
      mask: true
    })

    try {
      // 1. 调用微信登录获取 code
      const loginRes = await wx.login()
      
      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败')
      }

      // 2. 发送 code 到后端换取 openid
      const res = await app.request({
        url: '/api/user/wechat-login',
        method: 'POST',
        data: {
          code: loginRes.code
        }
      })

      wx.hideLoading()

      // 3. 判断是否需要注册
      if (res.needRegister) {
        // 需要注册，保存临时 openid，跳转到注册页
        wx.setStorageSync('tempOpenid', res.openid)
        wx.showModal({
          title: '提示',
          content: '微信账号未绑定，请先完成注册',
          showCancel: false,
          success: () => {
            wx.navigateTo({
              url: '/pages/register/index'
            })
          }
        })
      } else {
        // 已注册，直接登录成功
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 保存token和用户信息
        if (res.token) {
          wx.setStorageSync('token', res.token)
          wx.setStorageSync('userInfo', res.userInfo)
          
          // 更新全局数据
          app.globalData.token = res.token
          app.globalData.userInfo = res.userInfo
        }

        // 根据角色跳转到对应页面
        setTimeout(() => {
          const role = res.userInfo?.role || 'consumer'
          
          if (role === 'merchant') {
            wx.reLaunch({ url: '/merchant/pages/dashboard/index' })
          } else if (role === 'admin') {
            wx.reLaunch({ url: '/admin/pages/dashboard/index' })
          } else {
            // 游客端使用 switchTab 跳转到首页
            wx.switchTab({
              url: '/pages/index/index'
            })
          }
        }, 1500)
      }

    } catch (error) {
      console.error('微信登录失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: error.message || '微信登录失败',
        icon: 'none'
      })
    }
  },

  // 切换密码显示/隐藏
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    })
  },

  // 切换管理员 / 普通用户登录
  toggleAdminLogin() {
    const { account, password, isAdminLogin } = this.data
    this.setData({
      isAdminLogin: !isAdminLogin,
      canSubmit: account.length > 0 && password.length > 0,
    })
  },

  // 跳转到注册页
  goToForgot() {
    wx.navigateTo({
      url: '/pages/forgot/index'
    })
  },

  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/index'
    })
  }
})

// 支付密码弹窗组件
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    amount: {
      type: String,
      value: '0.00'
    }
  },
  data: {
    password: '',
    loading: false
  },
  methods: {
    onClose() {
      this.setData({ show: false, password: '' });
      this.triggerEvent('close');
    },
    onNumberClick(e) {
      const number = e.currentTarget.dataset.number;
      if (this.data.password.length < 6) {
        this.setData({
          password: this.data.password + number
        });
        
        // 密码输入完成
        if (this.data.password.length === 6) {
          this.onPasswordComplete();
        }
      }
    },
    onDeleteClick() {
      if (this.data.password.length > 0) {
        this.setData({
          password: this.data.password.slice(0, -1)
        });
      }
    },
    onPasswordComplete() {
      // 显示加载动画
      this.setData({ loading: true });
      
      // 模拟支付请求
      setTimeout(() => {
        this.setData({ loading: false, show: false, password: '' });
        this.triggerEvent('success');
      }, 1500);
    },
    getPasswordLength() {
      return this.data.password.length;
    }
  }
});
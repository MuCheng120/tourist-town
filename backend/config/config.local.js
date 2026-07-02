'use strict';

// 本地/真机调试：让后端监听所有网卡，手机才能通过局域网 IP 访问
module.exports = () => {
  const config = {};
  config.cluster = {
    listen: {
      path: '',
      port: 7001,
      hostname: '0.0.0.0', // 允许局域网设备（如真机）访问
    },
  };
  return config;
};

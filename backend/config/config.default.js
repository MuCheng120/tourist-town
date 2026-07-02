'use strict';

const path = require('path');

module.exports = appInfo => {
  const config = exports = {};

  // 安全配置
  config.security = {
    csrf: {
      enable: false,
    },
  };

  // 跨域配置
  config.cors = {
    origin: '*',
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH'
  };

  // Session 配置
  config.session = {
    key: 'EGG_SESS',
    maxAge: 86400000,
    httpOnly: true,
    encrypt: true,
  };

  // JWT 配置
  config.jwt = {
    // 优先使用环境变量，未配置时使用开发环境默认值
    secret: process.env.JWT_SECRET || 'dev_only_jwt_secret',
    expiresIn: '7d',
  };

  // Sequelize 配置
  config.sequelize = {
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    timezone: '+08:00',
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };

  // 静态资源配置：/uploads 映射到 app/public/uploads，存入数据表的格式为 /uploads/{module}/{filename}
  config.static = {
    prefix: '/uploads',
    dir: appInfo.baseDir + '/app/public/uploads'
  };

  // egg-multipart：资质文件（图片+PDF），且微信可能不传扩展名，用 whitelist 函数放行
  // fileSize 需不小于 upload.maxImageSize，否则大图会在解析阶段被拒（413）
  config.multipart = {
    fileSize: '20mb',
    whitelist: fileName => {
      const ext = path.extname(fileName || '').toLowerCase();
      const allowed = [ '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.avif' ];
      return allowed.includes(ext) || ext === '';
    },
  };

  // 上传配置：图片与资质文件使用同一套上传接口，通过 type=image|file 区分校验规则
  // 存储路径：uploads/{module}/{filename}，返回 /uploads/{module}/{filename}
  config.upload = {
    modules: [ 'user', 'merchant', 'post', 'product', 'food', 'hotel', 'scenic', 'banner', 'comment', 'common' ],
    defaultModule: 'common',
    // 图片模式（默认）：头像、攻略图、商品图等
    allowedImageTypes: [ 'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/avif' ],
    maxImageSize: 20 * 1024 * 1024, // 20MB
    // 文件模式（?type=file）：资质文件等，支持图片 + PDF
    allowedFileTypes: [ 'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/avif', 'application/pdf' ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFileCount: 9,
  };

  // 微信小程序配置
  config.wechat = {
    appId: process.env.WECHAT_APP_ID || 'dev_wechat_appid',
    appSecret: process.env.WECHAT_APP_SECRET || 'dev_wechat_secret',
  };

  // 酒店订单：可选儿童加价（与 frontend/utils/hotel-child-price.js 中 CHARGEABLE_CHILD_FEE_PER_NIGHT 保持同步）
  config.hotel = {
    /** 每名儿童每晚加收金额（元）；为 0 时不加收，订单总额为房型价×晚数 */
    chargeableChildFeePerNight: Number(process.env.HOTEL_CHILD_FEE_PER_NIGHT) || 0,
  };

  // 管理员登录配置
  config.admin = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'dev_admin_password',
  };

  // Redis 配置
  config.redis = {
    client: {
      port: 6379,
      host: '127.0.0.1',
      password: '',
      db: 0,
    },
  };

  // 缓存配置
  config.cache = {
    default: 'redis',
    app: true,
    agent: true,
  };

  // 中间件配置
  config.middleware = [ 'errorHandler' ];

  return config;
};

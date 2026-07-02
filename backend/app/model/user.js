'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE, ENUM } = app.Sequelize;

  const User = app.model.define('user', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    openid: {
      type: STRING(100),
      unique: true,
      comment: '微信openid',
    },
    username: {
      type: STRING(50),
      unique: true,
      comment: '用户名（唯一）',
    },
    password: {
      type: STRING(255),
      comment: '密码（bcrypt加密）',
    },
    nickname: {
      type: STRING(50),
      comment: '昵称',
    },
    real_name: {
      type: STRING(50),
      comment: '真实姓名（酒店等预订时作为入住人/联系人）',
    },
    avatar: {
      type: STRING(255),
      comment: '头像',
    },
    background: {
      type: STRING(255),
      comment: '个人资料背景图',
    },
    gender: {
      type: ENUM('male', 'female', 'other'),
      comment: '性别：男、女、其他',
    },
    age: {
      type: INTEGER.UNSIGNED,
      allowNull: true,
      comment: '年龄（选填，可在个人资料中填写）',
    },
    phone: {
      type: STRING(20),
      unique: true,
      comment: '手机号（唯一）',
    },
    role: {
      type: ENUM('consumer', 'merchant', 'admin'),
      defaultValue: 'consumer',
      comment: '角色：游客、商家、管理员',
    },
    merchant_status: {
      type: ENUM('none', 'pending', 'approved', 'rejected'),
      defaultValue: 'none',
      comment: '商家审核状态：none-未申请，pending-待审核，approved-已通过，rejected-已拒绝',
    },
    business_name: {
      type: STRING(100),
      comment: '商家名称',
    },
    contact: {
      type: STRING(100),
      comment: '商家联系方式',
    },
    audit_opinion: {
      type: app.Sequelize.TEXT,
      allowNull: true,
      comment: '商户审核不通过时的审核意见（拒绝时管理员填写）',
    },
    status: {
      type: ENUM('active', 'inactive', 'banned', 'cancelled'),
      defaultValue: 'active',
      comment: '状态：active-正常 inactive-未激活 banned-封禁 cancelled-已注销',
    },
    last_login_at: {
      type: DATE,
      comment: '最后登录时间',
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    paranoid: true, // 启用软删除
    deletedAt: 'deleted_at',
  });

  User.associate = function() {
    User.hasOne(app.model.MerchantExt, { foreignKey: 'merchant_id', as: 'ext' });
    User.hasMany(app.model.UserAuth, { foreignKey: 'user_id', as: 'auths' });
    User.hasMany(app.model.Order, { foreignKey: 'user_id', as: 'orders' });
    User.hasMany(app.model.Comment, { foreignKey: 'user_id', as: 'comments' });
    User.hasMany(app.model.Post, { foreignKey: 'user_id', as: 'posts' });
    User.hasMany(app.model.ShoppingCart, { foreignKey: 'user_id', as: 'shoppingCart' });
    User.hasMany(app.model.Address, { foreignKey: 'user_id', as: 'addresses' });
    User.hasMany(app.model.UserCoupon, { foreignKey: 'user_id', as: 'coupons' });
    User.hasMany(app.model.UserFavorite, { foreignKey: 'user_id', as: 'favorites' });
    User.hasMany(app.model.UserMessage, { foreignKey: 'user_id', as: 'messages' });
    User.hasMany(app.model.UserBehaviorLog, { foreignKey: 'user_id', as: 'behaviorLogs' });
    User.hasMany(app.model.PageView, { foreignKey: 'user_id', as: 'pageViews' });
    User.hasMany(app.model.CommentLike, { foreignKey: 'user_id', as: 'commentLikes' });
    User.hasMany(app.model.PostLike, { foreignKey: 'user_id', as: 'postLikes' });
    User.hasMany(app.model.Product, { foreignKey: 'merchant_id', as: 'products' });
    User.hasMany(app.model.Coupon, { foreignKey: 'merchant_id', as: 'merchantCoupons' });
    User.hasMany(app.model.ViolationLog, { foreignKey: 'merchant_id', as: 'violationLogs' });
  };

  return User;
};

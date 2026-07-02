'use strict';

module.exports = app => {
  const { STRING, INTEGER, DECIMAL, DATE, ENUM } = app.Sequelize;

  const Coupon = app.model.define('coupon', {
    id: { type: INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    title: { type: STRING(100), allowNull: false, comment: '优惠券标题' },
    type: {
      type: ENUM('platform', 'shop'),
      allowNull: false,
      defaultValue: 'platform',
      comment: '类型（当前仅使用 platform 全场通用券）',
    },
    merchant_id: { type: INTEGER.UNSIGNED, comment: '商家ID（平台券为空）' },
    value: { type: DECIMAL(10, 2), allowNull: false, comment: '优惠金额' },
    min_spend: { type: DECIMAL(10, 2), defaultValue: 0, comment: '最低消费金额' },
    total_count: { type: INTEGER.UNSIGNED, allowNull: false, comment: '总发行数量' },
    received_count: { type: INTEGER.UNSIGNED, defaultValue: 0, comment: '已领取数量' },
    used_count: { type: INTEGER.UNSIGNED, defaultValue: 0, comment: '已使用数量' },
    expiry_date: { type: DATE, allowNull: false, comment: '过期时间' },
    status: { type: INTEGER.UNSIGNED, defaultValue: 1, comment: '状态：1有效 0失效' },
    created_at: { type: DATE, defaultValue: Date.now },
    updated_at: { type: DATE, defaultValue: Date.now },
  }, {
    tableName: 'coupons',
    indexes: [
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['merchant_id'] },
    ],
  });

  Coupon.associate = function() {
    app.model.Coupon.belongsTo(app.model.User, { foreignKey: 'merchant_id', as: 'merchant' });
    app.model.Coupon.hasMany(app.model.UserCoupon, { foreignKey: 'coupon_id', as: 'userCoupons' });
  };

  return Coupon;
};

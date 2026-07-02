'use strict';

module.exports = app => {
  const { INTEGER, DATE, ENUM } = app.Sequelize;

  const UserCoupon = app.model.define('user_coupon', {
    id: { type: INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: INTEGER.UNSIGNED, allowNull: false, comment: '用户ID' },
    coupon_id: { type: INTEGER.UNSIGNED, allowNull: false, comment: '优惠券ID' },
    status: {
      type: ENUM('unused', 'used', 'expired'),
      defaultValue: 'unused',
      comment: '状态',
    },
    order_id: { type: INTEGER.UNSIGNED, comment: '关联订单ID' },
    received_at: { type: DATE, defaultValue: Date.now, comment: '领取时间' },
    used_at: { type: DATE, comment: '使用时间' },
    created_at: { type: DATE, defaultValue: Date.now },
  }, {
    tableName: 'user_coupons',
    timestamps: false,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['coupon_id'] },
    ],
  });

  UserCoupon.associate = function() {
    UserCoupon.belongsTo(app.model.Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
    UserCoupon.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    UserCoupon.belongsTo(app.model.Order, { foreignKey: 'order_id', as: 'order' });
  };

  return UserCoupon;
};

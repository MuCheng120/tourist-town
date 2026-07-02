'use strict';

module.exports = app => {
  const { STRING, INTEGER, DECIMAL, TEXT, ENUM, DATE, DATEONLY } = app.Sequelize;

  const Order = app.model.define('order', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    order_no: {
      type: STRING(32),
      unique: true,
      comment: '订单号',
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      comment: '用户ID',
    },
    merchant_id: {
      type: INTEGER.UNSIGNED,
      comment: '商家ID',
    },
    product_id: {
      type: INTEGER.UNSIGNED,
      comment: '商品ID（food/souvenir 使用）',
    },
    room_type_id: {
      type: INTEGER.UNSIGNED,
      comment: '房型ID（hotel 使用）',
    },
    spot_id: {
      type: INTEGER.UNSIGNED,
      comment: '景点ID（门票订单）',
    },
    order_type: {
      type: ENUM('scenic', 'food', 'souvenir', 'hotel'),
      defaultValue: 'souvenir',
      comment: '订单类型：scenic-门票，food-餐饮券，souvenir-特产，hotel-酒店',
    },
    total_amount: {
      type: DECIMAL(10, 2),
      comment: '订单总额',
    },
    discount_amount: {
      type: DECIMAL(10, 2),
      defaultValue: 0,
      comment: '优惠金额',
    },
    final_amount: {
      type: DECIMAL(10, 2),
      comment: '实付金额',
    },
    status: {
      type: ENUM('unpaid', 'paid', 'shipped', 'verified', 'completed', 'cancelled', 'refunding', 'refunded'),
      defaultValue: 'unpaid',
      comment: '订单状态：0-unpaid待支付 1-paid已支付 2-shipped已发货 3-verified已核销 4-completed已完成 5-cancelled已取消 6-refunding退款中 7-refunded已退款',
    },
    quantity: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '数量',
    },
    play_date: {
      type: DATEONLY,
      comment: '游玩日期（门票订单）',
    },
    check_in_date: {
      type: DATE,
      comment: '入住日期（酒店订单）',
    },
    check_out_date: {
      type: DATE,
      comment: '退房日期（酒店订单）',
    },
    contact_name: {
      type: STRING(50),
      comment: '入住联系人真实姓名（酒店订单）',
    },
    contact_phone: {
      type: STRING(20),
      comment: '入住联系人手机号（酒店订单）',
    },
    adult_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '成人数（酒店订单，按成人价计费，超员加收加床费）',
    },
    child_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '儿童数（酒店订单，多数12岁以下免费同住，未满18需监护人）',
    },
    child_ages: {
      type: TEXT,
      comment: '儿童年龄列表（酒店订单，JSON数组如[5,8]，入住登记用）',
    },
    address_info: {
      type: TEXT,
      comment: '收货地址信息（souvenir类型，JSON格式）',
    },
    remark: {
      type: TEXT,
      comment: '备注',
    },
    coupon_id: {
      type: INTEGER.UNSIGNED,
      comment: '使用的优惠券ID（外键关联user_coupons.id）',
    },
    paid_at: {
      type: DATE,
      comment: '支付时间',
    },
    shipped_at: {
      type: DATE,
      comment: '发货时间',
    },
    completed_at: {
      type: DATE,
      comment: '完成时间',
    },
    verification_code: {
      type: STRING(12),
      comment: '核销码（12位随机码）',
    },
    verified_at: {
      type: DATE,
      comment: '核销时间',
    },
    refund_reason: {
      type: TEXT,
      comment: '退款原因',
    },
    refund_apply_reason: {
      type: TEXT,
      comment: '用户退款申请理由',
    },
    refund_evidence_images: {
      type: TEXT,
      comment: '退款图文证据（JSON数组）',
    },
    refund_applied_at: {
      type: DATE,
      comment: '退款申请时间',
    },
    refund_time: {
      type: DATE,
      comment: '退款时间',
    },
    refund_reject_reason: {
      type: TEXT,
      comment: '退款拒绝原因',
    },
    force_complete_reason: {
      type: TEXT,
      comment: '强制完成原因',
    },
  }, {
    tableName: 'orders',
    timestamps: true,
    underscored: true,
    paranoid: true, // 启用软删除
    deletedAt: 'deleted_at',
  });

  Order.associate = function() {
    app.model.Order.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    app.model.Order.belongsTo(app.model.User, { foreignKey: 'merchant_id', as: 'merchant' });
    app.model.Order.belongsTo(app.model.Product, { foreignKey: 'product_id', as: 'product' });
    app.model.Order.belongsTo(app.model.RoomType, { foreignKey: 'room_type_id', as: 'room_type' });
    app.model.Order.belongsTo(app.model.ScenicSpot, { foreignKey: 'spot_id', as: 'scenic_spot' });
    app.model.Order.hasOne(app.model.Logistics, { foreignKey: 'order_id', as: 'logistics' });
    app.model.Order.hasMany(app.model.Comment, { foreignKey: 'order_id', as: 'comments' });
  };

  return Order;
};

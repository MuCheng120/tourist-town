'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DECIMAL } = app.Sequelize;

  const RoomType = app.model.define('room_type', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    hotel_id: {
      type: INTEGER.UNSIGNED,
      comment: '酒店ID，关联 hotels.id（酒店由管理员维护）',
    },
    merchant_id: {
      type: INTEGER.UNSIGNED,
      comment: '商家ID，关联 users.id（预留）',
    },
    admin_id: {
      type: INTEGER.UNSIGNED,
      comment: '管理员ID',
    },
    name: {
      type: STRING(100),
      comment: '房型名称',
    },
    price: {
      type: DECIMAL(10, 2),
      comment: '价格/晚',
    },
    description: {
      type: TEXT,
      comment: '房型描述',
    },
    images: {
      type: TEXT,
      comment: '房型图片（JSON数组）',
    },
    amenities: {
      type: TEXT,
      comment: '设施服务（JSON数组）',
    },
    area: {
      type: STRING(20),
      comment: '面积',
    },
    bed_type: {
      type: STRING(50),
      comment: '床型',
    },
    max_occupancy: {
      type: INTEGER.UNSIGNED,
      defaultValue: 2,
      comment: '最多入住人数',
    },
    floor: {
      type: STRING(20),
      comment: '楼层，如 3层',
    },
    wifi_info: {
      type: STRING(64),
      comment: 'Wi-Fi说明，如 Wi-Fi 免费',
    },
    window_info: {
      type: STRING(32),
      comment: '窗户说明，如 有窗',
    },
    smoking_policy: {
      type: STRING(32),
      comment: '吸烟政策，如 禁烟',
    },
    extra_bed_policy: {
      type: TEXT,
      comment: '加床政策说明',
    },
    breakfast_info: {
      type: TEXT,
      comment: '早餐信息（JSON：has_breakfast, type, cuisine, hours, adult_price, child_price）',
    },
    toiletries: {
      type: TEXT,
      comment: '洗浴用品（JSON数组）',
    },
    children_policy: {
      type: TEXT,
      comment: '儿童及加床政策说明',
    },
    cancellation_policy: {
      type: TEXT,
      comment: '退改/限时取消政策说明',
    },
    status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '状态：1上架 0下架',
    },
  }, {
    tableName: 'room_types',
    timestamps: true,
    underscored: true,
    paranoid: true, // 启用软删除
    deletedAt: 'deleted_at',
  });

  RoomType.associate = function() {
    app.model.RoomType.belongsTo(app.model.Hotel, { foreignKey: 'hotel_id', as: 'hotel' });
    app.model.RoomType.belongsTo(app.model.Admin, { foreignKey: 'admin_id', as: 'admin' });
    app.model.RoomType.hasMany(app.model.RoomStock, { foreignKey: 'room_type_id', as: 'stocks' });
  };

  return RoomType;
};

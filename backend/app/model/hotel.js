'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DECIMAL, JSON } = app.Sequelize;

  const Hotel = app.model.define('hotel', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: STRING(100),
      comment: '酒店名称',
    },
    introduction: {
      type: TEXT,
      comment: '酒店介绍',
    },
    policy_info: {
      type: JSON,
      allowNull: true,
      comment: '酒店政策信息（结构化+可选富文本）',
    },
    address: {
      type: STRING(255),
      comment: '地址/位置（手动输入或 wx.chooseLocation 获取）',
    },
    latitude: {
      type: DECIMAL(10, 6),
      comment: '纬度（选择位置时写入，用于地图展示）',
    },
    longitude: {
      type: DECIMAL(10, 6),
      comment: '经度（选择位置时写入）',
    },
    list_stock_tip: {
      type: STRING(100),
      comment: '列表页库存提示（如：低价房仅剩2间，可为空）',
    },
    cover_image: {
      type: STRING(255),
      comment: '封面图',
    },
    sort_order: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '排序，越小越靠前',
    },
    status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '状态：1显示 0隐藏',
    },
    rating: {
      type: DECIMAL(3, 2),
      defaultValue: 0,
      comment: '平均评分（1-5，来自评论）',
    },
    rating_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '评分人数',
    },
  }, {
    tableName: 'hotels',
    timestamps: true,
    underscored: true,
  });

  Hotel.associate = function() {
    app.model.Hotel.hasMany(app.model.RoomType, { foreignKey: 'hotel_id', as: 'roomTypes' });
    app.model.Hotel.hasMany(app.model.Comment, {
      foreignKey: 'post_id',
      as: 'comments',
      scope: { post_type: 'hotel' },
    });
    app.model.Hotel.belongsToMany(app.model.Tag, {
      through: app.model.HotelTag,
      foreignKey: 'hotel_id',
      otherKey: 'tag_id',
      as: 'tags',
    });
  };

  return Hotel;
};

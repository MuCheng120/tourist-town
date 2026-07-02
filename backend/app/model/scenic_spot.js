'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DECIMAL, DATE } = app.Sequelize;

  const ScenicSpot = app.model.define('scenic_spot', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: STRING(100),
      allowNull: false,
      comment: '景点名称',
    },
    cover_image: {
      type: STRING(255),
      comment: '封面图URL',
    },
    images: {
      type: TEXT,
      comment: '详情图片（JSON数组）',
      get() {
        const images = this.getDataValue('images');
        return images ? JSON.parse(images) : [];
      },
      set(value) {
        this.setDataValue('images', JSON.stringify(value));
      },
    },
    open_time: {
      type: STRING(100),
      comment: '开放时间',
    },
    address: {
      type: STRING(255),
      comment: '景区详细地址',
    },
    open_status: {
      type: STRING(32),
      defaultValue: 'open',
      comment: '开放状态：open-开放中 closed-暂停开放 limit-限流中',
    },
    stop_sale_time: {
      type: STRING(50),
      comment: '停止售票时间，如 21:00',
    },
    stop_entry_time: {
      type: STRING(50),
      comment: '停止入园时间，如 21:00',
    },
    ticket_types: {
      type: TEXT,
      comment: '门票类型 JSON，如 [{"type":"adult","name":"成人票","price":50},{"type":"child","name":"儿童票","price":25,"remark":"6-18周岁"}]',
      get() {
        const v = this.getDataValue('ticket_types');
        if (!v) return null;
        try { return JSON.parse(v); } catch (e) { return null; }
      },
      set(val) {
        this.setDataValue('ticket_types', val ? JSON.stringify(val) : null);
      },
    },
    price: {
      type: DECIMAL(10, 2),
      defaultValue: 0,
      comment: '门票价格',
    },
    latitude: {
      type: DECIMAL(9, 6),
      comment: '纬度',
    },
    longitude: {
      type: DECIMAL(9, 6),
      comment: '经度',
    },
    view_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '访问量/浏览量',
    },
    description: {
      type: TEXT,
      comment: '景点详细介绍（支持富文本）',
    },
    rating: {
      type: DECIMAL(3, 2),
      defaultValue: 0,
      comment: '平均评分（1-5）',
    },
    rating_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '评分人数',
    },
    sales_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '销量（已售门票数量）',
    },
    daily_capacity: {
      type: INTEGER.UNSIGNED,
      defaultValue: 100,
      comment: '每日最大接待量',
    },
    tags: {
      type: TEXT,
      comment: '标签（JSON数组）',
      get() {
        const tags = this.getDataValue('tags');
        return tags ? JSON.parse(tags) : [];
      },
      set(value) {
        this.setDataValue('tags', JSON.stringify(value));
      },
    },
    status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '状态：1启用 0禁用',
    },
    is_recommend: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '是否推荐：0否 1是',
    },
  }, {
    tableName: 'scenic_spots',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_location',
        fields: ['latitude', 'longitude'],
      },
      {
        name: 'idx_view_count',
        fields: ['view_count'],
      },
      {
        name: 'idx_sales_count',
        fields: ['sales_count'],
      },
      {
        name: 'idx_status',
        fields: ['status'],
      },
      {
        name: 'idx_is_recommend',
        fields: ['is_recommend'],
      },
    ],
  });

  ScenicSpot.associate = function() {
    // 景点可以有多个评论
    app.model.ScenicSpot.hasMany(app.model.Comment, {
      foreignKey: 'post_id',
      as: 'comments',
      scope: {
        post_type: 'scenic',
      },
    });
    // 景点-标签多对多（别名 tagRefs 避免与模型属性 tags 冲突）
    app.model.ScenicSpot.belongsToMany(app.model.Tag, {
      through: app.model.ScenicSpotTag,
      foreignKey: 'scenic_spot_id',
      otherKey: 'tag_id',
      as: 'tagRefs',
    });
  };

  return ScenicSpot;
};

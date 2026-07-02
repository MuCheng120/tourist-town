'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT, DECIMAL, ENUM } = app.Sequelize;

  const Product = app.model.define('product', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    merchant_id: {
      type: INTEGER.UNSIGNED,
      comment: '商家ID',
    },
    product_type: {
      type: ENUM('food', 'souvenir'),
      defaultValue: 'souvenir',
      comment: '商品类型：food-餐饮，souvenir-特产（酒店/房型由 room_types 表管理）',
    },
    category: {
      type: STRING(50),
      allowNull: true,
      comment: '特产分类：茶叶、干货、工艺品、食品等，仅特产(souvenir)使用',
    },
    name: {
      type: STRING(100),
      comment: '商品名称',
    },
    cover_image: {
      type: STRING(255),
      comment: '封面图',
    },
    images: {
      type: TEXT,
      comment: '商品图片（JSON数组）',
    },
    spec: {
      type: STRING(100),
      comment: '商品规格，如 500g/盒、2人套餐',
    },
    price: {
      type: DECIMAL(10, 2),
      comment: '价格',
    },
    original_price: {
      type: DECIMAL(10, 2),
      comment: '原价',
    },
    description: {
      type: TEXT,
      comment: '商品描述',
    },
    stock: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '库存',
    },
    usage_conditions: {
      type: TEXT,
      comment: '使用条件（餐饮券使用，JSON格式）',
    },
    tasting_score: {
      type: DECIMAL(3, 2),
      defaultValue: 0,
      comment: '味道平均评分（1-5，仅餐饮）',
    },
    environment_score: {
      type: DECIMAL(3, 2),
      defaultValue: 0,
      comment: '环境平均评分（1-5，仅餐饮）',
    },
    service_score: {
      type: DECIMAL(3, 2),
      defaultValue: 0,
      comment: '服务平均评分（1-5，仅餐饮）',
    },
    overall_rating: {
      type: DECIMAL(3, 2),
      defaultValue: 0,
      comment: '综合评分（1-5）',
    },
    rating_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '评分人数',
    },
    delivery_method: {
      type: STRING(50),
      comment: '发货方式：express / self_pickup / express,self_pickup（可多选）',
    },
    ship_time_desc: {
      type: STRING(100),
      comment: '发货时间说明，如 48 小时内发货',
    },
    status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 1,
      comment: '状态：1上架 0下架',
    },
    sales_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '销量',
    },
    is_recommend: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '是否首页推荐：0否 1是',
    },
    audit_status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '审核状态：0待审核 1通过 2拒绝',
    },
    audit_remark: {
      type: TEXT,
      comment: '审核备注',
    },
    audited_by: {
      type: INTEGER.UNSIGNED,
      allowNull: true,
      comment: '审核人（管理员ID）',
    },
    audited_at: {
      type: app.Sequelize.DATE,
      allowNull: true,
      comment: '审核时间',
    },
  }, {
    tableName: 'products',
    timestamps: true,
    underscored: true,
    paranoid: true, // 启用软删除
    deletedAt: 'deleted_at',
  });

  Product.associate = function() {
    app.model.Product.belongsTo(app.model.User, { foreignKey: 'merchant_id', as: 'merchant' });
    app.model.Product.hasMany(app.model.Comment, {
      foreignKey: 'post_id',
      as: 'comments',
      scope: { post_type: 'product' }
    });
    app.model.Product.hasMany(app.model.ShoppingCart, { foreignKey: 'product_id', as: 'shoppingCartItems' });
    app.model.Product.hasMany(app.model.Order, { foreignKey: 'product_id', as: 'orders' });
  };

  return Product;
};

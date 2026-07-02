'use strict';

module.exports = app => {
  const { INTEGER, TEXT } = app.Sequelize;

  const Comment = app.model.define('comment', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: INTEGER.UNSIGNED,
      comment: '关联内容ID（攻略、景点、商品或酒店）',
    },
    post_type: {
      type: app.Sequelize.ENUM('post', 'scenic', 'product', 'hotel'),
      defaultValue: 'post',
      comment: '内容类型：post-攻略，scenic-景点，product-商品，hotel-酒店/住宿',
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      comment: '用户ID',
    },
    order_id: {
      type: INTEGER.UNSIGNED,
      allowNull: true,
      comment: '关联订单ID（景点一级评论必填，回复可为空）',
    },
    content: {
      type: TEXT,
      comment: '评论内容',
    },
    images: {
      type: TEXT,
      comment: '评论图片（JSON数组）',
      get() {
        const images = this.getDataValue('images');
        return images ? JSON.parse(images) : [];
      },
      set(value) {
        this.setDataValue('images', JSON.stringify(value));
      },
    },
    parent_id: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '父评论ID（0表示一级评论）',
    },
    reply_to_user_id: {
      type: INTEGER.UNSIGNED,
      comment: '回复的用户ID',
    },
    score: {
      type: app.Sequelize.TINYINT.UNSIGNED,
      comment: '总体评分（1-5星，景点、商品、酒店评论有效）',
    },
    taste_score: {
      type: app.Sequelize.TINYINT.UNSIGNED,
      comment: '味道评分（1-5星，仅餐饮商品有效）',
    },
    environment_score: {
      type: app.Sequelize.TINYINT.UNSIGNED,
      comment: '环境评分（1-5星，餐饮商品/住宿有效）',
    },
    service_score: {
      type: app.Sequelize.TINYINT.UNSIGNED,
      comment: '服务评分（1-5星，餐饮商品/住宿有效）',
    },
    hygiene_score: {
      type: app.Sequelize.TINYINT.UNSIGNED,
      comment: '卫生评分（1-5星，仅住宿评论）',
    },
    facility_score: {
      type: app.Sequelize.TINYINT.UNSIGNED,
      comment: '设施评分（1-5星，仅住宿评论）',
    },
    likes_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '点赞数',
    },
    status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '状态：0待审核 1已通过 2已拒绝',
    },
  }, {
    tableName: 'comments',
    timestamps: true,
    underscored: true,
    paranoid: true, // 启用软删除
    deletedAt: 'deleted_at',
  });

  Comment.associate = function() {
    app.model.Comment.belongsTo(app.model.Post, { foreignKey: 'post_id', as: 'post', constraints: false });
    app.model.Comment.belongsTo(app.model.ScenicSpot, { foreignKey: 'post_id', as: 'scenic_spot', constraints: false });
    app.model.Comment.belongsTo(app.model.Hotel, { foreignKey: 'post_id', as: 'hotel', constraints: false });
    app.model.Comment.belongsTo(app.model.Product, { foreignKey: 'post_id', as: 'product', constraints: false });
    app.model.Comment.belongsTo(app.model.Order, { foreignKey: 'order_id', as: 'order' });
    app.model.Comment.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    app.model.Comment.belongsTo(app.model.User, { foreignKey: 'reply_to_user_id', as: 'reply_to_user' });
    app.model.Comment.belongsTo(app.model.Comment, { foreignKey: 'parent_id', as: 'parent' });
    app.model.Comment.hasMany(app.model.Comment, { foreignKey: 'parent_id', as: 'replies' });
    app.model.Comment.hasMany(app.model.CommentLike, { foreignKey: 'comment_id', as: 'likes' });
  };

  return Comment;
};

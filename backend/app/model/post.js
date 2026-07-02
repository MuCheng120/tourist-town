'use strict';

module.exports = app => {
  const { STRING, INTEGER, TEXT } = app.Sequelize;

  const Post = app.model.define('post', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      comment: '用户ID',
    },
    title: {
      type: STRING(200),
      comment: '攻略标题',
    },
    content: {
      type: TEXT,
      comment: '攻略内容',
    },
    images: {
      type: TEXT,
      comment: '图片（JSON数组）',
    },
    location: {
      type: STRING(100),
      comment: '地点',
    },
    likes_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '点赞数',
    },
    comments_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '评论数',
    },
    views_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '浏览量',
    },
    favorite_count: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '收藏人数',
    },
    status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '发布状态：0未发布 1已发布',
    },
    audit_status: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '审核状态：0待审核 1通过 2拒绝 3草稿未提交',
    },
    audit_remark: {
      type: TEXT,
      comment: '审核备注',
    },
    category: {
      type: STRING(50),
      allowNull: true,
      defaultValue: 'guide',
      comment: '攻略分类：scenery景点、food美食、accommodation住宿、guide攻略',
    },
    is_hidden: {
      type: INTEGER.UNSIGNED,
      defaultValue: 0,
      comment: '是否隐藏：0否 1是，隐藏后在攻略列表不可见',
    },
  }, {
    tableName: 'posts',
    timestamps: true,
    underscored: true,
    paranoid: true, // 启用软删除
    deletedAt: 'deleted_at',
  });

  Post.associate = function() {
    app.model.Post.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    app.model.Post.hasMany(app.model.Comment, {
      foreignKey: 'post_id',
      as: 'comments',
      scope: { post_type: 'post' }
    });
    app.model.Post.hasMany(app.model.PostLike, { foreignKey: 'post_id', as: 'likes' });
  };

  return Post;
};

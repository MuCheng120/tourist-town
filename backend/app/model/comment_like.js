'use strict';

module.exports = app => {
  const { INTEGER } = app.Sequelize;

  const CommentLike = app.model.define('comment_like', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    comment_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '评论ID',
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID',
    },
  }, {
    tableName: 'comment_likes',
    timestamps: false,
    underscored: true,
  });

  CommentLike.associate = function() {
    app.model.CommentLike.belongsTo(app.model.Comment, { foreignKey: 'comment_id', as: 'comment' });
    app.model.CommentLike.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
  };

  return CommentLike;
};
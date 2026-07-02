'use strict';

module.exports = app => {
  const { INTEGER } = app.Sequelize;

  const PostLike = app.model.define('post_like', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    post_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '攻略ID',
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID',
    },
  }, {
    tableName: 'post_likes',
    timestamps: true,
    underscored: true,
  });

  PostLike.associate = function() {
    app.model.PostLike.belongsTo(app.model.Post, { foreignKey: 'post_id', as: 'post' });
    app.model.PostLike.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
  };

  return PostLike;
};


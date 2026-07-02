'use strict';

module.exports = app => {
  const { INTEGER, STRING } = app.Sequelize;

  const UserFavorite = app.model.define('user_favorite', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID',
    },
    target_type: {
      type: STRING(20),
      allowNull: false,
      comment: '收藏类型：hotel-酒店，scenic-景点，product-商品，post-攻略',
    },
    target_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '收藏目标ID（酒店ID/景点ID/商品ID）',
    },
  }, {
    tableName: 'user_favorites',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: [ 'user_id', 'target_type', 'target_id' ], name: 'uk_user_target' },
      { fields: [ 'user_id', 'target_type' ], name: 'idx_user_type' },
    ],
  });

  UserFavorite.associate = function() {
    app.model.UserFavorite.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
  };

  return UserFavorite;
};

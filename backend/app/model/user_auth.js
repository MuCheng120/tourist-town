'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE, ENUM } = app.Sequelize;

  const UserAuth = app.model.define('user_auth', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID，关联 users.id',
    },
    provider: {
      type: ENUM('weixin'),
      allowNull: false,
      defaultValue: 'weixin',
      comment: '第三方提供商：weixin-微信',
    },
    openid: {
      type: STRING(100),
      allowNull: false,
      comment: '第三方平台唯一标识 openid',
    },
    unionid: {
      type: STRING(100),
      allowNull: true,
      comment: '微信开放平台统一标识 unionid（可选）',
    },
    access_token: {
      type: STRING(255),
      allowNull: true,
      comment: '访问令牌（如需要）',
    },
    refresh_token: {
      type: STRING(255),
      allowNull: true,
      comment: '刷新令牌（如需要）',
    },
    expires_at: {
      type: DATE,
      allowNull: true,
      comment: '令牌过期时间（如需要）',
    },
  }, {
    tableName: 'user_auths',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        name: 'unique_provider_openid',
        unique: true,
        fields: [ 'provider', 'openid' ],
      },
      {
        name: 'idx_user_id',
        fields: [ 'user_id' ],
      },
    ],
  });

  UserAuth.associate = function() {
    app.model.UserAuth.belongsTo(app.model.User, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return UserAuth;
};


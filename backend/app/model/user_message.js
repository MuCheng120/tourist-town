'use strict';

module.exports = app => {
  const { INTEGER, STRING, TEXT, DATE, TINYINT } = app.Sequelize;

  const UserMessage = app.model.define('user_message', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '用户ID（接收人）',
    },
    title: {
      type: STRING(200),
      allowNull: false,
      comment: '标题',
    },
    content: {
      type: TEXT,
      comment: '内容',
    },
    message_type: {
      type: STRING(32),
      defaultValue: 'system',
      comment: '类型：license_expiry-资质到期，system-系统通知',
    },
    is_read: {
      type: TINYINT.UNSIGNED,
      defaultValue: 0,
      comment: '是否已读：0未读 1已读',
    },
    read_at: {
      type: DATE,
      comment: '阅读时间',
    },
  }, {
    tableName: 'user_messages',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  UserMessage.associate = function() {
    app.model.UserMessage.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
  };

  return UserMessage;
};

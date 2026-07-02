'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;

  const UserBehaviorLog = app.model.define('user_behavior_log', {
    id: { type: INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    user_id: { type: INTEGER.UNSIGNED, allowNull: false, comment: '用户ID' },
    page_path: { type: STRING(255), allowNull: false, comment: '页面路径' },
    target_id: { type: INTEGER.UNSIGNED, comment: '目标ID' },
    target_type: { type: STRING(20), comment: '目标类型' },
    action_type: { type: STRING(20), allowNull: false, comment: '行为类型' },
    stay_duration: { type: INTEGER.UNSIGNED, defaultValue: 0, comment: '停留时长（秒）' },
    search_keyword: { type: STRING(100), comment: '搜索关键词' },
    created_at: { type: DATE, defaultValue: Date.now },
  }, {
    tableName: 'user_behavior_logs',
    timestamps: false,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['target_type', 'target_id'] },
      { fields: ['created_at'] },
    ],
  });

  return UserBehaviorLog;
};

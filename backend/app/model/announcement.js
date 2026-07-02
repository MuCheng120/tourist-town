'use strict';
module.exports = app => {
  const { STRING, TEXT, INTEGER, DATE } = app.Sequelize;

  const Announcement = app.model.define('announcement', {
    id: { type: INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    title: { type: STRING(200), allowNull: false, comment: '公告标题' },
    content: { type: TEXT, comment: '公告内容' },
    status: { type: INTEGER.UNSIGNED, defaultValue: 1, comment: '状态：1显示 0隐藏' },
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'announcements',
    comment: '系统公告表',
  });

  return Announcement;
};

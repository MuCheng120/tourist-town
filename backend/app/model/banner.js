'use strict';
module.exports = app => {
  const { STRING, INTEGER, DATE, ENUM } = app.Sequelize;

  const Banner = app.model.define('banner', {
    id: { type: INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    title: { type: STRING(100), comment: '标题' },
    image: { type: STRING(255), allowNull: false, comment: '图片' },
    linkType: { 
      type: ENUM('none', 'scenic', 'product', 'url'), 
      defaultValue: 'none', 
      field: 'link_type',
      comment: '链接类型' 
    },
    linkValue: { type: STRING(255), field: 'link_value', comment: '链接值' },
    sortOrder: { 
      type: INTEGER.UNSIGNED, 
      defaultValue: 0, 
      field: 'sort_order',
      comment: '排序' 
    },
    status: { type: INTEGER.UNSIGNED, defaultValue: 1, comment: '状态：1显示 0隐藏' },
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'banners',
    comment: 'Banner表',
  });

  return Banner;
};

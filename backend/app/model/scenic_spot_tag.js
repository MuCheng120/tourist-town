'use strict';

module.exports = app => {
  const { INTEGER } = app.Sequelize;

  const ScenicSpotTag = app.model.define('scenic_spot_tag', {
    id: {
      type: INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    scenic_spot_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '景点ID',
    },
    tag_id: {
      type: INTEGER.UNSIGNED,
      allowNull: false,
      comment: '标签ID',
    },
  }, {
    tableName: 'scenic_spot_tags',
    timestamps: false,
    underscored: true,
    indexes: [
      { unique: true, fields: [ 'scenic_spot_id', 'tag_id' ], name: 'uk_scenic_spot_tag' },
      { fields: [ 'scenic_spot_id' ], name: 'idx_scenic_spot_id' },
      { fields: [ 'tag_id' ], name: 'idx_tag_id' },
    ],
  });

  ScenicSpotTag.associate = function() {
    app.model.ScenicSpotTag.belongsTo(app.model.ScenicSpot, { foreignKey: 'scenic_spot_id', as: 'scenic_spot' });
    app.model.ScenicSpotTag.belongsTo(app.model.Tag, { foreignKey: 'tag_id', as: 'tag' });
  };

  return ScenicSpotTag;
};

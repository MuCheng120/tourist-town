'use strict';

const Service = require('egg').Service;

class TagService extends Service {
  /**
   * 标签列表（管理员发布酒店时选择用）
   */
  async list() {
    const { ctx } = this;
    const rows = await ctx.model.Tag.findAll({
      order: [[ 'sort_order', 'ASC' ], [ 'id', 'ASC' ]],
      attributes: [ 'id', 'name', 'description', 'sort_order' ],
    });
    return rows.map(r => r.toJSON());
  }

  /**
   * 管理员：新增标签
   */
  async create(data) {
    const { ctx } = this;
    const name = (data.name || '').trim() || '未命名';
    const existing = await ctx.model.Tag.findOne({ where: { name } });
    if (existing) {
      return existing.toJSON();
    }
    const desc = (data.description != null ? String(data.description) : '').trim();
    const tag = await ctx.model.Tag.create({
      name,
      description: desc || null,
      sort_order: data.sort_order != null ? data.sort_order : 0,
    });
    return tag.toJSON();
  }

  /**
   * 管理员：更新标签（如补充 description）
   */
  async update(id, data) {
    const { ctx } = this;
    const tag = await ctx.model.Tag.findByPk(id);
    if (!tag) throw new Error('标签不存在');
    const patch = {};
    if (data.name !== undefined) patch.name = String(data.name || '').trim() || tag.name;
    if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
    if (data.description !== undefined) {
      const d = String(data.description || '').trim();
      patch.description = d || null;
    }
    await tag.update(patch);
    return tag.toJSON();
  }

  /**
   * 管理员：删除标签（同时解除与酒店、景点的关联）
   */
  async remove(id) {
    const { ctx } = this;
    const tagId = parseInt(id, 10);
    if (!tagId) throw new Error('无效的标签 ID');
    const tag = await ctx.model.Tag.findByPk(tagId);
    if (!tag) throw new Error('标签不存在');

    const t = await ctx.model.transaction();
    try {
      await ctx.model.HotelTag.destroy({ where: { tag_id: tagId }, transaction: t });
      await ctx.model.ScenicSpotTag.destroy({ where: { tag_id: tagId }, transaction: t });
      await tag.destroy({ transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
}

module.exports = TagService;

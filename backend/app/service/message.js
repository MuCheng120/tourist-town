'use strict';

const Service = require('egg').Service;

class MessageService extends Service {
  /**
   * 获取当前用户站内信列表
   */
  async list(userId, { page = 1, pageSize = 20, is_read } = {}) {
    const { ctx } = this;
    const where = { user_id: userId };
    if (is_read !== undefined && is_read !== '') {
      where.is_read = is_read;
    }
    const offset = (page - 1) * pageSize;
    const { count, rows } = await ctx.model.UserMessage.findAndCountAll({
      where,
      order: [[ 'created_at', 'DESC' ]],
      limit: pageSize,
      offset,
    });
    return { total: count, page, pageSize, list: rows };
  }

  /**
   * 标记已读
   */
  async markRead(userId, messageId) {
    const { ctx } = this;
    const msg = await ctx.model.UserMessage.findByPk(messageId);
    if (!msg) throw new Error('消息不存在');
    if (msg.user_id !== userId) throw new Error('无权操作');
    await msg.update({ is_read: 1, read_at: new Date() });
    return msg;
  }

  /**
   * 未读数量
   */
  async unreadCount(userId) {
    const { ctx } = this;
    return await ctx.model.UserMessage.count({
      where: { user_id: userId, is_read: 0 },
    });
  }
}

module.exports = MessageService;

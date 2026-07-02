'use strict';

const Service = require('egg').Service;
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/password');

class AdminService extends Service {
  /**
   * 创建管理员（仅可由已登录管理员调用）
   */
  async createAdmin({ username, password, nickname }) {
    const { ctx } = this;
    const uname = (username || '').trim();
    if (!uname) throw new Error('用户名不能为空');

    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) throw new Error(pwdCheck.message);

    const existing = await ctx.model.Admin.findOne({ where: { username: uname } });
    if (existing) throw new Error('该管理员用户名已存在');

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await ctx.model.Admin.create({
      username: uname,
      password: hashedPassword,
      nickname: (nickname || '').trim() || uname,
      status: 'active',
    });

    return {
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname,
      status: admin.status,
      created_at: admin.created_at,
    };
  }

  /**
   * 管理员列表（不含密码）
   */
  async listAdmins() {
    const { ctx } = this;
    const list = await ctx.model.Admin.findAll({
      attributes: [ 'id', 'username', 'nickname', 'status', 'created_at' ],
      order: [[ 'id', 'ASC' ]],
    });
    return list.map(a => a.toJSON());
  }
}

module.exports = AdminService;

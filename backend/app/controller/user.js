'use strict';

const Controller = require('egg').Controller;
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/password');

class UserController extends Controller {
  /**
   * 检查用户名是否唯一
   */
  async checkUsername() {
    const { ctx } = this;
    const { username } = ctx.query;

    if (!username) {
      ctx.body = {
        code: 400,
        message: '用户名不能为空',
      };
      return;
    }

    try {
      const exists = await ctx.service.user.checkUsernameExists(username);
      ctx.body = {
        code: 200,
        message: '检查成功',
        data: {
          unique: !exists,
        },
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '检查失败',
      };
    }
  }

  /**
   * 用户注册
   */
  async register() {
    const { ctx } = this;
    const { username, phone, gender, age, password, business_name, contact } = ctx.request.body;

    // 参数验证（基础信息，年龄选填）
    if (!username || !phone || !gender || !password) {
      ctx.body = {
        code: 400,
        message: '缺少必要参数',
      };
      return;
    }

    // 若传了年龄则校验范围
    if (age != null && (age < 1 || age > 120)) {
      ctx.body = {
        code: 400,
        message: '年龄必须在1-120之间',
      };
      return;
    }

    // 用户名格式验证
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      ctx.body = {
        code: 400,
        message: '用户名必须为3-20位字母、数字或下划线',
      };
      return;
    }

    // 手机号格式验证
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      ctx.body = {
        code: 400,
        message: '手机号格式不正确',
      };
      return;
    }

    // 密码强度验证：8-20 位，须含字母、数字和特殊符号
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      ctx.body = { code: 400, message: pwdCheck.message };
      return;
    }

    // 如果填写了任意商家资料，则要求两项都填写完整
    if ((business_name && !contact) || (!business_name && contact)) {
      ctx.body = {
        code: 400,
        message: '商家名称和联系方式必须同时填写',
      };
      return;
    }

    try {
      const result = await ctx.service.user.register({
        username,
        phone,
        gender,
        age,
        password,
        business_name,
        contact,
      });

      ctx.body = {
        code: 200,
        message: '注册成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '注册失败',
      };
    }
  }

  /**
   * 账号密码登录（支持用户名或手机号）
   */
  async accountLogin() {
    const { ctx } = this;
    const { account, password } = ctx.request.body;

    if (!account || !password) {
      ctx.body = {
        code: 400,
        message: '账号和密码不能为空',
      };
      return;
    }

    try {
      const result = await ctx.service.user.accountLogin(account, password);
      ctx.body = {
        code: 200,
        message: '登录成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 401,
        message: error.message || '登录失败',
      };
    }
  }

  /**
   * 微信登录
   */
  async wechatLogin() {
    const { ctx } = this;
    const { code } = ctx.request.body;

    try {
      const result = await ctx.service.user.wechatLogin(code);
      ctx.body = {
        code: 200,
        message: '登录成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '登录失败',
      };
    }
  }

  /**
   * 管理员登录
   */
  async adminLogin() {
    const { ctx } = this;
    const { username, password } = ctx.request.body;

    try {
      const result = await ctx.service.user.adminLogin(username, password);
      ctx.body = {
        code: 200,
        message: '管理员登录成功',
        data: result,
      };
    } catch (error) {
      ctx.body = {
        code: 401,
        message: error.message || '登录失败',
      };
    }
  }

  /**
   * 发送找回密码验证码
   */
  async sendResetCode() {
    const { ctx } = this;
    const { phone } = ctx.request.body || {};
    if (!phone) {
      ctx.body = { code: 400, message: '请填写手机号' };
      return;
    }
    try {
      const result = await ctx.service.user.sendResetCode(phone);
      ctx.body = {
        code: 200,
        message: '验证码已发送',
        data: result.codeForDev ? { codeForDev: result.codeForDev } : {},
      };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '发送失败' };
    }
  }

  /**
   * 通过验证码重置密码
   */
  async resetPassword() {
    const { ctx } = this;
    const { phone, code, new_password: newPassword } = ctx.request.body || {};
    if (!phone || !code || !newPassword) {
      ctx.body = { code: 400, message: '请填写手机号、验证码和新密码' };
      return;
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      ctx.body = { code: 400, message: pwdCheck.message };
      return;
    }
    try {
      await ctx.service.user.resetPassword(phone, code, newPassword);
      ctx.body = { code: 200, message: '密码已重置，请使用新密码登录' };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '重置失败' };
    }
  }

  /**
   * 获取用户信息
   */
  async getInfo() {
    const { ctx } = this;

    try {
      const user = await ctx.service.user.getUserInfo(ctx.state.user.id);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: user,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 获取当前用户商户申请状态（含审核意见、上次提交信息，用于重新提交预填）
   */
  async getMerchantApplicationStatus() {
    const { ctx } = this;
    try {
      const data = await ctx.service.user.getMerchantApplicationStatus(ctx.state.user.id);
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 更新用户信息
   */
  async updateInfo() {
    const { ctx } = this;
    const data = ctx.request.body;

    try {
      const user = await ctx.service.user.updateUserInfo(ctx.state.user.id, data);
      ctx.body = {
        code: 200,
        message: '更新成功',
        data: user,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '更新失败',
      };
    }
  }

  /**
   * 已登录用户修改密码
   */
  async changePassword() {
    const { ctx } = this;
    const { old_password: oldPassword, new_password: newPassword } = ctx.request.body || {};
    if (!oldPassword || !newPassword) {
      ctx.body = { code: 400, message: '请填写原密码和新密码' };
      return;
    }
    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      ctx.body = { code: 400, message: pwdCheck.message };
      return;
    }
    try {
      await ctx.service.user.changePassword(ctx.state.user.id, oldPassword, newPassword);
      ctx.body = { code: 200, message: '密码修改成功' };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '修改失败' };
    }
  }

  /**
   * 注销账号（需登录，账号密码用户需传 password 二次确认）
   */
  async cancelAccount() {
    const { ctx } = this;
    const { password } = ctx.request.body || {};
    try {
      await ctx.service.user.cancelAccount(ctx.state.user.id, password);
      ctx.body = { code: 200, message: '账号已注销' };
    } catch (error) {
      ctx.body = {
        code: 400,
        message: error.message || '注销失败',
      };
    }
  }

  /**
   * 申请成为商家
   */
  async applyMerchant() {
    const { ctx } = this;

    try {
      const user = await ctx.service.user.applyMerchant(ctx.state.user.id, ctx.request.body);
      ctx.body = {
        code: 200,
        message: '申请成功',
        data: user,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '申请失败',
      };
    }
  }

  /**
   * 获取待审核的商户申请列表（管理员）
   */
  async getPendingMerchants() {
    const { ctx } = this;
    const { status = 'pending' } = ctx.query;

    try {
      const list = await ctx.service.user.getPendingMerchants(status);
      ctx.body = {
        code: 200,
        message: '获取成功',
        data: list,
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '获取失败',
      };
    }
  }

  /**
   * 审核商户申请（管理员）。拒绝时需填写审核意见。
   */
  async auditMerchant() {
    const { ctx } = this;
    const { id } = ctx.params;
    const { pass, audit_opinion: auditOpinion } = ctx.request.body;

    if (pass === false && (!auditOpinion || typeof auditOpinion !== 'string' || !auditOpinion.trim())) {
      ctx.body = { code: 400, message: '审核不通过时请填写审核意见' };
      return;
    }

    try {
      await ctx.service.user.auditMerchant(id, pass, pass ? null : (auditOpinion && auditOpinion.trim()) || null);
      ctx.body = {
        code: 200,
        message: pass ? '审核通过' : '审核拒绝',
      };
    } catch (error) {
      ctx.body = {
        code: 500,
        message: error.message || '审核失败',
      };
    }
  }

  /**
   * 管理员：用户列表
   */
  async listUsers() {
    const { ctx } = this;
    const { page, pageSize, role, status } = ctx.query;
    try {
      const data = await ctx.service.user.listForAdmin({
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        role,
        status,
      });
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 管理员：商户列表（店铺状态、经营情况）
   */
  async listMerchants() {
    const { ctx } = this;
    const { page, pageSize, status } = ctx.query;
    try {
      const data = await ctx.service.user.listMerchantsForAdmin({
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
        status,
      });
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (error) {
      ctx.body = { code: 500, message: error.message || '获取失败' };
    }
  }

  /**
   * 管理员：单个商户完整信息（含资质、证照、文件等）
   */
  async getMerchantDetail() {
    const { ctx } = this;
    const id = ctx.params.id;
    try {
      const data = await ctx.service.user.getMerchantDetailForAdmin(parseInt(id, 10));
      ctx.body = { code: 200, message: '获取成功', data };
    } catch (error) {
      ctx.body = { code: 404, message: error.message || '商户不存在' };
    }
  }

  /**
   * 管理员：封禁/解封用户
   */
  async updateUserStatus() {
    const { ctx } = this;
    const id = ctx.params.id;
    const { status: newStatus } = ctx.request.body || {};
    if (!newStatus || ![ 'active', 'banned', 'inactive', 'cancelled' ].includes(newStatus)) {
      ctx.body = { code: 400, message: '状态需为 active / banned / inactive / cancelled' };
      return;
    }
    try {
      const user = await ctx.service.user.updateUserStatusByAdmin(id, newStatus);
      const msg = newStatus === 'banned' ? '已封禁' : newStatus === 'cancelled' ? '已注销' : '已更新状态';
      ctx.body = { code: 200, message: msg, data: user };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '操作失败' };
    }
  }

  /**
   * 管理员：修改用户角色（授予/取消 管理员、商家、游客 权限）
   */
  async updateUserRole() {
    const { ctx } = this;
    const id = ctx.params.id;
    const { role: newRole } = ctx.request.body || {};
    if (!newRole || ![ 'consumer', 'merchant', 'admin' ].includes(newRole)) {
      ctx.body = { code: 400, message: '角色需为 consumer / merchant / admin' };
      return;
    }
    try {
      const user = await ctx.service.user.updateUserRoleByAdmin(id, newRole);
      const msg = newRole === 'admin' ? '已设为管理员' : newRole === 'merchant' ? '已设为商家' : '已设为游客';
      ctx.body = { code: 200, message: msg, data: user };
    } catch (error) {
      ctx.body = { code: 400, message: error.message || '操作失败' };
    }
  }

  /**
   * 记录用户行为埋点
   */
  async trackBehavior() {
    const { ctx } = this;
    const { page_path, target_id, target_type, action_type, stay_duration, search_keyword } = ctx.request.body;

    try {
      await ctx.service.userBehavior.log({
        user_id: ctx.state.user.id,
        page_path,
        target_id,
        target_type,
        action_type,
        stay_duration,
        search_keyword,
      });

      ctx.success(null, '记录成功');
    } catch (error) {
      ctx.logger.error('记录用户行为失败:', error);
      ctx.error(error.message || '记录失败', 500);
    }
  }

  /**
   * 获取用户足迹
   */
  async getFootprint() {
    const { ctx } = this;
    const { page, pageSize } = ctx.query;

    try {
      const result = await ctx.service.userBehavior.getFootprint(ctx.state.user.id, {
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20,
      });

      ctx.success(result, '获取成功');
    } catch (error) {
      ctx.error(error.message || '获取失败', 500);
    }
  }

  /**
   * 获取个性化推荐
   */
  async getRecommendations() {
    const { ctx } = this;
    const { type = 'scenic', limit = 10 } = ctx.query;

    try {
      const recommendations = await ctx.service.userBehavior.getRecommendations(ctx.state.user.id, {
        type,
        limit: parseInt(limit),
      });

      ctx.success(recommendations, '获取成功');
    } catch (error) {
      ctx.error(error.message || '获取失败', 500);
    }
  }

  /**
   * 获取用户行为统计数据（管理员）
   */
  async getBehaviorStats() {
    const { ctx } = this;
    const { startDate, endDate, groupBy = 'day', pageLimit } = ctx.query;

    try {
      const [ actionTrends, pageStats ] = await Promise.all([
        ctx.service.userBehavior.getStatistics({
          startDate,
          endDate,
          groupBy,
        }),
        ctx.service.userBehavior.getPageStatistics({
          startDate,
          endDate,
          limit: pageLimit,
        }),
      ]);

      ctx.success({ actionTrends, pageStats }, '获取成功');
    } catch (error) {
      ctx.error(error.message || '获取失败', 500);
    }
  }

  /**
   * 获取商家列表（前端使用）
   */
  async getMerchants() {
    const { ctx } = this;
    const { page = 1, limit = 10, keyword } = ctx.query;

    try {
      const data = await ctx.service.user.getMerchantsList({
        page: parseInt(page),
        limit: parseInt(limit),
        keyword,
      });
      ctx.success(data, '获取成功');
    } catch (error) {
      ctx.error(error.message || '获取失败', 500);
    }
  }
}

module.exports = UserController;

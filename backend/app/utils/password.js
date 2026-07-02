'use strict';

/**
 * 密码强度校验：8-20 位，必须同时包含字母、数字和特殊符号
 * 特殊符号允许：!@#$%^&*()_+-=[]{}|;':",.<>/?
 */
const PASSWORD_REG = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"|,.<>/?])[A-Za-z0-9!@#$%^&*()_+\-=[\]{};':"|,.<>/?]{8,20}$/;

const PASSWORD_RULE_MSG = '密码须为 8-20 位，且同时包含字母、数字和特殊符号';

/**
 * 校验密码是否符合强度要求
 * @param {string} password - 待校验密码
 * @returns {{ valid: boolean, message?: string }}
 */
function validatePassword(password) {
  if (typeof password !== 'string' || !password) {
    return { valid: false, message: '密码不能为空' };
  }
  if (password.length < 8 || password.length > 20) {
    return { valid: false, message: PASSWORD_RULE_MSG };
  }
  if (!PASSWORD_REG.test(password)) {
    return { valid: false, message: PASSWORD_RULE_MSG };
  }
  return { valid: true };
}

module.exports = {
  validatePassword,
  PASSWORD_RULE_MSG,
  PASSWORD_REG,
};

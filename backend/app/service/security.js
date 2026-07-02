'use strict';

const Service = require('egg').Service;

class SecurityService extends Service {
  /**
   * 内容安全检查（文本）
   * @param {String} content - 待检查的文本内容
   */
  async checkText(content) {
    const { app, ctx } = this;

    // 非生产环境：模拟安全检查
    if (app.config.env !== 'prod' && app.config.env !== 'production') {
      // 模拟敏感词检测
      const sensitiveWords = ['政府', '敏感', '违法', '色情', '赌博', '暴力', '恐怖'];
      const hasSensitiveWord = sensitiveWords.some(word => content.includes(word));
      
      if (hasSensitiveWord) {
        return { pass: false, message: '内容包含违规信息，请修改后重试' };
      }
      
      return { pass: true, needAudit: false, message: '开发环境安全检查通过' };
    }

    try {
      // 获取access_token
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        throw new Error('获取access_token失败');
      }

      // 调用微信内容安全接口
      const response = await app.curl(
        `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`,
        {
          method: 'POST',
          dataType: 'json',
          data: {
            content,
          },
          contentType: 'json',
        }
      );

      if (response.data.errcode === 0) {
        // 内容正常
        return { pass: true, message: '内容检查通过' };
      } else if (response.data.errcode === 87014) {
        // 内容违规
        return { pass: false, message: '内容包含违规信息，请修改后重试' };
      } else {
        // 其他错误
        app.logger.error('内容安全检查失败:', response.data);
        return { pass: false, message: '内容检查失败，请稍后重试' };
      }
    } catch (error) {
      app.logger.error('内容安全检查异常:', error);
      // 生产环境中，如果接口调用失败，应该人工审核
      // 这里为了演示，返回通过，但需要管理员审核
      return { pass: true, needAudit: true, message: '内容检查失败，将进入人工审核' };
    }
  }

  /**
   * 图片安全检查
   * @param {String} imgUrl - 图片URL
   */
  async checkImage(imgUrl) {
    const { app } = this;

    // 非生产环境：不调用微信接口，直接放行，由人工审核兜底
    if (app.config.env !== 'prod' && app.config.env !== 'production') {
      return { pass: true, needAudit: false, message: '开发环境跳过图片内容安全检查' };
    }

    try {
      // 获取access_token
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        throw new Error('获取access_token失败');
      }

      // 调用微信图片安全接口
      const response = await app.curl(
        `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${accessToken}`,
        {
          method: 'POST',
          dataType: 'json',
          data: {
            media: imgUrl,
          },
          contentType: 'json',
        }
      );

      if (response.data.errcode === 0) {
        return { pass: true, message: '图片检查通过' };
      } else if (response.data.errcode === 87014) {
        return { pass: false, message: '图片包含违规内容' };
      } else {
        app.logger.error('图片安全检查失败:', response.data);
        return { pass: false, message: '图片检查失败' };
      }
    } catch (error) {
      app.logger.error('图片安全检查异常:', error);
      return { pass: true, needAudit: true, message: '图片检查失败，将进入人工审核' };
    }
  }

  /**
   * 批量检查图片
   * @param {Array} imgUrls - 图片URL数组
   */
  async checkImages(imgUrls) {
    const results = [];

    for (const url of imgUrls) {
      const result = await this.checkImage(url);
      results.push({
        url,
        ...result,
      });

      // 如果有图片违规，直接返回
      if (!result.pass) {
        return { pass: false, message: '存在违规图片', results };
      }
    }

    return { pass: true, message: '所有图片检查通过', results };
  }

  /**
   * 获取微信access_token
   */
  async getAccessToken() {
    const { app } = this;
    const { appId, appSecret } = app.config.wechat;

    try {
      // 从缓存获取
      const cachedToken = await app.redis.get('wechat:access_token');
      if (cachedToken) {
        return cachedToken;
      }

      // 请求新的access_token
      const response = await app.curl(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
        {
          dataType: 'json',
        }
      );

      if (response.data.access_token) {
        const accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in || 7200;

        // 缓存access_token，提前5分钟过期
        await app.redis.set(
          'wechat:access_token',
          accessToken,
          'EX',
          expiresIn - 300
        );

        return accessToken;
      }

      return null;
    } catch (error) {
      app.logger.error('获取access_token失败:', error);
      return null;
    }
  }
}

module.exports = SecurityService;

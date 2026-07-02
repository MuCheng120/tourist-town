'use strict';

const Service = require('egg').Service;
const { Op } = require('sequelize');

function normalizeRows(queryResult) {
  if (Array.isArray(queryResult) && queryResult.length === 2 && Array.isArray(queryResult[0])) {
    return queryResult[0];
  }
  return Array.isArray(queryResult) ? queryResult : [];
}

class UserBehaviorService extends Service {
  /**
   * 记录用户行为
   */
  async log(data) {
    const { user_id, page_path, target_id, target_type, action_type, stay_duration, search_keyword } = data;

    try {
      await this.ctx.model.UserBehaviorLog.create({
        user_id,
        page_path,
        target_id,
        target_type,
        action_type,
        stay_duration: stay_duration || 0,
        search_keyword,
      });
      return { success: true };
    } catch (error) {
      this.logger.error('记录用户行为失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取用户足迹（按时间倒序，去重）
   */
  async getFootprint(userId, { page = 1, pageSize = 20 }) {
    const offset = (page - 1) * pageSize;

    // 查询用户访问的记录，按目标ID去重
    const { count, rows } = await this.ctx.model.UserBehaviorLog.findAndCountAll({
      where: {
        user_id: userId,
        target_type: { [Op.in]: ['scenic', 'product'] },
        action_type: 'view',
      },
      attributes: [
        'target_id',
        'target_type',
        [this.ctx.model.Sequelize.fn('MAX', this.ctx.model.Sequelize.col('created_at')), 'last_visit'],
      ],
      group: ['target_id', 'target_type'],
      order: [[this.ctx.model.Sequelize.literal('last_visit'), 'DESC']],
      limit: pageSize,
      offset,
    });

    // 获取详细信息
    const footprintList = [];
    for (const row of rows) {
      const { target_id, target_type } = row.dataValues;

      if (target_type === 'scenic') {
        const scenic = await this.ctx.model.ScenicSpot.findByPk(target_id, {
          attributes: ['id', 'name', 'cover_image', 'location', 'rating'],
        });
        if (scenic) {
          footprintList.push({
            ...scenic.dataValues,
            target_type: 'scenic',
            last_visit: row.dataValues.last_visit,
          });
        }
      } else if (target_type === 'product') {
        const product = await this.ctx.model.Product.findByPk(target_id, {
          attributes: ['id', 'name', 'cover_image', 'price', 'product_type'],
        });
        if (product) {
          footprintList.push({
            ...product.dataValues,
            target_type: 'product',
            last_visit: row.dataValues.last_visit,
          });
        }
      }
    }

    return {
      list: footprintList,
      total: count.length,
      page,
      pageSize,
    };
  }

  /**
   * 获取个性化推荐（基于协同过滤和内容推荐）
   */
  async getRecommendations(userId, { type = 'scenic', limit = 10 }) {
    // 1. 获取用户最近浏览的景点/路线
    const recentViews = await this.ctx.model.UserBehaviorLog.findAll({
      where: {
        user_id: userId,
        target_type: type,
        action_type: 'view',
      },
      attributes: ['target_id'],
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    const viewedIds = recentViews.map(v => v.target_id);
    const recommendations = [];

    if (type === 'scenic') {
      // 2. 基于标签的相似景点推荐
      const viewedSpots = await this.ctx.model.ScenicSpot.findAll({
        where: { id: { [Op.in]: viewedIds } },
        attributes: ['tags'],
      });

      // 提取所有标签
      const allTags = new Set();
      viewedSpots.forEach(spot => {
        if (spot.tags) {
          try {
            const tags = JSON.parse(spot.tags);
            for (const tag of tags) {
              allTags.add(tag);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      });

      // 3. 查找具有相似标签的其他景点
      if (allTags.size > 0) {
        const similarSpots = await this.ctx.model.ScenicSpot.findAll({
          where: {
            id: { [Op.notIn]: viewedIds.length > 0 ? viewedIds : [0] },
            status: 1,
          },
          attributes: ['id', 'name', 'cover_image', 'location', 'rating', 'tags', 'ticket_price'],
          order: [['rating', 'DESC']],
          limit,
        });

        // 计算相似度并排序
        const scoredSpots = similarSpots.map(spot => {
          let score = 0;
          if (spot.tags) {
            try {
              const tags = JSON.parse(spot.tags);
              tags.forEach(tag => {
                if (allTags.has(tag)) {
                  score += 1;
                }
              });
            } catch (e) {
              // 忽略解析错误
            }
          }
          // 综合评分：标签相似度 + 景点评分
          return {
            ...spot.dataValues,
            recommend_score: score + (spot.rating || 0),
          };
        });

        scoredSpots.sort((a, b) => b.recommend_score - a.recommend_score);
        recommendations.push(...scoredSpots.slice(0, limit));
      }

      // 4. 如果推荐不足，补充热门景点
      if (recommendations.length < limit) {
        const hotSpots = await this.ctx.model.ScenicSpot.findAll({
          where: {
            id: { [Op.notIn]: [...viewedIds, ...recommendations.map(r => r.id)] },
            status: 1,
          },
          attributes: ['id', 'name', 'cover_image', 'location', 'rating', 'ticket_price'],
          order: [['rating', 'DESC'], ['rating_count', 'DESC']],
          limit: limit - recommendations.length,
        });

        hotSpots.forEach(spot => {
          recommendations.push({
            ...spot.dataValues,
            recommend_score: spot.rating || 0,
          });
          return undefined;
        });
      }
    }

    return recommendations;
  }

  /**
   * 获取用户行为统计数据（管理员用，仅游客端 pages/ 埋点，不含 admin/、merchant/ 子包）
   */
  async getStatistics({ startDate, endDate, groupBy = 'day' }) {
    const where = {
      page_path: { [Op.like]: 'pages/%' },
    };
    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    // 按日期分组统计
    const stats = await this.ctx.model.UserBehaviorLog.findAll({
      where,
      attributes: [
        [this.ctx.model.Sequelize.fn('DATE', this.ctx.model.Sequelize.col('created_at')), 'date'],
        'target_type',
        'action_type',
        [this.ctx.model.Sequelize.fn('COUNT', '*'), 'count'],
      ],
      group: [
        this.ctx.model.Sequelize.fn('DATE', this.ctx.model.Sequelize.col('created_at')),
        'target_type',
        'action_type',
      ],
      order: [[this.ctx.model.Sequelize.fn('DATE', this.ctx.model.Sequelize.col('created_at')), 'DESC']],
    });

    return stats.map(s => s.dataValues);
  }

  /**
   * 按页面路径聚合：进入次数、带停留样本数、总/平均停留（秒）
   * 仅统计游客端路径（page_path 以 pages/ 开头），不含管理端、商家端子包。
   * 说明：小程序 onShow 上报 stay_duration=0，onHide 上报实际秒数，故 enter_count 与 stay_samples 含义不同。
   */
  async getPageStatistics({ startDate, endDate, limit = 20 }) {
    if (!startDate || !endDate) {
      return [];
    }

    const sequelize = this.app.model;
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const rows = normalizeRows(await sequelize.query(
      `
      SELECT
        page_path,
        SUM(CASE WHEN COALESCE(stay_duration, 0) > 0 THEN 1 ELSE 0 END) AS stay_samples,
        SUM(CASE WHEN COALESCE(stay_duration, 0) > 0 THEN stay_duration ELSE 0 END) AS total_stay_seconds,
        SUM(CASE WHEN COALESCE(stay_duration, 0) = 0 THEN 1 ELSE 0 END) AS enter_count
      FROM user_behavior_logs
      WHERE created_at >= :startDate
        AND created_at < DATE_ADD(:endDate, INTERVAL 1 DAY)
        AND action_type = 'view'
        AND page_path LIKE 'pages/%'
      GROUP BY page_path
      ORDER BY enter_count DESC
      LIMIT ${lim}
    `,
      {
        replacements: { startDate, endDate },
        type: sequelize.QueryTypes.SELECT,
      }
    ));

    return rows.map(r => {
      const stay_samples = parseInt(r.stay_samples, 10) || 0;
      const total_stay = parseInt(r.total_stay_seconds, 10) || 0;
      const enter_count = parseInt(r.enter_count, 10) || 0;
      return {
        page_path: r.page_path,
        enter_count,
        stay_samples,
        total_stay_seconds: total_stay,
        avg_stay_seconds: stay_samples > 0 ? Math.round(total_stay / stay_samples) : 0,
      };
    });
  }

  /**
   * 清理旧的行为日志（定时任务用）
   */
  async cleanOldLogs(days = 90) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deleted = await this.ctx.model.UserBehaviorLog.destroy({
      where: {
        created_at: { [Op.lt]: cutoffDate },
      },
    });

    this.logger.info(`清理了 ${deleted} 条 ${days} 天前的行为日志`);
    return deleted;
  }
}

module.exports = UserBehaviorService;

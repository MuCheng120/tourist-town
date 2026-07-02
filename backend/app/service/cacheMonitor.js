/**
 * 缓存监控服务
 * 用于监控缓存命中率、内存使用情况等
 */

const Service = require('egg').Service;

class CacheMonitorService extends Service {
  /**
   * 获取Redis信息
   */
  async getRedisInfo() {
    const { redis, logger } = this.app;
    try {
      const info = await redis.info();
      const infoLines = info.split('\r\n');
      const infoMap = {};

      infoLines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          infoMap[key] = value;
        }
      });

      return infoMap;
    } catch (error) {
      logger.error('[CacheMonitor] Get Redis info error:', error);
      return null;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    const { redis, logger } = this.app;
    try {
      // 获取基本信息
      const info = await this.getRedisInfo();
      if (!info) {
        return null;
      }

      // 解析关键指标
      const stats = {
        // 连接数
        connected_clients: info.connected_clients || 0,
        
        // 内存使用
        used_memory: info.used_memory_human || '0B',
        used_memory_peak: info.used_memory_peak_human || '0B',
        used_memory_percentage: this._calculateMemoryPercentage(info),
        
        // 命中率
        hits: info.keyspace_hits || 0,
        misses: info.keyspace_misses || 0,
        hit_rate: this._calculateHitRate(info),
        
        // 键数量
        total_keys: info.db0 ? this._parseDbKeys(info.db0) : 0,
        
        // 持久化
        last_save_time: info.rdb_last_save_time || 0,
        bgaving_aof: info.aof_enabled === '1',
        
        // 运行时间
        uptime_in_days: info.uptime_in_days || 0,
        uptime_in_seconds: info.uptime_in_seconds || 0,
      };

      return stats;
    } catch (error) {
      logger.error('[CacheMonitor] Get cache stats error:', error);
      return null;
    }
  }

  /**
   * 获取不同类型键的统计
   */
  async getKeyStats() {
    const { redis, logger } = this.app;
    try {
      const patterns = ['scenic:*', 'logistics:*', 'statistics:*', 'hot:*', 'visit:*'];
      const stats = {};

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        const type = pattern.split(':')[0];
        stats[type] = {
          count: keys.length,
          keys: keys.slice(0, 10), // 只返回前10个键名
        };
      }

      return stats;
    } catch (error) {
      logger.error('[CacheMonitor] Get key stats error:', error);
      return null;
    }
  }

  /**
   * 获取慢查询日志
   */
  async getSlowLog(count = 10) {
    const { redis, logger } = this.app;
    try {
      const slowLog = await redis.slowlog('get', count);
      return slowLog.map(log => ({
        id: log[0],
        timestamp: new Date(log[1] * 1000),
        duration: log[2], // 微秒
        command: log[3].join(' '),
      }));
    } catch (error) {
      logger.error('[CacheMonitor] Get slow log error:', error);
      return [];
    }
  }

  /**
   * 清理过期键
   */
  async cleanExpiredKeys() {
    const { redis, logger } = this.app;
    try {
      const patterns = ['scenic:*', 'logistics:*'];
      let totalCleaned = 0;

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        for (const key of keys) {
          const ttl = await redis.ttl(key);
          // 如果键不存在或已过期（TTL为-2）
          if (ttl === -2) {
            await redis.del(key);
            totalCleaned++;
          }
        }
      }

      logger.info(`[CacheMonitor] Cleaned ${totalCleaned} expired keys`);
      return totalCleaned;
    } catch (error) {
      logger.error('[CacheMonitor] Clean expired keys error:', error);
      return 0;
    }
  }

  /**
   * 获取内存使用详情
   */
  async getMemoryUsage() {
    const { redis, logger } = this.app;
    try {
      const info = await this.getRedisInfo();
      const memoryInfo = {
        used_memory: info.used_memory || '0',
        used_memory_human: info.used_memory_human || '0B',
        used_memory_rss: info.used_memory_rss || '0',
        used_memory_peak: info.used_memory_peak || '0',
        used_memory_peak_human: info.used_memory_peak_human || '0B',
        used_memory_percentage: this._calculateMemoryPercentage(info),
        maxmemory: info.maxmemory || '0',
        maxmemory_policy: info.maxmemory_policy || 'noeviction',
      };

      return memoryInfo;
    } catch (error) {
      logger.error('[CacheMonitor] Get memory usage error:', error);
      return null;
    }
  }

  /**
   * 重置统计信息
   */
  async resetStats() {
    const { redis, logger } = this.app;
    try {
      await redis.config('resetstat');
      logger.info('[CacheMonitor] Reset stats successfully');
      return true;
    } catch (error) {
      logger.error('[CacheMonitor] Reset stats error:', error);
      return false;
    }
  }

  /**
   * 生成缓存健康报告
   */
  async generateHealthReport() {
    const stats = await this.getCacheStats();
    const keyStats = await this.getKeyStats();
    const memoryUsage = await this.getMemoryUsage();
    const slowLogs = await this.getSlowLog(5);

    const report = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      warnings: [],
      recommendations: [],

      // 基础统计
      stats,

      // 键分布
      key_distribution: keyStats,

      // 内存使用
      memory_usage: memoryUsage,

      // 慢查询
      slow_queries: slowLogs,
    };

    // 分析健康状况
    if (stats) {
      // 命中率检查
      if (stats.hit_rate < 0.7) {
        report.status = 'warning';
        report.warnings.push(`缓存命中率偏低: ${(stats.hit_rate * 100).toFixed(2)}%`);
        report.recommendations.push('建议增加缓存时间或预热更多数据');
      }

      // 内存使用检查
      if (stats.used_memory_percentage > 80) {
        report.status = 'warning';
        report.warnings.push(`内存使用率过高: ${stats.used_memory_percentage}%`);
        report.recommendations.push('建议清理过期数据或增加内存');
      }

      // 键数量检查
      if (stats.total_keys === 0) {
        report.status = 'warning';
        report.warnings.push('缓存中没有键，可能缓存服务未正常工作');
      }
    }

    // 慢查询检查
    if (slowLogs.length > 0) {
      const avgDuration = slowLogs.reduce((sum, log) => sum + log.duration, 0) / slowLogs.length;
      if (avgDuration > 10000) { // 超过10ms
        report.recommendations.push(`检测到慢查询，平均耗时${(avgDuration / 1000).toFixed(2)}ms`);
      }
    }

    return report;
  }

  // ========== 辅助方法 ==========

  /**
   * 计算命中率
   */
  _calculateHitRate(info) {
    const hits = parseInt(info.keyspace_hits) || 0;
    const misses = parseInt(info.keyspace_misses) || 0;
    const total = hits + misses;
    
    if (total === 0) {
      return 0;
    }
    
    return hits / total;
  }

  /**
   * 计算内存使用百分比
   */
  _calculateMemoryPercentage(info) {
    const used = parseInt(info.used_memory) || 0;
    const max = parseInt(info.maxmemory) || 0;
    
    if (max === 0) {
      return 0;
    }
    
    return ((used / max) * 100).toFixed(2);
  }

  /**
   * 解析数据库键数量
   */
  _parseDbKeys(dbInfo) {
    const match = dbInfo.match(/keys=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}

module.exports = CacheMonitorService;

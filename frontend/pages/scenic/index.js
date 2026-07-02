const app = getApp();
const offlineCache = require('../../utils/offline-cache');
const networkMonitor = require('../../utils/network-monitor');
const imagePreloader = require('../../utils/image-preloader');

const SORT_OPTIONS = [
  { key: 'rating', label: '好评', desc: '根据点评分、点评条数综合排序' },
  { key: 'hot', label: '热度', desc: '' },
  // 使用单一 key 'sales'，前端通过 sortBy 值控制升/降（'sales' / 'sales_asc'）
  { key: 'sales', label: '销量', desc: '' },
  { key: 'distance', label: '距离', desc: '' },
];

/** 开启后会在控制台输出 [ScenicIndex] 前缀日志（开发者工具 → Console 过滤） */
const SCENIC_LIST_DEBUG = true;

function scenicDebug(label, payload) {
  if (!SCENIC_LIST_DEBUG) return;
  try {
    console.log(`[ScenicIndex] ${label}`, payload);
  } catch (e) {
    console.log('[ScenicIndex] log failed', e);
  }
}

Page({
  data: {
    sortOptions: SORT_OPTIONS,
    // sortBy 可为: '' | 'rating' | 'rating_asc' | 'hot' | 'hot_asc' | 'sales' | 'sales_asc' | 'distance'
    sortBy: 'rating',
    keyword: '',
    userLocation: null, // { lat, lng } 用于按距离排序
    locationError: false,
    spotList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: false,
    isOffline: false,
    fromCache: false,
  },

  onLoad() {
    networkMonitor.addListener(this.handleNetworkChange);
    this.loadSpots();
  },

  onUnload() {
    // 移除网络监听
    networkMonitor.removeListener(this.handleNetworkChange);
  },

  /**
   * 处理网络状态变化
   */
  handleNetworkChange(isConnected, networkType) {
    this.setData({
      isOffline: !isConnected
    });

    if (!isConnected) {
      // 网络断开，尝试加载缓存数据
      this.loadFromCache();
    } else {
      // 网络恢复，重新加载数据
      this.refreshData();
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore();
    }
  },

  onPullDownRefresh() {
    if (this.data.isOffline) {
      wx.showToast({
        title: '离线模式下无法刷新',
        icon: 'none',
        duration: 2000
      });
      wx.stopPullDownRefresh();
      return;
    }
    this.refreshData();
  },

  /**
   * 搜索框输入
   */
  onSearchChange(e) {
    const nextKeyword = this.normalizeKeyword(e && e.detail);
    this.setData({ keyword: nextKeyword });
  },

  /**
   * 搜索确认（回车或点击搜索）
   */
  onSearch(e) {
    const rawKeyword = (e && e.detail !== undefined) ? e.detail : this.data.keyword;
    const keyword = this.normalizeKeyword(rawKeyword);
    this.setData({
      keyword,
      spotList: [],
      page: 1,
      hasMore: true,
      fromCache: false,
    }, () => this.loadSpots());
  },

  /**
   * 构建 /api/scenic-spots 请求体：不要传 keyword: undefined，部分环境下会被序列化成字符串 "undefined"
   */
  buildScenicListRequestData({ page, pageSize, sortBy, keyword }) {
    const data = {
      page,
      pageSize,
      status: 1,
    };
    // 支持 sales_asc（销量升序）/ sales（销量降序，兼容原实现）
    if (sortBy === 'hot' || sortBy === 'rating' || sortBy === 'sales' || sortBy === 'sales_asc') {
      data.sortBy = sortBy;
    }
    if (keyword) {
      data.keyword = keyword;
    }
    return data;
  },

  normalizeKeyword(rawKeyword) {
    let value = rawKeyword;
    if (value && typeof value === 'object') {
      if (Object.prototype.hasOwnProperty.call(value, 'value')) {
        value = value.value;
      } else if (Object.prototype.hasOwnProperty.call(value, 'detail')) {
        value = value.detail;
      }
    }
    const normalized = value == null ? '' : String(value).trim();
    if (!normalized) return '';
    if (normalized === 'undefined' || normalized === 'null' || normalized === '[object Object]') {
      return '';
    }
    return normalized;
  },

  /**
   * 切换排序方式
   */
  onSortChange(e) {
    const key = e.currentTarget.dataset.key;

    // 通用三态切换：'' -> 'key' (降序) -> 'key_asc' (升序) -> ''
    // 对 distance 处理为： '' -> 'distance' (默认 asc) -> 'distance_desc' -> ''
    const cur = this.data.sortBy || '';
    let next = key;
    if (key === 'distance') {
      if (!cur) next = 'distance';
      else if (cur === 'distance') next = 'distance_desc';
      else if (cur === 'distance_desc') next = '';
      else next = 'distance';
    } else {
      const descKey = key;
      const ascKey = `${key}_asc`;
      if (!cur) next = descKey;
      else if (cur === descKey) next = ascKey;
      else if (cur === ascKey) next = '';
      else next = descKey;
    }

    // 如果是距离排序，需要先获取用户位置
    if (next && next.indexOf('distance') === 0) {
      this.setData({
        sortBy: next,
        userLocation: null,
        locationError: false,
        spotList: [],
        page: 1,
        hasMore: true,
        fromCache: false,
      }, () => this._requestLocationThenLoad(next));
    } else {
      this.setData({
        sortBy: next,
        userLocation: null,
        locationError: false,
        spotList: [],
        page: 1,
        hasMore: true,
        fromCache: false,
      }, () => this.loadSpots());
    }
  },

  /**
   * 请求定位后加载按距离排序的列表
   */
  _requestLocationThenLoad(sortBy) {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          sortBy,
          userLocation: { lat: res.latitude, lng: res.longitude },
          locationError: false,
          spotList: [],
          page: 1,
          hasMore: true,
          fromCache: false,
        }, () => this.loadSpots());
      },
      fail: (err) => {
        console.error('getLocation fail:', err);
        wx.showToast({
          title: '需要位置权限才能按距离排序',
          icon: 'none',
          duration: 2500,
        });
        this.setData({ locationError: true });
      },
    });
  },

  async loadSpots(isLoadMore = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    const { sortBy, userLocation, page, pageSize } = this.data;
    const keyword = this.normalizeKeyword(this.data.keyword);
    const isDistance = sortBy && sortBy.indexOf('distance') === 0 && userLocation && !this.data.locationError;
    const hasKeyword = !!keyword;
    let usedFromCache = false;

    scenicDebug('loadSpots:start', {
      isLoadMore,
      sortBy,
      page,
      pageSize,
      keywordRaw: this.data.keyword,
      keywordNorm: keyword,
      hasKeyword,
      isDistance,
      userLocation: isDistance ? userLocation : null,
      locationError: this.data.locationError,
    });

    try {
      let responseData;

      if (isDistance) {
        // distance 或 distance_desc
        const nearbyPayload = {
          userLat: userLocation.lat,
          userLng: userLocation.lng,
          page,
          pageSize,
          order: sortBy === 'distance_desc' ? 'desc' : 'asc',
        };
        scenicDebug('request:nearby', nearbyPayload);
        const res = await app.request({
          url: '/api/scenic-spots/nearby',
          data: nearbyPayload,
        });
        responseData = res && res.data != null ? res.data : res;
        scenicDebug('response:nearby(raw)', { type: typeof res, keys: res ? Object.keys(res) : [] });
      } else {
        const cacheKey = hasKeyword ? null : `scenic_spots_${sortBy}_page_${page}`;
        const cachedData = cacheKey ? offlineCache.get(cacheKey) : null;
        const listPayload = this.buildScenicListRequestData({
          page,
          pageSize,
          sortBy,
          keyword: hasKeyword ? keyword : '',
        });

        scenicDebug('request:list', {
          url: '/api/scenic-spots',
          data: listPayload,
          cacheKey,
          hasOfflineFallback: !!cachedData,
          cachedListLength: cachedData && Array.isArray(cachedData.list) ? cachedData.list.length : null,
        });

        const res = await networkMonitor.request(
          () => app.request({
            url: '/api/scenic-spots',
            data: listPayload,
          }),
          { useCache: !hasKeyword, cacheData: cachedData }
        );

        usedFromCache = !!res.fromCache;
        responseData = res.data;
        scenicDebug('response:list(wrap)', {
          success: res.success,
          fromCache: res.fromCache,
          payloadType: typeof responseData,
          payloadKeys: responseData && typeof responseData === 'object' ? Object.keys(responseData) : [],
          total: responseData && responseData.total,
          listLen: responseData && Array.isArray(responseData.list) ? responseData.list.length : 'not-array',
        });

        if (cacheKey && !res.fromCache && cachedData !== responseData) {
          offlineCache.set(cacheKey, responseData, 600000);
        }
      }

      const rawList = Array.isArray(responseData && responseData.list) ? responseData.list : [];
      if (!responseData || !Array.isArray(responseData.list)) {
        scenicDebug('WARN:responseData.list missing or not array', {
          responseData,
          sample: responseData && typeof responseData === 'object'
            ? JSON.stringify(responseData).slice(0, 500)
            : responseData,
        });
      }
      const list = rawList.map(spot => ({
        ...spot,
        cover_image: app.fullImageUrl(spot.cover_image),
        tag_list: spot.tag_list || [],
      }));

      if (!isDistance && list.length > 0) {
        const networkType = networkMonitor.getNetworkType();
        imagePreloader.smartPreload(
          list.map(spot => spot.cover_image).filter(Boolean),
          networkType
        );
      }

      this.setData({
        spotList: isLoadMore ? [...this.data.spotList, ...list] : list,
        hasMore: list.length >= this.data.pageSize,
        fromCache: !isDistance && usedFromCache,
      });

      scenicDebug('loadSpots:done', {
        sortBy,
        isDistance,
        listCount: list.length,
        hasMore: list.length >= this.data.pageSize,
        fromCache: !isDistance && usedFromCache,
      });

      if (!isDistance && usedFromCache) {
        wx.showToast({ title: '已加载缓存数据', icon: 'none', duration: 2000 });
      }
    } catch (error) {
      console.error('[ScenicIndex] Load spots error:', error);
      scenicDebug('loadSpots:error', {
        message: error && error.message,
        isOffline: !!(error && error.isOffline),
        errMsg: error && error.errMsg,
        code: error && error.code,
      });
      if (error.isOffline) {
        this.loadFromCache();
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 从缓存加载数据
   */
  loadFromCache() {
    const cachedData = offlineCache.getScenicList(this.data.page);
    
    if (cachedData && cachedData.list) {
      const list = cachedData.list.map(spot => ({
        ...spot,
        cover_image: app.fullImageUrl(spot.cover_image),
        tag_list: spot.tag_list || [],
      }));
      this.setData({
        spotList: list,
        hasMore: list.length >= this.data.pageSize,
        fromCache: true
      });
      
      wx.showToast({
        title: '已加载缓存数据',
        icon: 'none',
        duration: 2000
      });
    } else {
      wx.showToast({
        title: '无缓存数据',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 上拉加载更多
   */
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 }, () => this.loadSpots(true));
  },

  /**
   * 刷新数据
   */
  refreshData() {
    this.setData({
      spotList: [],
      page: 1,
      hasMore: true,
      fromCache: false,
    }, () => this.loadSpots());
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/scenic/detail?id=${id}`,
    });
  },
});

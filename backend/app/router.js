'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  const jwtAuth = app.middleware.jwtAuth();
  const optionalJwt = app.middleware.optionalJwt();

  // 用户相关路由（无需登录）
  router.get('/api/user/check-username', controller.user.checkUsername);
  router.post('/api/user/register', controller.user.register);
  router.post('/api/user/login', controller.user.accountLogin);
  router.post('/api/user/wechat-login', controller.user.wechatLogin);
  router.post('/api/user/admin-login', controller.user.adminLogin);
  router.post('/api/user/send-reset-code', controller.user.sendResetCode);
  router.post('/api/user/reset-password', controller.user.resetPassword);

  // 文件上传路由
  router.post('/api/upload', jwtAuth, controller.upload.upload);
  router.post('/api/upload/multiple', jwtAuth, controller.upload.uploadMultiple);
  router.delete('/api/upload', jwtAuth, controller.upload.delete);

  // 用户相关路由（需要登录）
  router.get('/api/user/info', jwtAuth, controller.user.getInfo);
  router.get('/api/user/merchant-application', jwtAuth, controller.user.getMerchantApplicationStatus);
  router.post('/api/user/update', jwtAuth, controller.user.updateInfo);
  router.post('/api/user/change-password', jwtAuth, controller.user.changePassword);
  router.post('/api/user/cancel-account', jwtAuth, controller.user.cancelAccount);
  router.post('/api/user/apply-merchant', jwtAuth, controller.user.applyMerchant);

  // 管理员审核路由
  router.get('/api/user/merchant-applications', jwtAuth, app.middleware.roleCheck('admin'), controller.user.getPendingMerchants);
  router.post('/api/user/:id/audit-merchant', jwtAuth, app.middleware.roleCheck('admin'), controller.user.auditMerchant);
  router.get('/api/admin/users', jwtAuth, app.middleware.roleCheck('admin'), controller.user.listUsers);
  router.get('/api/admin/merchants', jwtAuth, app.middleware.roleCheck('admin'), controller.user.listMerchants);
  router.get('/api/admin/merchants/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.user.getMerchantDetail);
  router.patch('/api/admin/users/:id/status', jwtAuth, app.middleware.roleCheck('admin'), controller.user.updateUserStatus);
  router.patch('/api/admin/users/:id/role', jwtAuth, app.middleware.roleCheck('admin'), controller.user.updateUserRole);
  router.get('/api/admin/admins', jwtAuth, app.middleware.roleCheck('admin'), controller.admin.listAdmins);
  router.post('/api/admin/admins', jwtAuth, app.middleware.roleCheck('admin'), controller.admin.createAdmin);
  router.get('/api/admin/settings', jwtAuth, app.middleware.roleCheck('admin'), controller.setting.getSettings);
  router.put('/api/admin/settings', jwtAuth, app.middleware.roleCheck('admin'), controller.setting.updateSettings);
  router.get('/api/admin/orders', jwtAuth, app.middleware.roleCheck('admin'), controller.order.adminList);
  router.post('/api/admin/orders/:id/complete-hotel', jwtAuth, app.middleware.roleCheck('admin'), controller.order.adminCompleteHotel);
  router.post('/api/admin/verify', jwtAuth, app.middleware.roleCheck('admin'), controller.order.verifyByCode);
  router.get('/api/comments/pending', jwtAuth, app.middleware.roleCheck('admin'), controller.comment.getPending);

  // 管理员商品管理（查看/审核/推荐）
  router.get('/api/admin/products', jwtAuth, app.middleware.roleCheck('admin'), controller.adminProduct.list);
  router.post('/api/admin/products/:id/audit', jwtAuth, app.middleware.roleCheck('admin'), controller.adminProduct.audit);
  router.post('/api/admin/products/:id/recommend', jwtAuth, app.middleware.roleCheck('admin'), controller.adminProduct.recommend);

  // 商品相关路由
  router.get('/api/products', controller.product.list);
  router.get('/api/products/:id', controller.product.detail);
  router.get('/api/products/:id/comments', controller.product.getComments);
  router.post('/api/products/:id/comments', jwtAuth, controller.product.addComment);
  router.post('/api/products', jwtAuth, app.middleware.roleCheck('merchant'), controller.product.create);
  router.put('/api/products/:id', jwtAuth, app.middleware.roleCheck('merchant'), controller.product.update);
  router.delete('/api/products/:id', jwtAuth, app.middleware.roleCheck('merchant'), controller.product.delete);

  // 商家相关路由
  router.get('/api/merchants', controller.user.getMerchants);

  // 订单相关路由
  router.post('/api/orders', jwtAuth, controller.order.create);
  router.get('/api/orders', jwtAuth, controller.order.list);
  router.get('/api/orders/:id', jwtAuth, controller.order.detail);
  router.post('/api/orders/:id/pay', jwtAuth, controller.order.pay);
  router.post('/api/orders/:id/mock-pay', jwtAuth, controller.order.mockPay);
  router.post('/api/orders/:id/cancel', jwtAuth, controller.order.cancel);
  router.delete('/api/orders/:id', jwtAuth, controller.order.delete);
  router.post('/api/orders/:id/refund', jwtAuth, controller.order.refund);
  router.post('/api/orders/:id/complete', jwtAuth, controller.order.complete);
  
  // 管理员超级权限 - 订单管理
  router.post('/api/orders/:id/approve-refund', jwtAuth, app.middleware.roleCheck('admin'), controller.order.approveRefund);
  router.post('/api/orders/:id/reject-refund', jwtAuth, app.middleware.roleCheck('admin'), controller.order.rejectRefund);
  router.post('/api/orders/:id/force-complete', jwtAuth, app.middleware.roleCheck('admin'), controller.order.forceComplete);

  // 物流相关路由
  router.post('/api/orders/:orderId/logistics', jwtAuth, app.middleware.roleCheck('merchant'), controller.logistics.ship);
  router.get('/api/orders/:orderId/logistics', jwtAuth, controller.logistics.query);
  router.get('/api/logistics/companies', controller.logistics.getCompanies);
  router.put('/api/orders/:orderId/logistics/tracking', jwtAuth, app.middleware.roleCheck('admin'), controller.logistics.updateTrackingNo);

  // 酒店相关路由（列表为介绍卡片，详情页内选日期与房型、评论评分）
  router.get('/api/favorites', jwtAuth, controller.favorite.list);
  router.get('/api/favorites/check', jwtAuth, controller.favorite.check);
  router.post('/api/favorites', jwtAuth, controller.favorite.add);
  router.delete('/api/favorites/:targetType/:targetId', jwtAuth, controller.favorite.remove);

  router.get('/api/hotels', controller.hotel.list);
  router.get('/api/hotels/:id', controller.hotel.detail);
  router.get('/api/hotels/:id/comments', controller.hotel.getComments);
  router.post('/api/hotels/:id/comments', jwtAuth, controller.hotel.addComment);

  router.get('/api/admin/hotels', jwtAuth, app.middleware.roleCheck('admin'), controller.hotel.listForAdmin);
  router.get('/api/admin/hotels/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.hotel.detailForAdmin);
  router.post('/api/admin/hotels', jwtAuth, app.middleware.roleCheck('admin'), controller.hotel.createForAdmin);
  router.put('/api/admin/hotels/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.hotel.updateForAdmin);
  router.delete('/api/admin/hotels/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.hotel.deleteForAdmin);
  router.get('/api/admin/tags', jwtAuth, app.middleware.roleCheck('admin'), controller.tag.listForAdmin);
  router.post('/api/admin/tags', jwtAuth, app.middleware.roleCheck('admin'), controller.tag.createForAdmin);
  router.put('/api/admin/tags/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.tag.updateForAdmin);
  router.delete('/api/admin/tags/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.tag.deleteForAdmin);

  // 房型相关路由
  router.get('/api/room-types', controller.roomType.list);
  router.get('/api/room-types/:id', controller.roomType.detail);
  router.get('/api/room-types/:id/stock', controller.roomType.checkStock);
  router.post('/api/room-types', jwtAuth, app.middleware.roleCheck('admin'), controller.roomType.create);
  router.put('/api/room-types/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.roomType.update);
  router.delete('/api/room-types/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.roomType.delete);
  router.post('/api/room-types/:id/stock', jwtAuth, app.middleware.roleCheck('admin'), controller.roomType.batchSetStock);

  // 攻略相关路由
  router.get('/api/posts', controller.post.list);
  router.get('/api/posts/my', jwtAuth, controller.post.getMyPosts);
  router.get('/api/posts/:id', optionalJwt, controller.post.detail);
  router.post('/api/posts', jwtAuth, controller.post.create);
  router.put('/api/posts/:id', jwtAuth, controller.post.update);
  router.delete('/api/posts/:id', jwtAuth, controller.post.delete);
  router.post('/api/posts/:id/publish', jwtAuth, controller.post.publishDraft);
  router.post('/api/posts/:id/hide', jwtAuth, controller.post.hide);
  router.post('/api/posts/:id/unhide', jwtAuth, controller.post.unhide);
  router.post('/api/posts/:id/like', jwtAuth, controller.post.like);
  router.post('/api/posts/:id/audit', jwtAuth, app.middleware.roleCheck('admin'), controller.post.audit);

  // 评论相关路由
  router.get('/api/posts/:postId/comments', optionalJwt, controller.comment.list);
  router.post('/api/comments', jwtAuth, controller.comment.create);
  router.delete('/api/comments/:id', jwtAuth, controller.comment.delete);
  router.post('/api/comments/:id/like', jwtAuth, controller.comment.like);
  router.post('/api/comments/:id/audit', jwtAuth, app.middleware.roleCheck('admin'), controller.comment.audit);

  // 商家端路由
  router.get('/api/merchant/dashboard/stats', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getStats);
  router.get('/api/merchant/shop-info', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getShopInfo);
  router.put('/api/merchant/shop-info', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.updateShopInfo);
  router.get('/api/merchant/comments', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getProductComments);
  router.post('/api/merchant/comments/:id/reply', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.replyProductComment);
  router.get('/api/merchant/orders', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getOrders);
  router.get('/api/merchant/orders/:id', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getOrderDetail);
  router.post('/api/merchant/orders/:id/ship', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.shipOrder);
   // 商户退款处理
  router.post('/api/merchant/orders/:id/approve-refund', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.approveRefund);
  router.post('/api/merchant/orders/:id/reject-refund', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.rejectRefund);
  router.post('/api/merchant/verify', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.verifyOrder);
  router.get('/api/merchant/products', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getProducts);
  router.get('/api/merchant/products/:id', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.getProduct);
  router.post('/api/merchant/products', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.createProduct);
  router.put('/api/merchant/products/:id', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.updateProduct);
  router.delete('/api/merchant/products/:id', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchant.deleteProduct);
  router.get('/api/merchant/coupons', jwtAuth, app.middleware.roleCheck('merchant'), controller.coupon.listForMerchant);
  router.post('/api/merchant/coupons', jwtAuth, app.middleware.roleCheck('merchant'), controller.coupon.createForMerchant);
  router.put('/api/merchant/coupons/:id/status', jwtAuth, app.middleware.roleCheck('merchant'), controller.coupon.updateStatusForMerchant);

  // 购物车相关路由
  router.get('/api/shopping-cart', jwtAuth, controller.shoppingCart.list);
  router.post('/api/shopping-cart', jwtAuth, controller.shoppingCart.add);
  router.put('/api/shopping-cart/:id', jwtAuth, controller.shoppingCart.updateQuantity);
  router.delete('/api/shopping-cart/:id', jwtAuth, controller.shoppingCart.remove);
  router.post('/api/shopping-cart/clear', jwtAuth, controller.shoppingCart.clear);
  router.post('/api/shopping-cart/batch-remove', jwtAuth, controller.shoppingCart.batchRemove);
  router.get('/api/shopping-cart/count', jwtAuth, controller.shoppingCart.count);

  // 收货地址相关路由
  router.get('/api/address/list', jwtAuth, controller.address.list);
  router.get('/api/address/default', jwtAuth, controller.address.getDefault);
  router.get('/api/address/:id', jwtAuth, controller.address.detail);
  router.post('/api/address/create', jwtAuth, controller.address.create);
  router.put('/api/address/:id', jwtAuth, controller.address.update);
  router.delete('/api/address/:id', jwtAuth, controller.address.delete);
  router.put('/api/address/:id/default', jwtAuth, controller.address.setDefault);

  // 站内信
  router.get('/api/user/messages', jwtAuth, controller.message.list);
  router.get('/api/user/messages/unread-count', jwtAuth, controller.message.unreadCount);
  router.patch('/api/user/messages/:id/read', jwtAuth, controller.message.markRead);

  // 公告相关路由
  router.get('/api/announcements', controller.announcement.list);
  router.get('/api/announcements/:id', controller.announcement.detail);
  router.post('/api/announcements', jwtAuth, app.middleware.roleCheck('admin'), controller.announcement.create);
  router.put('/api/announcements/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.announcement.update);
  router.delete('/api/announcements/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.announcement.delete);

  // Banner相关路由
  router.get('/api/banners/active', controller.banner.activeList);
  router.get('/api/banners', jwtAuth, app.middleware.roleCheck('admin'), controller.banner.list);
  router.get('/api/banners/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.banner.detail);
  router.post('/api/banners', jwtAuth, app.middleware.roleCheck('admin'), controller.banner.create);
  router.put('/api/banners/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.banner.update);
  router.delete('/api/banners/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.banner.delete);

  // 景点相关路由
  router.get('/api/scenic-spots', controller.scenicSpot.list);
  router.get('/api/scenic-spots/hot', controller.scenicSpot.listByHot);
  router.get('/api/scenic-spots/nearby', controller.scenicSpot.listByDistance);
  router.get('/api/scenic-spots/:id', controller.scenicSpot.detail);
  router.get('/api/scenic-spots/:id/comments', controller.scenicSpot.getComments);
  router.get('/api/scenic-spots/:id/comment-eligibility', jwtAuth, controller.scenicSpot.commentEligibility);
  router.post('/api/scenic-spots/:id/comments', jwtAuth, controller.scenicSpot.addComment);
  router.get('/api/admin/scenic-spots', jwtAuth, app.middleware.roleCheck('admin'), controller.scenicSpot.listForAdmin);
  router.post('/api/scenic-spots', jwtAuth, app.middleware.roleCheck('admin'), controller.scenicSpot.create);
  router.put('/api/scenic-spots/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.scenicSpot.update);
  router.delete('/api/scenic-spots/:id', jwtAuth, app.middleware.roleCheck('admin'), controller.scenicSpot.delete);

  // 统计数据相关路由（管理员）
  router.get('/api/statistics/overview', jwtAuth, app.middleware.roleCheck('admin'), controller.statistic.overview);
  router.get('/api/statistics/report', jwtAuth, app.middleware.roleCheck('admin'), controller.statistic.report);
  router.get('/api/statistics', jwtAuth, app.middleware.roleCheck('admin'), controller.statistic.statistics);
  router.post('/api/statistics/page-view', jwtAuth, controller.statistic.recordPageView);
  router.get('/api/statistics/merchants/ranking', jwtAuth, app.middleware.roleCheck('admin'), controller.statistic.merchantRanking);
  router.get('/api/statistics/products/ranking', jwtAuth, app.middleware.roleCheck('admin'), controller.statistic.productRanking);

  // 优惠券相关路由（领券中心、已领取ID 需放在 :id 之前）
  router.get('/api/coupons', jwtAuth, app.middleware.roleCheck('admin'), controller.coupon.getList);
  router.get('/api/coupons/center', controller.coupon.getCenter);
  router.get('/api/coupons/received-ids', jwtAuth, controller.coupon.getReceivedIds);
  router.get('/api/coupons/available', jwtAuth, controller.coupon.getAvailableCoupons);
  router.get('/api/coupons/my', jwtAuth, controller.coupon.getUserCoupons);
  router.get('/api/coupons/:id', controller.coupon.getDetail);
  router.post('/api/coupons', jwtAuth, app.middleware.roleCheck('admin'), controller.coupon.create);
  router.post('/api/coupons/:id/receive', jwtAuth, controller.coupon.receive);
  router.put('/api/coupons/:id/status', jwtAuth, app.middleware.roleCheck('admin'), controller.coupon.updateStatus);
  router.post('/api/coupons/use', jwtAuth, controller.coupon.use);

  // 用户行为追踪相关路由
  router.post('/api/behavior/track', jwtAuth, controller.user.trackBehavior);
  router.get('/api/behavior/footprint', jwtAuth, controller.user.getFootprint);
  router.get('/api/behavior/recommendations', jwtAuth, controller.user.getRecommendations);
  router.get('/api/behavior/statistics', jwtAuth, app.middleware.roleCheck('admin'), controller.user.getBehaviorStats);

  // 商户信用评级相关路由（静态路径必须放在 :id 前，避免被参数路由误匹配）
  router.get('/api/merchant-credit/list', jwtAuth, app.middleware.roleCheck('admin'), controller.merchantCredit.getList);
  router.get('/api/merchant-credit/statistics', jwtAuth, app.middleware.roleCheck('admin'), controller.merchantCredit.getStatistics);
  router.post('/api/merchant-credit/batch-update', jwtAuth, app.middleware.roleCheck('admin'), controller.merchantCredit.batchUpdate);
  router.post('/api/merchant-credit/violation', jwtAuth, app.middleware.roleCheck('admin'), controller.merchantCredit.recordViolation);
  router.put('/api/merchant-credit/violation/:id/resolve', jwtAuth, app.middleware.roleCheck('admin'), controller.merchantCredit.resolveViolation);
  router.put('/api/merchant-credit/:id/update', jwtAuth, app.middleware.roleCheck('admin'), controller.merchantCredit.updateLevel);
  router.get('/api/merchant-credit/:id/violations', jwtAuth, controller.merchantCredit.getViolations);
  router.get('/api/merchant-credit/:id', jwtAuth, controller.merchantCredit.getDetail);
  router.get('/api/merchant/my-credit', jwtAuth, app.middleware.roleCheck('merchant'), controller.merchantCredit.getMyCredit);

  // 系统设置：咨询电话（公开，供景点/住宿页“有疑问可致电”）
  router.get('/api/settings/contact-phone', controller.setting.getContactPhone);

  // 位置服务：逆地理编码（公开，返回城市信息）
  router.get('/api/location/reverse-geocode', controller.location.reverseGeocode);

  // 数据同步相关路由（离线缓存支持）
  router.post('/api/sync', jwtAuth, controller.sync.sync);
  router.get('/api/sync/incremental', jwtAuth, controller.sync.getIncrementalData);
  router.get('/api/sync/check-update', jwtAuth, controller.sync.checkUpdate);
};

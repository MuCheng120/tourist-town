function showModalAsync(options) {
  return new Promise(resolve => {
    wx.showModal({
      ...options,
      success: res => resolve(res),
      fail: () => resolve({ confirm: false, cancel: true }),
    });
  });
}

async function showImpactConfirm(title, impactText) {
  const res = await showModalAsync({
    title,
    content: impactText,
    confirmText: '继续',
    cancelText: '取消',
  });
  return !!res.confirm;
}

async function showFinalConfirm(actionText) {
  const res = await showModalAsync({
    title: '二次确认',
    content: `请再次确认执行“${actionText}”，此操作将写入日志。`,
    confirmText: '确认执行',
    cancelText: '再想想',
  });
  return !!res.confirm;
}

function saveActionError(ctx, actionName, id, err, payload, key = 'lastActionError') {
  ctx.setData({
    [key]: {
      actionName,
      id,
      message: (err && err.message) || '未知错误',
      payload: payload || {},
      time: new Date().toLocaleString(),
    },
  });
}

function clearActionError(ctx, key = 'lastActionError') {
  ctx.setData({ [key]: null });
}

function showLastActionError(ctx, key = 'lastActionError', idLabel = '目标ID') {
  const info = ctx.data[key];
  if (!info) {
    wx.showToast({ title: '暂无失败记录', icon: 'none' });
    return;
  }
  wx.showModal({
    title: '最近失败记录',
    showCancel: false,
    content: [
      `操作：${info.actionName}`,
      `${idLabel}：${info.id || '-'}`,
      `时间：${info.time}`,
      `原因：${info.message}`,
      `参数：${JSON.stringify(info.payload || {})}`,
    ].join('\n'),
  });
}

module.exports = {
  showImpactConfirm,
  showFinalConfirm,
  saveActionError,
  clearActionError,
  showLastActionError,
};

const ensureCloudReady = () => {
  if (!wx.cloud) {
    wx.showToast({
      title: "未初始化云环境",
      icon: "none"
    });
    return false;
  }
  return true;
};

const attachToken = (data = {}) => {
  try {
    const app = getApp?.();
    const token = (app && app.globalData && app.globalData.token) || wx.getStorageSync("token");
    if (!token) return data;
    return { ...data, token };
  } catch (err) {
    console.warn("attachToken failed", err);
    return data;
  }
};

const callFunction = (name, data = {}) => {
  if (!ensureCloudReady()) {
    return Promise.reject(new Error("云环境未初始化"));
  }
  const payload = attachToken(data);
  const handleUnauthorized = () => {
    try {
      const app = getApp?.();
      if (app?.clearAuth) app.clearAuth();
      wx.showToast({ title: "登录已过期，请重新登录", icon: "none" });
      wx.reLaunch({ url: "/pages/index/index" });
    } catch (e) {
      console.warn("handleUnauthorized failed", e);
    }
  };
  return wx.cloud
    .callFunction({
      name,
      data: payload
    })
    .then((res) => {
      const code = res?.result?.code;
      if (code === 401) handleUnauthorized();
      return res;
    })
    .catch((err) => {
      const code = err?.errCode || err?.code || err?.result?.code;
      if (code === 401) handleUnauthorized();
      return Promise.reject(err);
    });
};

const getDB = () => {
  if (!ensureCloudReady()) {
    return null;
  }
  try {
    return wx.cloud.database();
  } catch (err) {
    console.warn("获取数据库实例失败", err);
    return null;
  }
};

module.exports = {
  callFunction,
  getDB
};

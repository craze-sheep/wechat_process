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

const callFunction = (name, data = {}) => {
  if (!ensureCloudReady()) {
    return Promise.reject(new Error("云环境未初始化"));
  }
  return wx.cloud.callFunction({
    name,
    data
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

App({
  globalData: {
    role: "student",
    token: "",
    env: "dev",
    cloudEnvId: "cloud1-8gzerxc2d2e66452",
    userProfile: null
  },
  onLaunch() {
    const storedRole = wx.getStorageSync("userRole");
    if (storedRole) this.globalData.role = storedRole;
    const token = wx.getStorageSync("token");
    if (token) this.globalData.token = token;

    const storedEnv = wx.getStorageSync("cloudEnvId");
    if (storedEnv) this.globalData.cloudEnvId = storedEnv;
    this.initCloud();
  },
  initCloud() {
    if (!wx.cloud) {
      console.warn("微信基础库版本过低，无法使用云开发");
      return;
    }
    const initOptions = {
      traceUser: true
    };
    if (this.globalData.cloudEnvId) {
      initOptions.env = this.globalData.cloudEnvId;
    } else if (wx.cloud.DYNAMIC_CURRENT_ENV) {
      initOptions.env = wx.cloud.DYNAMIC_CURRENT_ENV;
      console.warn("尚未配置 cloudEnvId，已回退到当前云环境（DYNAMIC_CURRENT_ENV）");
    } else {
      console.warn("尚未配置 cloudEnvId，且无法获取当前云环境，将尝试默认环境");
    }
    try {
      wx.cloud.init(initOptions);
    } catch (err) {
      console.error("初始化云开发失败:", err);
    }
  },
  setRole(role) {
    this.globalData.role = role;
    wx.setStorageSync("userRole", role);
  },
  setToken(token) {
    this.globalData.token = token;
    wx.setStorageSync("token", token);
  },
  setCloudEnv(envId) {
    this.globalData.cloudEnvId = envId;
    wx.setStorageSync("cloudEnvId", envId);
    this.initCloud();
  },
  setUserProfile(profile) {
    this.globalData.userProfile = profile;
  }
});

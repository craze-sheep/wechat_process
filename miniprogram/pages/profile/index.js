Page({
  data: {
    profile: null,
    role: "",
    username: ""
  },
  onShow() {
    this.syncProfile();
    this.ensureAuthed();
  },
  syncProfile() {
    const app = getApp();
    const profile = (app.globalData && app.globalData.userProfile) || null;
    const role = (app.globalData && app.globalData.role) || (profile && profile.role) || "";
    this.setData({
      profile,
      role,
      username: profile?.name || profile?.username || ""
    });
  },
  ensureAuthed() {
    const app = getApp();
    const token = (app.globalData && app.globalData.token) || wx.getStorageSync("token");
    const profile = (app.globalData && app.globalData.userProfile) || null;
    if (!token || !profile) {
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },
  handleLogout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后将回到登录页，是否继续？",
      confirmText: "退出登录",
      success: (res) => {
        if (!res.confirm) return;
        const app = getApp();
        if (app.clearAuth) app.clearAuth();
        wx.showToast({ title: "已退出", icon: "none" });
        setTimeout(() => {
          wx.reLaunch({ url: "/pages/index/index" });
        }, 200);
      }
    });
  }
});

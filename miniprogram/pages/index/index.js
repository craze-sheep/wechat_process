const authService = require("../../common/services/auth");

const roleRouteMap = {
  student: "/subpackages/student/pages/home/index",
  teacher: "/subpackages/teacher/pages/courses/index",
  counselor: "/subpackages/counselor/pages/dashboard/index",
  admin: "/subpackages/admin/pages/users/index"
};

Page({
  data: {
    loggingIn: false,
    profile: null,
    loginError: "",
    username: "",
    password: "",
    showPassword: false,
    canSubmit: false
  },
  redirecting: false,
  onLoad() {
    const last = wx.getStorageSync("lastUsername");
    if (last) {
      this.setData({ username: last }, () => this.updateCanSubmit());
    }
  },
  onShow() {
    this.syncProfile();
    this.ensureSession();
  },
  syncProfile() {
    const app = getApp();
    this.setData({
      profile: (app.globalData && app.globalData.userProfile) || null
    });
  },
  ensureSession() {
    if (this.redirecting || this.data.loggingIn) return;
    const app = getApp();
    const profile = (app.globalData && app.globalData.userProfile) || null;
    const token = (app.globalData && app.globalData.token) || wx.getStorageSync("token");
    const role = (profile && profile.role) || (app.globalData && app.globalData.role);
    if (!token) {
      this.setData({ profile: null, loginError: "" });
      return;
    }
    if (profile && role) {
      this.redirectIfLogged();
      return;
    }
    this.setData({ loggingIn: true, loginError: "" });
    authService
      .login()
      .then((freshProfile) => {
        if (app.setUserProfile) app.setUserProfile(freshProfile);
        if (freshProfile?.role && app.setRole) app.setRole(freshProfile.role);
        if (freshProfile?.token && app.setToken) app.setToken(freshProfile.token);
        this.setData({ profile: freshProfile, loginError: "" });
        this.redirectIfLogged();
      })
      .catch((err) => {
        const message = err?.message || "会话已失效，请重新登录";
        this.setData({ loginError: message, profile: null });
        if (app.clearAuth) app.clearAuth();
        wx.showToast({ title: message, icon: "none" });
      })
      .finally(() => {
        this.setData({ loggingIn: false });
      });
  },
  redirectIfLogged() {
    if (this.redirecting) return;
    const app = getApp();
    const profile = (app.globalData && app.globalData.userProfile) || this.data.profile || null;
    const role = (profile && profile.role) || (app.globalData && app.globalData.role);
    const token = (app.globalData && app.globalData.token) || wx.getStorageSync("token");
    if (!token || !profile || !role) return;
    const route = roleRouteMap[role] || roleRouteMap.student;
      this.redirecting = true;
    wx.reLaunch({
      url: route,
      complete: () => {
        this.redirecting = false;
      },
      fail: (err) => {
        this.redirecting = false;
        console.warn("redirect failed", err);
        wx.showToast({
          title: "跳转失败，请重试",
          icon: "none"
        });
      }
    });
  },
  updateCanSubmit() {
    const username = (this.data.username || "").trim();
    const password = (this.data.password || "").trim();
    const canSubmit = !!username && !!password;
    if (canSubmit !== this.data.canSubmit) {
      this.setData({ canSubmit });
    }
  },
  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData(
      {
        [field]: event.detail.value
      },
      () => this.updateCanSubmit()
    );
  },
  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },
  handleSubmit() {
    if (this.data.loggingIn) {
      wx.showToast({ title: "正在登录...", icon: "none" });
      return;
    }
    const username = (this.data.username || "").trim();
    const password = (this.data.password || "").trim();
    if (!username || !password) {
      this.setData({ loginError: "请输入账号和密码" });
      wx.showToast({ title: "请输入账号和密码", icon: "none" });
      return;
    }
    this.setData({ loggingIn: true, loginError: "" });
    wx.showLoading({ title: "登录中", mask: true });
    authService
      .loginWithPassword({ username, password })
      .then((profile) => {
        const app = getApp();
        if (app.setUserProfile) app.setUserProfile(profile);
        if (profile.role && app.setRole) app.setRole(profile.role);
        if (profile.token && app.setToken) app.setToken(profile.token);
        wx.setStorageSync("lastUsername", username);
        this.setData({ profile });
        wx.showToast({ title: "登录成功", icon: "success" });
        setTimeout(() => {
          this.redirectIfLogged();
        }, 150);
      })
      .catch((err) => {
        const message = err?.message || "登录失败";
        this.setData({ loginError: message });
        wx.showToast({ title: message, icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ loggingIn: false });
        this.updateCanSubmit();
      });
  },
  handleLogin() {
    if (this.data.loggingIn || this.redirecting) return;
    if (this.data.profile) {
      wx.navigateTo({ url: "/pages/profile/index" });
      return;
    }
    this.handleSubmit();
  }
});

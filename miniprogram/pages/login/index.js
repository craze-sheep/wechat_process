const authService = require("../../common/services/auth");

Page({
  data: {
    username: "",
    password: "",
    loggingIn: false,
    errorText: "",
    showPassword: false,
    canSubmit: false
  },
  onLoad() {
    const last = wx.getStorageSync("lastUsername");
    if (last) {
      this.setData({ username: last }, () => {
        this.updateCanSubmit();
      });
    }
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
      this.setData({ errorText: "请输入账号和密码" });
      wx.showToast({ title: "请输入账号和密码", icon: "none" });
      return;
    }
    this.setData({ loggingIn: true, errorText: "" });
    wx.showLoading({ title: "登录中", mask: true });
    authService
      .loginWithPassword({ username, password })
      .then((profile) => {
        const app = getApp();
        if (app.setUserProfile) app.setUserProfile(profile);
        if (profile.role && app.setRole) app.setRole(profile.role);
        if (profile.token && app.setToken) app.setToken(profile.token);
        wx.setStorageSync("lastUsername", username);
        wx.showToast({ title: "登录成功", icon: "success" });
        setTimeout(() => {
          wx.reLaunch({ url: "/pages/index/index" });
        }, 200);
      })
      .catch((err) => {
        const message = err?.message || "登录失败";
        this.setData({ errorText: message });
        wx.showToast({ title: message, icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ loggingIn: false });
        this.updateCanSubmit();
      });
  }
});

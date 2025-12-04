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
    roles: [
      {
        key: "student",
        title: "学生端",
        subtitle: "今日课程 / 签到 / 补签",
        badge: "核心体验",
        status: "ready"
      },
      {
        key: "teacher",
        title: "教师端",
        subtitle: "发起签到 / 实时监控 / 审批",
        badge: "核心体验",
        status: "ready"
      },
      {
        key: "counselor",
        title: "辅导员端",
        subtitle: "出勤大盘 / 预警 / 跟进",
        badge: "新上线",
        status: "ready"
      },
      {
        key: "admin",
        title: "管理员端",
        subtitle: "用户 / 课程 / 系统配置",
        badge: "新上线",
        status: "ready"
      }
    ]
  },
  onShow() {
    this.syncProfile();
  },
  syncProfile() {
    const app = getApp();
    this.setData({
      profile: (app.globalData && app.globalData.userProfile) || null
    });
  },
  handleLogin() {
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true });
    authService
      .login()
      .then((profile) => {
        const app = getApp();
        if (app.setUserProfile) app.setUserProfile(profile);
        if (profile.role && app.setRole) app.setRole(profile.role);
        if (profile.token && app.setToken) app.setToken(profile.token);
        this.setData({ profile });
        wx.showToast({ title: "登录成功", icon: "success" });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "登录失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loggingIn: false });
      });
  },
  handleRoleTap(event) {
    const role = event.currentTarget.dataset.role;
    if (!role) return;
    const route = roleRouteMap[role];
    if (!route) {
      wx.showToast({
        title: "即将上线",
        icon: "none"
      });
      return;
    }
    const app = getApp();
    if (app.setRole) app.setRole(role);
    wx.navigateTo({
      url: route
    });
  }
});

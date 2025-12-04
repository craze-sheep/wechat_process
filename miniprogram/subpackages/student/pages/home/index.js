const { studentDashboardMock } = require("../../../../common/mock/student");
const { getDB } = require("../../../../common/services/cloud");
const attendanceService = require("../../../../common/services/attendance");
const { subscribeTemplateId } = require("../../../../common/config");

Page({
  data: {
    profile: studentDashboardMock.profile,
    stats: studentDashboardMock.stats,
    courses: studentDashboardMock.courses,
    reminders: studentDashboardMock.reminders,
    historyLoading: false,
    refreshing: false,
    quickActions: [
      { id: "scan", label: "扫码签到", icon: "📷", path: "/subpackages/student/pages/sign/index" },
      { id: "makeup", label: "补签申请", icon: "📝", path: "/subpackages/student/pages/makeup/index" },
      { id: "records", label: "考勤记录", icon: "📊", path: "/subpackages/student/pages/history/index" },
      { id: "messages", label: "消息通知", icon: "🔔", path: "" }
    ],
    weeklySummary: {
      normal: 0,
      late: 0,
      absent: 0
    }
  },
  onShow() {
    this.syncProfile();
    this.loadDashboard();
    this.loadReminders();
  },
  syncProfile() {
    const app = getApp();
    this.setData({
      profile: (app.globalData && app.globalData.userProfile) || studentDashboardMock.profile
    });
  },
  handleCourseTap(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/student/pages/sign/index?courseId=${id}`
    });
  },
  handleCourseLongPress(event) {
    const { name, location, time } = event.currentTarget.dataset;
    wx.showActionSheet({
      itemList: ["课程详情", "查看地点"],
      success: (res) => {
        if (res.tapIndex === 1) {
          wx.showModal({
            title: name || "课程地点",
            content: `${location || "地点待定"} · ${time || ""}`,
            showCancel: false
          });
        } else {
          wx.showToast({ title: "课程详情敬请期待", icon: "none" });
        }
      }
    });
  },
  handleHistory() {
    wx.navigateTo({
      url: "/subpackages/student/pages/history/index"
    });
  },
  handleSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [subscribeTemplateId],
      success: () => {
        wx.showToast({ title: "已订阅", icon: "success" });
      },
      fail: () => {
        wx.showToast({ title: "订阅失败", icon: "none" });
      }
    });
  },
  handleRefresh() {
    this.loadDashboard();
    this.loadReminders();
  },
  onPullDownRefresh() {
    this.handleRefresh();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 600);
  },
  handleActionTap(event) {
    const actionId = event.currentTarget.dataset.id;
    const action = this.data.quickActions.find((item) => item.id === actionId);
    if (!action) return;
    if (!action.path) {
      wx.showToast({ title: "敬请期待", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: action.path
    });
  },
  loadDashboard() {
    const db = getDB();
    this.setData({ refreshing: true });
    if (!db) {
      this.useMock();
      return;
    }
    db.collection("courses")
      .limit(3)
      .get()
      .then((res) => {
        const data = (res && res.data) || [];
        const courses =
          data.map((course) => {
            const scheduleList = course.schedule || [];
            const firstSchedule = scheduleList[0] || {};
            const upcomingTime = firstSchedule.time || "时间待定";
            const status = this.computeStatus(firstSchedule);
            return {
              id: course._id || course.courseId || course.name,
              name: course.name || "未命名课程",
              teacher: course.teacherId || "任课教师",
              time: upcomingTime,
              location: firstSchedule.location || "地点待定",
              status
            };
          }) || [];
        this.setData({
          courses: courses.length ? courses : studentDashboardMock.courses
        });
      })
      .catch(() => {
        this.useMock();
      })
      .finally(() => {
        this.setData({ refreshing: false });
      });
    this.loadStats();
  },
  useMock() {
    this.setData({
      courses: studentDashboardMock.courses,
      stats: studentDashboardMock.stats,
      reminders: studentDashboardMock.reminders,
      refreshing: false
    });
  },
  loadStats() {
    const app = getApp();
    const studentId = (app.globalData && app.globalData.userProfile && app.globalData.userProfile._id) || "";
    attendanceService
      .listRecords({ studentId })
      .then((records = []) => {
        const summary = records.reduce(
          (acc, record) => {
            acc.total += 1;
            if (record.status === "normal") acc.normal += 1;
            if (record.status === "late") acc.late += 1;
            if (record.status === "absent") acc.absent += 1;
            return acc;
          },
          { total: 0, normal: 0, late: 0, absent: 0 }
        );
        const weekAttendance =
          summary.total > 0 ? `${Math.round((summary.normal / summary.total) * 100)}%` : studentDashboardMock.stats.weekAttendance;
        this.setData({
          stats: {
            weekAttendance,
            lateCount: summary.late,
            absentCount: summary.absent,
            trend: studentDashboardMock.stats.trend
          },
          weeklySummary: {
            normal: summary.normal,
            late: summary.late,
            absent: summary.absent
          }
        });
      })
      .catch(() => {
        this.setData({
          stats: studentDashboardMock.stats,
          weeklySummary: {
            normal: studentDashboardMock.stats.normal || 0,
            late: studentDashboardMock.stats.lateCount,
            absent: studentDashboardMock.stats.absentCount
          }
        });
      });
  },
  loadReminders() {
    const db = getDB();
    if (!db) {
      this.setData({ reminders: studentDashboardMock.reminders });
      return;
    }
    const _ = db.command;
    db.collection("messages")
      .where({
        targetRole: _.in(["all", "student"])
      })
      .orderBy("createdAt", "desc")
      .limit(3)
      .get()
      .then((res) => {
        const list = (res.data || []).map((msg) => ({
          id: msg.messageId || msg._id,
          text: `${msg.title || "通知"}：${msg.content || ""}`,
          type: "info"
        }));
        this.setData({
          reminders: list.length ? list : studentDashboardMock.reminders
        });
      })
      .catch(() => {
        this.setData({ reminders: studentDashboardMock.reminders });
      });
  },
  computeStatus(schedule = {}) {
    const now = Date.now();
    const [startText, endText] = (schedule.time || "").split("-");
    const parseTime = (text) => {
      if (!text) return null;
      const [hour, minute] = text.split(":").map((value) => Number(value));
      if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      return date.getTime();
    };
    const start = parseTime(startText);
    const end = parseTime(endText);
    if (!start || !end) return "upcoming";
    if (now >= start && now <= end) return "ongoing";
    if (now > end) return "completed";
    if (start - now <= 15 * 60 * 1000) return "remind";
    return "upcoming";
  }
});

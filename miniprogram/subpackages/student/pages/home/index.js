const { getDB } = require("../../../../common/services/cloud");
const attendanceService = require("../../../../common/services/attendance");
const { subscribeTemplateId } = require("../../../../common/config");

const defaultDashboard = {
  profile: {
    name: "李明",
    major: "计算机科学与技术",
    studentNo: "2020012345"
  },
  stats: {
    weekAttendance: "95%",
    lateCount: 1,
    absentCount: 0,
    trend: "+2%"
  },
  courses: [
    {
      id: "course-001",
      name: "高等数学",
      teacher: "王老师",
      time: "08:00-09:40",
      location: "教学楼 A201",
      status: "ongoing"
    },
    {
      id: "course-002",
      name: "数据结构",
      teacher: "刘老师",
      time: "10:00-11:40",
      location: "实验楼 305",
      status: "upcoming"
    },
    {
      id: "course-003",
      name: "大学英语",
      teacher: "张老师",
      time: "14:00-15:40",
      location: "综合楼 402",
      status: "completed"
    }
  ],
  reminders: [
    {
      id: "remind-1",
      text: "10:00 数据结构课程签到将于 15 分钟后开启",
      type: "info"
    },
    {
      id: "remind-2",
      text: "上周缺勤 1 次，记得及时提交补签申请",
      type: "warning"
    }
  ]
};

Page({
  data: {
    profile: defaultDashboard.profile,
    stats: defaultDashboard.stats,
    courses: defaultDashboard.courses,
    reminders: defaultDashboard.reminders,
    historyLoading: false,
    refreshing: false,
    quickActions: [
      { id: "scan", label: "签到", icon: "📷", path: "/subpackages/student/pages/sign/index" },
      { id: "leave", label: "请假/补签", icon: "📝", path: "/subpackages/student/pages/makeup/index" },
      { id: "messages", label: "消息", icon: "🔔", path: "/pages/messages/index" }
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
        profile: (app.globalData && app.globalData.userProfile) || defaultDashboard.profile
      });
  },
  handleCourseTap(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/student/pages/sign/index?courseId=${id}`
    });
  },
  handleProfile() {
    wx.navigateTo({
      url: "/pages/profile/index"
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
      this.setData({ refreshing: false });
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
          courses
        });
        if (!courses.length) {
          wx.showToast({ title: "课程数据为空", icon: "none" });
        }
      })
      .catch(() => {
        this.setData({ courses: [] });
        wx.showToast({ title: "课程加载失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ refreshing: false });
      });
    this.loadStats();
  },
  useMock() {
      this.setData({
        courses: defaultDashboard.courses,
        stats: defaultDashboard.stats,
        reminders: defaultDashboard.reminders,
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
          summary.total > 0 ? `${Math.round((summary.normal / summary.total) * 100)}%` : defaultDashboard.stats.weekAttendance;
          this.setData({
            stats: {
              weekAttendance,
              lateCount: summary.late,
              absentCount: summary.absent,
              trend: defaultDashboard.stats.trend
            },
          weeklySummary: {
            normal: summary.normal,
            late: summary.late,
            absent: summary.absent
          }
        });
      })
      .catch(() => {
        const fallbackStats = {
          weekAttendance: defaultDashboard.stats.weekAttendance,
          lateCount: defaultDashboard.stats.lateCount,
          absentCount: defaultDashboard.stats.absentCount,
          trend: defaultDashboard.stats.trend
        };
        this.setData({
          stats: fallbackStats,
          weeklySummary: {
            normal: 0,
            late: defaultDashboard.stats.lateCount,
            absent: defaultDashboard.stats.absentCount
          }
        });
      });
  },
  loadReminders() {
    const db = getDB();
    if (!db) {
      this.setData({ reminders: defaultDashboard.reminders });
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
          reminders: list
        });
        if (!list.length) {
          wx.showToast({ title: "暂无提醒", icon: "none" });
        }
      })
      .catch(() => {
        this.setData({ reminders: [] });
        wx.showToast({ title: "提醒加载失败", icon: "none" });
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

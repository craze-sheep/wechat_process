const defaultSignMonitor = {
  batchId: "batch-123",
  courseName: "高等数学",
  total: 62,
  signed: 49,
  qrExpiredIn: 25,
  mode: "标准模式",
  qrRefreshInterval: 30,
  autoCloseMinutes: 15,
  studentsSigned: [
    { name: "李明", status: "正常", time: "08:05" },
    { name: "王强", status: "迟到", time: "08:11" }
  ],
  studentsPending: [
    { name: "赵敏", status: "未签到" },
    { name: "陈阳", status: "未签到" }
  ],
  abnormal: [
    { name: "周九", reason: "定位失败 3 次" },
    { name: "郑十", reason: "人脸识别失败 2 次" }
  ]
};
const attendanceService = require("../../../../common/services/attendance");

Page({
  data: {
    batchId: "",
    monitor: defaultSignMonitor,
    refreshing: false,
    progress: 0,
    activeTab: "signed",
    tabOptions: [
      { key: "signed", label: "已签到" },
      { key: "pending", label: "未签到" },
      { key: "abnormal", label: "异常" }
    ]
  },
  onLoad(options) {
    this.setData({
      batchId: (options && options.batchId) || defaultSignMonitor.batchId,
      monitor: {
        ...this.data.monitor,
        courseName: decodeURIComponent((options && options.courseName) || this.data.monitor.courseName)
      }
    });
    this.loadMonitor();
  },
  loadMonitor() {
    this.setData({ refreshing: true });
    Promise.all([
      attendanceService.fetchBatch({ batchId: this.data.batchId }),
      attendanceService.listRecords({ batchId: this.data.batchId })
    ])
      .then(([batch, detail]) => {
        if (!batch) return;
        const signedList = (detail && detail.signed) || defaultSignMonitor.studentsSigned;
        const pendingList = (detail && detail.pending) || defaultSignMonitor.studentsPending;
        this.setData(
          {
            monitor: {
              ...this.data.monitor,
              batchId: batch.batchId,
              courseName: batch.courseName || this.data.monitor.courseName,
              total: batch.total || this.data.monitor.total,
              signed: batch.signed || signedList.length || this.data.monitor.signed,
              qrExpiredIn: batch.expiresIn ?? 30,
              mode: batch.mode || this.data.monitor.mode,
              qrRefreshInterval: batch.qrRefreshInterval || 30,
              autoCloseMinutes: batch.autoCloseMinutes || 15,
              studentsSigned: signedList,
              studentsPending: pendingList,
              abnormal: detail?.abnormal || []
            }
          },
          () => {
            this.setupTimers();
            this.setData({ progress: this.calculateProgress(this.data.monitor) });
          }
        );
      })
      .catch(() => {
        wx.showToast({ title: "批次数据获取失败，已使用示例数据", icon: "none" });
        this.setData({ monitor: defaultSignMonitor, progress: this.calculateProgress(defaultSignMonitor) });
      })
      .finally(() => {
        this.setData({ refreshing: false });
      });
  },
  calculateProgress(monitor = this.data.monitor) {
    const { signed = 0, total = 0 } = monitor || {};
    if (!total) return 0;
    return Math.min(100, Math.round((signed / total) * 100));
  },
  setupTimers() {
    this.clearTimers();
    const interval = (this.data.monitor.qrRefreshInterval || 30) * 1000;
    if (this.data.monitor.status !== "closed") {
      this.qrTimer = setInterval(() => {
        attendanceService
          .refreshQr({ batchId: this.data.batchId })
          .then(() => this.loadMonitor())
          .catch(() => {});
      }, interval);
      const remaining = Math.max(0, this.data.monitor.expiresIn * 1000);
      this.autoCloseTimer = setTimeout(() => {
        attendanceService
          .closeBatch({ batchId: this.data.batchId })
          .then(() => {
            wx.showToast({ title: "签到已自动结束", icon: "none" });
            this.loadMonitor();
          })
          .catch(() => {});
      }, remaining);
    }
  },
  clearTimers() {
    if (this.qrTimer) {
      clearInterval(this.qrTimer);
      this.qrTimer = null;
    }
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  },
  handleRefresh() {
    this.loadMonitor();
  },
  handleEndSign() {
    wx.showModal({
      title: "结束签到",
      content: "确认结束当前签到吗？未签到学生将记为缺勤。",
      success: (res) => {
        if (res.confirm) {
          attendanceService
            .closeBatch({ batchId: this.data.batchId })
            .then(() => {
              wx.showToast({ title: "已结束", icon: "none" });
              this.loadMonitor();
            })
            .catch((err) => {
              wx.showToast({ title: err.message || "操作失败", icon: "none" });
            });
        }
      }
    });
  },
  handleRemind() {
    attendanceService
      .sendReminder({ batchId: this.data.batchId })
      .then(() => {
        wx.showToast({ title: "已提醒未签到学生", icon: "success" });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "提醒失败", icon: "none" });
      });
  },
  handleExtendTime() {
    wx.showActionSheet({
      itemList: ["延长 5 分钟", "延长 10 分钟"],
      success: (res) => {
        const minutes = res.tapIndex === 1 ? 10 : 5;
        wx.showToast({ title: `已延长${minutes}分钟`, icon: "none" });
      }
    });
  },
  handleTabChange(event) {
    const key = event.currentTarget.dataset.key;
    this.setData({ activeTab: key });
  },
  onUnload() {
    this.clearTimers();
  },
  onHide() {
    this.clearTimers();
  }
});

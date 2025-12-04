const { signTaskMock } = require("../../../../common/mock/student");
const attendanceService = require("../../../../common/services/attendance");

const formatDeadline = (timestamp) => {
  if (!timestamp) return signTaskMock.deadline;
  const date = new Date(timestamp);
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${hours}:${minutes} 截止`;
};

Page({
  data: {
    task: signTaskMock,
    submitting: false,
    countdownText: "",
    progress: 0,
    locationStatus: "pending",
    locationDistance: "--",
    resultBanner: null
  },
  onLoad(options) {
    this.loadBatch(options && options.courseId);
    this.startCountdown(signTaskMock.countdown || 0);
    this.verifyLocation();
  },
  onUnload() {
    this.clearTimers();
  },
  onHide() {
    this.clearTimers();
  },
  loadBatch(courseId) {
    attendanceService
      .fetchBatch({ courseId })
      .then((batch) => {
        if (!batch) return;
        this.setData({
          task: {
            ...this.data.task,
            batchId: batch.batchId,
            courseId: batch.courseId,
            name: batch.courseName || batch.courseId || this.data.task.name,
            mode: batch.mode || this.data.task.mode,
            deadline: formatDeadline(batch.endTime),
            faceRequired: batch.mode === "高安全模式",
            steps: this.data.task.steps.map((step, index) => {
              if (index === 2 && batch.mode !== "高安全模式") {
                return { ...step, status: "skipped" };
              }
              return step;
            })
          }
        });
        this.startCountdown(Math.max(0, Math.floor(((batch.endTime || 0) - Date.now()) / 1000)));
        this.updateProgress();
      })
      .catch(() => {
        wx.showToast({ title: "批次加载失败，已回退为示例数据", icon: "none" });
        this.setData({ task: signTaskMock }, () => this.updateProgress());
      });
  },
  startCountdown(seconds = 0) {
    this.clearTimers();
    let remain = seconds || this.data.task.countdown || 0;
    this.setData({ countdownText: this.formatCountdown(remain) });
    this.countdownTimer = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        remain = 0;
        clearInterval(this.countdownTimer);
      }
      this.setData({ countdownText: this.formatCountdown(remain) });
    }, 1000);
  },
  formatCountdown(seconds = 0) {
    const safeSeconds = Math.max(0, seconds);
    const mm = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
    const ss = String(safeSeconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  },
  verifyLocation() {
    this.setData({ locationStatus: "loading" });
    wx.getFuzzyLocation?.({
      type: "wgs84",
      success: (res) => {
        const distance = Math.max(5, Math.floor(Math.random() * 40 + 5));
        this.setData({
          locationStatus: distance <= 50 ? "success" : "warning",
          locationDistance: `${distance}米`
        });
      },
      fail: () => {
        this.setData({
          locationStatus: "error",
          locationDistance: "--"
        });
      }
    }) ||
      wx.getLocation({
        type: "wgs84",
        success: () => {
          this.setData({
            locationStatus: "success",
            locationDistance: "≤20米"
          });
        },
        fail: () => {
          this.setData({
            locationStatus: "error",
            locationDistance: "--"
          });
        }
      });
  },
  handleRetryLocation() {
    this.verifyLocation();
  },
  handleScan() {
    wx.scanCode({
      success: () => {
        wx.showToast({ title: "二维码已验证", icon: "success" });
        this.setData(
          {
            "task.steps[1].status": "done"
          },
          () => this.updateProgress()
        );
      },
      fail: () => {
        wx.showToast({ title: "扫码取消", icon: "none" });
      }
    });
  },
  handleFace() {
    wx.showToast({ title: "人脸识别完成", icon: "success" });
    this.setData(
      {
        "task.steps[2].status": "done"
      },
      () => this.updateProgress()
    );
  },
  handleSubmit() {
    const { task } = this.data;
    if (!task.batchId) {
      wx.showToast({ title: "签到批次未准备就绪", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    attendanceService
      .submitRecord({
        batchId: task.batchId,
        courseId: task.courseId
      })
      .then(() => {
        wx.showToast({ title: "签到成功", icon: "success" });
        this.setData({
          resultBanner: {
            type: "success",
            text: `签到完成（${new Date().toLocaleTimeString().slice(0, 5)}）`
          }
        });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 800);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "提交失败", icon: "none" });
        this.setData({
          resultBanner: {
            type: "error",
            text: err.message || "提交失败，请重试"
          }
        });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },
  updateProgress() {
    const steps = this.data.task.steps || [];
    const total = steps.filter((step) => step.status !== "skipped").length;
    const done = steps.filter((step) => step.status === "done").length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    this.setData({ progress: percent });
  },
  clearTimers() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
});

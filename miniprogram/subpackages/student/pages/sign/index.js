const defaultSignTask = {
  batchId: "batch-001",
  courseId: "course-001",
  name: "高等数学",
  teacher: "王老师",
  location: "教学楼 A201",
  deadline: "09:00 截止",
  mode: "标准模式",
  countdown: 180,
  distance: "23m",
  faceRequired: false,
  steps: [
    { title: "定位验证", status: "done" },
    { title: "二维码扫码", status: "pending" },
    { title: "人脸识别", status: "skipped" }
  ],
  quickActions: [
    { id: "scan", label: "扫码签到", icon: "📷", path: "/subpackages/student/pages/sign/index" },
    { id: "makeup", label: "补签申请", icon: "📝", path: "/subpackages/student/pages/makeup/index" },
    { id: "records", label: "考勤记录", icon: "📊", path: "/subpackages/student/pages/history/index" },
    { id: "messages", label: "消息通知", icon: "🔔", path: "" }
  ]
};
const attendanceService = require("../../../../common/services/attendance");

const formatDeadline = (timestamp) => {
  if (!timestamp) return defaultSignTask.deadline;
  const date = new Date(timestamp);
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${hours}:${minutes} 截止`;
};

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceMeters = (pointA = {}, pointB = {}) => {
  if (
    typeof pointA.latitude !== "number" ||
    typeof pointA.longitude !== "number" ||
    typeof pointB.latitude !== "number" ||
    typeof pointB.longitude !== "number"
  ) {
    return null;
  }
  const dLat = toRadians(pointB.latitude - pointA.latitude);
  const dLon = toRadians(pointB.longitude - pointA.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(pointA.latitude)) *
      Math.cos(toRadians(pointB.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(6371000 * c);
};

const formatDistanceLabel = (meters) => {
  if (typeof meters !== "number") return "--";
  return `${meters}米`;
};

const getBatchRadius = (batch) => {
  if (!batch?.location) return 0;
  return typeof batch.location.radius === "number" ? batch.location.radius : 50;
};

const isPermissionError = (err = {}) => {
  const message = (err.errMsg || "").toLowerCase();
  return /auth|denied|permission/.test(message);
};

Page({
  data: {
    task: defaultSignTask,
    submitting: false,
    countdownText: "",
    progress: 0,
    locationStatus: "pending",
    locationDistance: defaultSignTask.distance,
    resultBanner: null
  },
  currentBatch: null,
  currentLocationPoint: null,
  locationDistanceMeters: null,
  scanVerified: false,
  faceVerified: false,
  countdownTimer: null,
  locationSettingPrompted: false,
  onLoad(options) {
    this.loadBatch(options && options.courseId);
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
        if (!batch) {
          throw new Error("no-batch");
        }
        this.resetState();
        this.currentBatch = batch;
        const task = this.buildTaskForBatch(batch);
        this.setData(
          {
            task,
            locationStatus: "pending",
            locationDistance: "--",
            resultBanner: null
          },
          () => {
            this.updateProgress();
            const seconds = Math.max(0, Math.floor(((batch.endTime || 0) - Date.now()) / 1000));
            this.startCountdown(seconds);
            this.verifyLocation();
          }
        );
      })
      .catch(() => {
        this.resetState();
        this.currentBatch = null;
        this.setData(
          {
            task: defaultSignTask,
            locationStatus: "pending",
            locationDistance: defaultSignTask.distance,
            resultBanner: null
          },
          () => {
            this.updateProgress();
            this.startCountdown(defaultSignTask.countdown || 0);
            this.verifyLocation();
          }
        );
        wx.showToast({ title: "未找到云端签到批次，已回退到示例数据", icon: "none" });
      });
  },
  buildTaskForBatch(batch) {
    const mode = batch?.mode || defaultSignTask.mode;
    const steps = defaultSignTask.steps.map((step, index) => {
      if (index === 2 && mode !== "高安全模式") {
        return { ...step, status: "skipped" };
      }
      return { ...step, status: "pending" };
    });
    const teacherLabel = batch?.teacherName || batch?.createdBy || defaultSignTask.teacher;
    const locationLabel =
      batch?.location?.description || batch?.location?.name || defaultSignTask.location;
    return {
      ...defaultSignTask,
      batchId: batch.batchId,
      courseId: batch.courseId,
      name: batch.courseName || defaultSignTask.name,
      teacher: teacherLabel,
      location: locationLabel,
      mode,
      faceRequired: mode === "高安全模式",
      deadline: batch?.endTime ? formatDeadline(batch.endTime) : defaultSignTask.deadline,
      steps
    };
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
  resetState() {
    this.scanVerified = false;
    this.faceVerified = false;
    this.currentLocationPoint = null;
    this.locationDistanceMeters = null;
  },
  verifyLocation() {
    this.setData({ locationStatus: "loading" });
    this.requestLocation()
      .then((position) => {
        const locationPoint = {
          latitude: position.latitude,
          longitude: position.longitude
        };
        const distance = this.computeDistanceToBatch(position);
        this.currentLocationPoint = locationPoint;
        this.locationDistanceMeters = distance;
        const locationStatus = this.evaluateLocationStatus(distance);
        this.setData(
          {
            locationStatus,
            locationDistance: formatDistanceLabel(distance)
          },
          () => {
            if (locationStatus === "success") {
              this.updateStepStatus(0, "done");
            } else if (locationStatus === "warning") {
              this.updateStepStatus(0, "warning");
              wx.showToast({ title: "您距离签到地点较远，请靠近后再签到", icon: "none" });
            }
          }
        );
      })
      .catch((err) => {
        this.currentLocationPoint = null;
        this.locationDistanceMeters = null;
        this.setData(
          {
            locationStatus: "error",
            locationDistance: "--"
          },
          () => this.updateStepStatus(0, "error")
        );
        if (isPermissionError(err)) {
          this.promptLocationSettings();
        } else {
          wx.showToast({ title: "定位失败，请重试", icon: "none" });
        }
      });
  },
  computeDistanceToBatch(location) {
    if (!location) return null;
    const batchLocation = this.currentBatch?.location;
    if (batchLocation && typeof batchLocation.latitude === "number" && typeof batchLocation.longitude === "number") {
      return getDistanceMeters(
        { latitude: batchLocation.latitude, longitude: batchLocation.longitude },
        { latitude: location.latitude, longitude: location.longitude }
      );
    }
    if (typeof location.accuracy === "number") {
      return Math.round(location.accuracy);
    }
    return null;
  },
  evaluateLocationStatus(distance) {
    const radius = getBatchRadius(this.currentBatch);
    if (!radius) return "success";
    if (typeof distance !== "number") return "warning";
    return distance <= radius ? "success" : "warning";
  },
  requestLocation() {
    return new Promise((resolve, reject) => {
      const fallback = () =>
        wx.getLocation({
          type: "wgs84",
          success: resolve,
          fail: reject
        });
      if (wx.getFuzzyLocation) {
        wx.getFuzzyLocation({
          type: "wgs84",
          success: resolve,
          fail: () => fallback()
        });
        return;
      }
      fallback();
    });
  },
  promptLocationSettings() {
    if (this.locationSettingPrompted) return;
    this.locationSettingPrompted = true;
    wx.showModal({
      title: "需要定位权限",
      content: "请授权位置信息以完成签到流程",
      confirmText: "去授权",
      success: (res) => {
        if (res.confirm) {
          wx.openSetting();
        }
      },
      complete: () => {
        this.locationSettingPrompted = false;
      }
    });
  },
  handleRetryLocation() {
    this.verifyLocation();
  },
  handleScan() {
    const requestCamera = () =>
      new Promise((resolve, reject) => {
        if (!wx.authorize) {
          resolve();
          return;
        }
        wx.authorize({
          scope: "scope.camera",
          success: () => resolve(),
          fail: (err) => {
            wx.showModal({
              title: "需要摄像头权限",
              content: "扫码签到需要摄像头权限，请授权后重试",
              confirmText: "去授权",
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting({
                    success: (settings) => {
                      if (settings.authSetting && settings.authSetting["scope.camera"]) {
                        resolve();
                      } else {
                        reject(err);
                      }
                    },
                    fail: () => reject(err)
                  });
                } else {
                  reject(err);
                }
              },
              fail: () => {
                reject(err);
              }
            });
          }
        });
      });

    requestCamera()
      .then(() => {
        if (this.data.locationStatus === "error") {
          wx.showToast({ title: "请先完成定位验证", icon: "none" });
          return;
        }
        wx.scanCode({
          success: () => {
            this.scanVerified = true;
            wx.showToast({ title: "二维码已验证", icon: "success" });
            this.updateStepStatus(1, "done");
          },
          fail: () => {
            wx.showToast({ title: "扫码失败，请重试", icon: "none" });
          }
        });
      })
      .catch(() => {
        wx.showToast({ title: "未获取到摄像头权限", icon: "none" });
      });
  },
  handleFace() {
    if (!this.data.task.faceRequired) {
      wx.showToast({ title: "当前模式不需要人脸", icon: "none" });
      return;
    }
    wx.showToast({ title: "人脸识别完成", icon: "success" });
    this.faceVerified = true;
    this.updateStepStatus(2, "done");
  },
  handleSubmit() {
    const { task, locationStatus } = this.data;
    if (!task.batchId) {
      wx.showToast({ title: "签到批次未准备就绪", icon: "none" });
      return;
    }
    if (locationStatus === "loading" || locationStatus === "pending") {
      wx.showToast({ title: "请先完成定位验证", icon: "none" });
      return;
    }
    const batch = this.currentBatch;
    const radius = getBatchRadius(batch);
    if (radius > 0) {
      if (typeof this.locationDistanceMeters !== "number") {
        wx.showToast({ title: "定位信息缺失，请重试", icon: "none" });
        return;
      }
      if (this.locationDistanceMeters > radius) {
        wx.showToast({ title: "当前定位超出签到范围", icon: "none" });
        return;
      }
    }
    if (!this.scanVerified) {
      wx.showToast({ title: "请完成扫码验证", icon: "none" });
      return;
    }
    if (task.faceRequired && !this.faceVerified) {
      wx.showToast({ title: "请完成人脸识别", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    const verifyPayload = {
      location: this.currentLocationPoint
        ? {
            ...this.currentLocationPoint,
            distance: this.locationDistanceMeters
          }
        : undefined,
      qr: this.scanVerified,
      face: this.faceVerified
    };
    attendanceService
      .submitRecord({
        batchId: task.batchId,
        courseId: task.courseId,
        courseName: task.name,
        verify: verifyPayload
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
  updateStepStatus(index, status) {
    const steps = (this.data.task.steps || []).map((step, idx) =>
      idx === index ? { ...step, status } : step
    );
    this.setData({ "task.steps": steps }, () => this.updateProgress());
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
  },
  handleRefresh() {
    this.loadBatch(this.currentBatch?.courseId);
  },
  onPullDownRefresh() {
    this.handleRefresh();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 600);
  }
});

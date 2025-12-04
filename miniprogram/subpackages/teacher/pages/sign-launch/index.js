const { signLaunchDefaults, teacherCoursesMock } = require("../../../../common/mock/teacher");
const attendanceService = require("../../../../common/services/attendance");
const { getDB } = require("../../../../common/services/cloud");

Page({
  data: {
    courseId: "",
    courseName: "",
    modes: ["高安全模式", "标准模式", "便捷模式"],
    form: {
      mode: signLaunchDefaults.mode,
      duration: signLaunchDefaults.duration,
      range: signLaunchDefaults.range,
      lateBuffer: signLaunchDefaults.lateBuffer,
      qrRefreshInterval: 30,
      autoCloseMinutes: 15,
      remark: ""
    },
    submitting: false,
    courseInfo: null
  },
  onLoad(options) {
    this.setData({
      courseId: (options && options.courseId) || "",
      courseName: decodeURIComponent((options && options.courseName) || "")
    });
    this.loadCourseInfo((options && options.courseId) || "");
  },
  loadCourseInfo(courseId) {
    const db = getDB();
    if (db && courseId) {
      db.collection("courses")
        .doc(courseId)
        .get()
        .then((res) => {
          const data = res.data || {};
          const scheduleList = data.schedule || [];
          const first = scheduleList[0] || {};
          this.setData({
            courseInfo: {
              clazz: data.clazz || "未设置班级",
              time: first.time || "时间待定",
              location: first.location || "未设置位置",
              studentCount: data.studentCount || (Array.isArray(data.students) ? data.students.length : 0)
            }
          });
        })
        .catch(() => {
          this.fallbackCourseInfo();
        });
    } else {
      this.fallbackCourseInfo();
    }
  },
  fallbackCourseInfo() {
    const match =
      teacherCoursesMock.find(
        (item) => item.id === this.data.courseId || item.name === this.data.courseName
      ) || teacherCoursesMock[0];
    if (!match) return;
    this.setData({
      courseInfo: {
        clazz: match.clazz,
        time: match.schedule,
        location: match.location,
        studentCount: 0
      }
    });
  },
  handleModeChange(event) {
    const mode = this.data.modes[Number(event.detail.value)] ?? this.data.form.mode;
    this.setData({ "form.mode": mode });
  },
  handleSliderChange(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: Number(event.detail.value)
    });
  },
  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value
    });
  },
  handleRelocate() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          courseInfo: {
            ...(this.data.courseInfo || {}),
            location: res.name || `${res.latitude.toFixed(4)},${res.longitude.toFixed(4)}`
          }
        });
      }
    });
  },
  handleSubmit() {
    const payload = {
      courseId: this.data.courseId || "course-001",
      courseName: this.data.courseName || "课程签到",
      ...this.data.form,
      startTime: Date.now(),
      endTime: Date.now() + this.data.form.duration * 60 * 1000
    };
    this.setData({ submitting: true });
    attendanceService
      .startSign(payload)
      .then((batch) => {
        wx.showToast({ title: "签到已发起", icon: "success" });
        const targetBatchId = (batch && batch.batchId) || payload.batchId;
        wx.navigateTo({
          url: `/subpackages/teacher/pages/sign-monitor/index?batchId=${targetBatchId}&courseName=${encodeURIComponent(payload.courseName)}`
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "发起失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});

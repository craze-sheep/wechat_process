const attendanceService = require("../../../../common/services/attendance");

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp || Date.now());
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

Page({
  data: {
    records: [],
    displayRecords: [],
    loading: false,
    semesterOptions: ["本学期", "上学期", "更早"],
    statusOptions: ["全部", "正常", "迟到", "缺勤", "已补签"],
    courseOptions: ["全部课程"],
    filter: {
      semesterIndex: 0,
      statusIndex: 0,
      courseIndex: 0
    },
    summary: {
      total: 0,
      normal: 0,
      late: 0,
      absent: 0,
      makeup: 0
    }
  },
  onShow() {
    this.loadHistory();
  },
  onPullDownRefresh() {
    this.loadHistory();
    setTimeout(() => wx.stopPullDownRefresh(), 600);
  },
  loadHistory() {
    this.setData({ loading: true });
    const app = getApp();
    const studentId = (app.globalData && app.globalData.userProfile && app.globalData.userProfile._id) || "";
    attendanceService
      .listRecords({ studentId })
      .then((list = []) => {
        const normalized = list.map((record) => ({
          id: record.recordId || record._id,
          course: record.courseName || "未命名课程",
          status: record.status || "normal",
          time: formatDateTime(record.signedAt),
          location: record.location || record.place || "位置待定",
          mode: record.mode || "标准模式",
          canMakeup: record.status === "absent",
          remark: record.remark || "",
          timestamp: record.signedAt
        }));
        const courseOptions = ["全部课程", ...Array.from(new Set(normalized.map((item) => item.course)))];
        this.setData(
          {
            records: normalized,
            courseOptions,
            filter: {
              ...this.data.filter,
              courseIndex: Math.min(this.data.filter.courseIndex, courseOptions.length - 1)
            }
          },
          () => {
            this.applyFilters();
          }
        );
      })
      .catch(() => {
        this.setData({
          records: [],
          displayRecords: [],
          courseOptions: ["全部课程"],
          summary: { total: 0, normal: 0, late: 0, absent: 0, makeup: 0 }
        });
      })
      .finally(() => this.setData({ loading: false }));
  },
  handleFilterChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value);
    this.setData(
      {
        [`filter.${field}`]: value
      },
      () => this.applyFilters()
    );
  },
  applyFilters() {
    const { records, filter, statusOptions, courseOptions } = this.data;
    let list = records.slice();
    if (filter.semesterIndex >= 0 && records.length) {
      const currentKey = this.getTermKey(Date.now());
      const prevKey = this.shiftTermKey(currentKey, -1);
      if (filter.semesterIndex === 0) {
        const filtered = list.filter((item) => this.getTermKey(item.timestamp) === currentKey);
        list = filtered.length ? filtered : list;
      } else if (filter.semesterIndex === 1) {
        const filtered = list.filter((item) => this.getTermKey(item.timestamp) === prevKey);
        list = filtered.length ? filtered : list;
      } else {
        const filtered = list.filter((item) => {
          const key = this.getTermKey(item.timestamp);
          return key !== currentKey && key !== prevKey;
        });
        list = filtered.length ? filtered : list;
      }
    }
    if (filter.statusIndex > 0) {
      const map = ["", "normal", "late", "absent", "makeup"];
      const statusValue = map[filter.statusIndex];
      list = list.filter((item) => item.status === statusValue || (statusValue === "makeup" && item.status === "makeup"));
    }
    if (filter.courseIndex > 0) {
      const courseName = courseOptions[filter.courseIndex];
      list = list.filter((item) => item.course === courseName);
    }
    const summary = list.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === "normal") acc.normal += 1;
        if (item.status === "late") acc.late += 1;
        if (item.status === "absent") acc.absent += 1;
        if (item.status === "makeup") acc.makeup += 1;
        return acc;
      },
      { total: 0, normal: 0, late: 0, absent: 0, makeup: 0 }
    );
    this.setData({
      displayRecords: list,
      summary
    });
  },
  handleRecordTap(event) {
    const id = event.currentTarget.dataset.id;
    const target = this.data.records.find((item) => item.id === id);
    if (!target) return;
    wx.showModal({
      title: target.course,
      content: `${target.time}\n地点：${target.location}\n方式：${target.mode}\n${target.remark || ""}`,
      showCancel: false
    });
  },
  handleMakeup(event) {
    const course = event.currentTarget.dataset.course;
    const time = event.currentTarget.dataset.time;
    wx.navigateTo({
      url: `/subpackages/student/pages/makeup/index?courseName=${encodeURIComponent(course)}&time=${encodeURIComponent(time)}`
    });
  },
  getTermKey(timestamp) {
    if (!timestamp) return "unknown";
    const date = new Date(Number(timestamp));
    if (Number.isNaN(date.getTime())) return "unknown";
    const year = date.getFullYear();
    const term = date.getMonth() >= 7 ? "fall" : "spring";
    return `${year}-${term}`;
  },
  shiftTermKey(key, step = 0) {
    if (!key || key === "unknown") return "unknown";
    const [yearStr, term] = key.split("-");
    let year = Number(yearStr) || new Date().getFullYear();
    let currentTerm = term === "spring" ? "spring" : "fall";
    let offset = step;
    while (offset !== 0) {
      if (offset > 0) {
        if (currentTerm === "spring") {
          currentTerm = "fall";
        } else {
          currentTerm = "spring";
          year += 1;
        }
        offset -= 1;
      } else {
        if (currentTerm === "fall") {
          currentTerm = "spring";
        } else {
          currentTerm = "fall";
          year -= 1;
        }
        offset += 1;
      }
    }
    return `${year}-${currentTerm}`;
  }
});

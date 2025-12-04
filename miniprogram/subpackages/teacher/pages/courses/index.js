const { teacherCoursesMock } = require("../../../../common/mock/teacher");
const { getDB } = require("../../../../common/services/cloud");

Page({
  data: {
    courses: teacherCoursesMock,
    displayCourses: teacherCoursesMock,
    keyword: "",
    termOptions: ["2025秋季学期", "2025春季学期", "2024秋季学期"],
    termIndex: 0,
    stats: {
      totalCourses: teacherCoursesMock.length,
      studentTotal: 0,
      averageRate: "0%"
    }
  },
  onShow() {
    this.loadCourses();
  },
  handleInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.applyFilters());
  },
  handleTermChange(event) {
    this.setData({ termIndex: Number(event.detail.value) || 0 }, () => this.applyFilters());
  },
  handleStartSign(event) {
    const id = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    wx.navigateTo({
      url: `/subpackages/teacher/pages/sign-launch/index?courseId=${id}&courseName=${encodeURIComponent(name || "")}`
    });
  },
  handleViewStats(event) {
    const { id, name } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/subpackages/teacher/pages/course-detail/index?courseId=${id}&courseName=${encodeURIComponent(name || "")}`
    });
  },
  loadCourses() {
    const db = getDB();
    if (!db) {
      this.setData({ courses: teacherCoursesMock, displayCourses: teacherCoursesMock }, () => this.applyFilters());
      return;
    }
    db.collection("courses")
      .get()
      .then((res) => {
        const data = (res && res.data) || [];
        const courses = data.map((course) => this.normalizeCourse(course));
        const nextCourses = courses.length ? courses : teacherCoursesMock;
        this.setData({ courses: nextCourses }, () => this.applyFilters());
      })
      .catch(() => {
        this.setData({ courses: teacherCoursesMock, displayCourses: teacherCoursesMock }, () => this.applyFilters());
      });
  },
  normalizeCourse(course = {}) {
    const scheduleList = course.schedule || [];
    const firstSchedule = scheduleList[0] || {};
    const scheduleText = scheduleList.length
      ? scheduleList.map((slot) => `周${slot.weekday || "--"} ${slot.time || ""}`).join(" / ")
      : "时间待定";
    return {
      id: course._id || course.courseId,
      name: course.name || "未命名课程",
      clazz: course.clazz || "未关联班级",
      schedule: scheduleText,
      location: firstSchedule.location || "地点待定",
      attendanceRate: course.attendanceRate || "--",
      term: course.term || this.data.termOptions[0],
      studentCount: course.studentCount || (Array.isArray(course.students) ? course.students.length : 0)
    };
  },
  applyFilters() {
    let list = this.data.courses.slice();
    const selectedTerm = this.data.termOptions[this.data.termIndex];
    if (selectedTerm) {
      const filtered = list.filter((item) => item.term === selectedTerm);
      list = filtered.length ? filtered : list;
    }
    const keyword = this.data.keyword.trim();
    if (keyword) {
      list = list.filter((item) => item.name.includes(keyword) || item.clazz.includes(keyword));
    }
    const stats = this.buildStats(list);
    this.setData({
      displayCourses: list,
      stats
    });
  },
  buildStats(list) {
    if (!list.length) {
      return {
        totalCourses: 0,
        studentTotal: 0,
        averageRate: "0%"
      };
    }
    const totalCourses = list.length;
    const studentTotal = list.reduce((acc, item) => acc + (item.studentCount || 0), 0);
    const rates = list
      .map((item) => Number(String(item.attendanceRate || "0").replace("%", "")))
      .filter((value) => !Number.isNaN(value));
    const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    return {
      totalCourses,
      studentTotal,
      averageRate: `${avg}%`
    };
  }
});

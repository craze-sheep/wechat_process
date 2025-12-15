const counselorService = require("../../../../common/services/counselor");
const defaultStudentDetail = {
  base: {
    name: "张晓",
    clazz: "计科 2202",
    phone: "138****1234",
    guardian: "父亲 / 139****8888"
  },
  stats: {
    total: 42,
    normal: 34,
    late: 4,
    absent: 4,
    makeup: 2
  },
  followups: [
    { time: "2025-11-05 14:00", content: "电话联系家长，说明考勤情况", owner: "辅导员" },
    { time: "2025-11-08 09:30", content: "与学生面谈，确认近期压力大", owner: "辅导员" }
  ],
  timeline: [
    { course: "高等数学", date: "11-10", status: "缺勤" },
    { course: "计算机网络", date: "11-08", status: "迟到" },
    { course: "英语", date: "11-06", status: "补签通过" }
  ]
};

Page({
  data: {
    studentId: "",
    detail: defaultStudentDetail,
    loading: false,
    followupText: "",
    followupLoading: false
  },
  onLoad(options) {
    this.setData({
      studentId: options && options.studentId ? options.studentId : "stu_002"
    });
    this.loadDetail();
  },
  loadDetail() {
    this.setData({ loading: true });
    counselorService
      .fetchStudentDetail(this.data.studentId)
      .then((data) => {
        if (data) {
          this.setData({ detail: data });
        } else {
          this.setData({ detail: defaultStudentDetail });
        }
      })
      .catch(() => {
        this.setData({ detail: defaultStudentDetail });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
  handleFollowupInput(event) {
    this.setData({ followupText: event.detail.value });
  },
  handleAddFollowup() {
    if (!this.data.followupText.trim()) {
      wx.showToast({ title: "请输入跟进内容", icon: "none" });
      return;
    }
    this.setData({ followupLoading: true });
    counselorService
      .addFollowup({
        studentId: this.data.studentId,
        content: this.data.followupText.trim()
      })
      .then(() => {
        wx.showToast({ title: "已记录", icon: "success" });
        this.setData({ followupText: "" });
        this.loadDetail();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "记录失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ followupLoading: false });
      });
  }
});

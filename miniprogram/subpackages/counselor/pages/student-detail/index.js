const counselorService = require("../../../../common/services/counselor");
const { studentDetailMock } = require("../../../../common/mock/counselor");

Page({
  data: {
    studentId: "",
    detail: studentDetailMock,
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
          this.setData({ detail: studentDetailMock });
        }
      })
      .catch(() => {
        this.setData({ detail: studentDetailMock });
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

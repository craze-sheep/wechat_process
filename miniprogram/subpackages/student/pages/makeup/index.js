const makeupService = require("../../../../common/services/makeup");

const formatDate = (timestamp) => {
  const date = new Date(timestamp || Date.now());
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const normalizeRecords = (records = []) =>
  records.map((item) => ({
    id: item.requestId || item._id,
    course: item.courseName || item.courseId || "未命名课程",
    date: formatDate(item.createdAt),
    status: item.status || "counselor_pending",
    reason: item.reason || "--",
    approver: item.approver || "待审核"
  }));

Page({
  data: {
    form: {
      course: "",
      type: "病假",
      reason: "",
      evidence: []
    },
    submitting: false,
    records: [],
    types: ["病假", "事假", "公假", "其他"],
    loadingRecords: false,
    attachments: [],
    wordCount: 0,
    courseInfo: null
  },
  onLoad(options) {
    if (options) {
      const courseName = options.courseName ? decodeURIComponent(options.courseName) : "";
      const time = options.time ? decodeURIComponent(options.time) : "";
      if (courseName) {
        this.setData({
          "form.course": courseName,
          courseInfo: {
            name: courseName,
            time,
            location: options.location ? decodeURIComponent(options.location) : "教学楼待定"
          }
        });
      }
    }
  },
  onShow() {
    this.fetchRecords();
  },
  handleInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({
      [`form.${field}`]: value
    });
    if (field === "reason") {
      this.setData({ wordCount: value.length });
    }
  },
  handleTypeChange(event) {
    const value = event.detail.value;
    const nextType = this.data.types.includes(value)
      ? value
      : this.data.types[Number(value)] || this.data.form.type;
    this.setData({
      "form.type": nextType
    });
  },
  handleSubmit() {
    if (!this.data.form.course || !this.data.form.reason) {
      wx.showToast({ title: "请填写完整信息", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    makeupService
      .submitRequest({
      courseName: this.data.form.course,
      type: this.data.form.type,
      reason: this.data.form.reason,
      evidence: this.data.attachments
    })
      .then(() => {
        wx.showToast({ title: "已提交", icon: "success" });
        this.resetForm();
        this.fetchRecords();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "提交失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },
  fetchRecords() {
    this.setData({ loadingRecords: true });
    makeupService
      .listStudentRequests()
      .then((list = []) => {
        this.setData({ records: normalizeRecords(list) });
      })
      .catch(() => {
        this.setData({ records: [] });
      })
      .finally(() => this.setData({ loadingRecords: false }));
  },
  handleUploadEvidence() {
    const remain = 6 - this.data.attachments.length;
    if (remain <= 0) {
      wx.showToast({ title: "最多上传 6 张图片", icon: "none" });
      return;
    }
    wx.chooseMedia({
      count: remain,
      mediaType: ["image"],
      success: (res) => {
        const files = res.tempFiles || [];
        const next = files.map((file) => ({
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          path: file.tempFilePath
        }));
        this.setData({
          attachments: this.data.attachments.concat(next)
        });
      }
    });
  },
  handleRemoveAttachment(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({
      attachments: this.data.attachments.filter((item) => item.id !== id)
    });
  },
  handlePreviewAttachment(event) {
    const current = event.currentTarget.dataset.url;
    wx.previewImage({
      current,
      urls: this.data.attachments.map((item) => item.path)
    });
  },
  handleRecordTap(event) {
    const id = event.currentTarget.dataset.id;
    const target = this.data.records.find((item) => item.id === id);
    if (!target) return;
    const statusLabel = this.statusText(target.status);
    wx.showModal({
      title: target.course,
      content: `${target.date}\n状态：${statusLabel}\n理由：${target.reason}\n审批人：${target.approver}`,
      showCancel: false
    });
  },
  statusText(status) {
    const map = {
      counselor_pending: "辅导员审批中",
      counselor_approved: "辅导员已通过，等待老师",
      counselor_rejected: "辅导员已驳回",
      teacher_approved: "老师已通过",
      teacher_rejected: "老师已驳回",
      pending: "审批中",
      approved: "已通过",
      rejected: "已驳回"
    };
    return map[status] || "审批中";
  },
  resetForm() {
    this.setData({
      form: {
        course: "",
        type: "病假",
        reason: "",
        evidence: []
      },
      attachments: [],
      wordCount: 0,
      courseInfo: null
    });
  }
});

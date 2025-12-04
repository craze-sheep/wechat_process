const { approvalListMock } = require("../../../../common/mock/teacher");
const makeupService = require("../../../../common/services/makeup");

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp || Date.now());
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

Page({
  data: {
    approvals: approvalListMock,
    displayApprovals: approvalListMock,
    loading: false,
    statusOptions: ["全部", "待审批", "已通过", "已驳回"],
    statusIndex: 0,
    courseOptions: ["全部课程"],
    courseIndex: 0,
    detailVisible: false,
    currentDetail: null
  },
  onShow() {
    this.loadApprovals();
  },
  handleApprove(event) {
    const id = event.currentTarget.dataset.id;
    this.updateStatus(id, "approved");
  },
  handleReject(event) {
    const id = event.currentTarget.dataset.id;
    this.updateStatus(id, "rejected");
  },
  updateStatus(id, status) {
    wx.showLoading({ title: "提交中...", mask: true });
    makeupService
      .updateStatus({ requestId: id, status })
      .then(() => {
        wx.showToast({ title: "操作已记录", icon: "success" });
        this.setData({
          approvals: this.data.approvals.map((item) => (item.id === id ? { ...item, status } : item))
        });
        this.applyFilters();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "操作失败", icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },
  loadApprovals() {
    this.setData({ loading: true });
    makeupService
      .listPendingRequests()
      .then((list = []) => {
        const normalized =
          list.length > 0
            ? list.map((item) => ({
                id: item.requestId || item._id,
                student: item.studentName,
                course: item.courseName,
                reason: item.reason,
                submittedAt: formatDateTime(item.createdAt),
                status: item.status || "pending",
                evidence: item.evidence || "",
                type: item.type || "病假"
              }))
            : approvalListMock;
        const courseOptions = ["全部课程", ...Array.from(new Set(normalized.map((item) => item.course)))];
        this.setData(
          {
            approvals: normalized,
            courseOptions
          },
          () => this.applyFilters()
        );
      })
      .catch(() => {
        this.setData({ approvals: approvalListMock, displayApprovals: approvalListMock });
      })
      .finally(() => this.setData({ loading: false }));
  },
  handleStatusChange(event) {
    this.setData({ statusIndex: Number(event.detail.value) || 0 }, () => this.applyFilters());
  },
  handleCourseChange(event) {
    this.setData({ courseIndex: Number(event.detail.value) || 0 }, () => this.applyFilters());
  },
  applyFilters() {
    const statusMap = ["all", "pending", "approved", "rejected"];
    const targetStatus = statusMap[this.data.statusIndex];
    let list = this.data.approvals.slice();
    if (targetStatus !== "all") {
      list = list.filter((item) => item.status === targetStatus);
    }
    if (this.data.courseIndex > 0) {
      const course = this.data.courseOptions[this.data.courseIndex];
      list = list.filter((item) => item.course === course);
    }
    this.setData({ displayApprovals: list });
  },
  handleViewDetail(event) {
    const id = event.currentTarget.dataset.id;
    const target = this.data.approvals.find((item) => item.id === id);
    if (!target) return;
    this.setData({
      detailVisible: true,
      currentDetail: target
    });
  },
  handleCloseDetail() {
    this.setData({ detailVisible: false, currentDetail: null });
  }
});

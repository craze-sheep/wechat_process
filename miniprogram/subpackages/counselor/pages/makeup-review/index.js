const makeupService = require("../../../../common/services/makeup");

const normalize = (item) => ({
  id: item.requestId || item._id,
  student: item.studentName,
  course: item.courseName,
  type: item.type || "其他",
  reason: item.reason,
  submittedAt: new Date(item.createdAt || Date.now()).toLocaleString(),
  status: item.status || "pending",
  evidence: item.evidence || []
});

Page({
  data: {
    list: [],
    displayList: [],
    loading: false,
    statusOptions: ["待审批", "全部"],
    statusIndex: 0
  },
  onShow() {
    this.loadRequests();
  },
  loadRequests() {
    this.setData({ loading: true });
    makeupService
      .listPendingRequests()
      .then((list = []) => {
        const filtered = list.filter((item) => (item.type || "").includes("公假") || (item.type || "").includes("其他"));
        const normalized = filtered.map(normalize);
        this.setData({ list: normalized, displayList: normalized });
      })
      .catch(() => {
        this.setData({ list: [], displayList: [] });
      })
      .finally(() => this.setData({ loading: false }));
  },
  handleStatusChange(event) {
    this.setData({ statusIndex: Number(event.detail.value) || 0 }, () => this.applyFilters());
  },
  applyFilters() {
    let list = this.data.list.slice();
    if (this.data.statusIndex === 0) {
      list = list.filter((item) => item.status === "pending");
    }
    this.setData({ displayList: list });
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
    makeupService
      .updateStatus({ requestId: id, status })
      .then(() => {
        wx.showToast({ title: "已更新", icon: "success" });
        this.loadRequests();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "操作失败", icon: "none" });
      });
  }
});

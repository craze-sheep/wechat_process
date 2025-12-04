const counselorService = require("../../../../common/services/counselor");
const { alertsMock } = require("../../../../common/mock/counselor");

Page({
  data: {
    list: alertsMock,
    displayList: alertsMock,
    loading: false,
    selecting: false,
    selectedIds: [],
    levelOptions: ["全部级别", "关注", "严重"],
    levelIndex: 0
  },
  onShow() {
    this.fetchAlerts();
  },
  fetchAlerts() {
    this.setData({ loading: true });
    counselorService
      .fetchAlerts()
      .then((data) => {
        if (data && data.length) {
          this.setData({ list: data, displayList: data });
        } else {
          this.setData({ list: alertsMock, displayList: alertsMock });
        }
      })
      .catch(() => {
        this.setData({ list: alertsMock, displayList: alertsMock });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
  handleStudentTap(event) {
    if (this.data.selecting) return;
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/subpackages/counselor/pages/student-detail/index?studentId=${id}`
    });
  },
  handleToggleSelect() {
    this.setData({
      selecting: !this.data.selecting,
      selectedIds: []
    });
  },
  handleSelectChange(event) {
    this.setData({
      selectedIds: event.detail.value || []
    });
  },
  handleBulkResolve() {
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: "请选择需要处理的预警", icon: "none" });
      return;
    }
    counselorService
      .updateAlertStatus({ ids: this.data.selectedIds, status: "closed" })
      .then(() => {
        wx.showToast({ title: "已批量处理", icon: "success" });
        this.fetchAlerts();
        this.setData({ selecting: false, selectedIds: [] });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "处理失败", icon: "none" });
      });
  },
  handleResolveSingle(event) {
    const id = event.currentTarget.dataset.id;
    counselorService
      .updateAlertStatus({ alertId: id, status: "closed" })
      .then(() => {
        wx.showToast({ title: "已处理", icon: "success" });
        this.fetchAlerts();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "操作失败", icon: "none" });
      });
  },
  handleLevelChange(event) {
    this.setData({ levelIndex: Number(event.detail.value) || 0 }, () => this.applyFilters());
  },
  applyFilters() {
    const level = this.data.levelIndex;
    let list = this.data.list.slice();
    if (level === 1) {
      list = list.filter((item) => item.level !== "serious");
    } else if (level === 2) {
      list = list.filter((item) => item.level === "serious");
    }
    this.setData({ displayList: list });
  },
  handleContact(event) {
    const id = event.currentTarget.dataset.id;
    const student = event.currentTarget.dataset.student;
    wx.showActionSheet({
      itemList: ["电话联系家长", "电话联系学生", "线下面谈"],
      success: (res) => {
        const templates = ["电话联系家长", "电话联系学生", "线下面谈"];
        const content = `${templates[res.tapIndex]} - ${student}`;
        counselorService
          .addFollowup({ studentId: id, content })
          .then(() => wx.showToast({ title: "已记录", icon: "success" }))
          .catch((err) => wx.showToast({ title: err.message || "记录失败", icon: "none" }));
      }
    });
  }
});

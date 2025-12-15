const counselorService = require("../../../../common/services/counselor");
const defaultOverview = {
  grade: "2022级计科",
  overallRate: "93%",
  lateCount: 5,
  absentCount: 2,
  alerts: 4,
  trend: "+1.5%",
  classes: [
    { name: "计科 2201", rate: "95%", status: "good" },
    { name: "计科 2202", rate: "90%", status: "warn" },
    { name: "计科 2203", rate: "88%", status: "risk" }
  ]
};

Page({
  data: {
    overview: defaultOverview,
    loading: false,
    gradeOptions: ["2022级", "2023级", "2024级"],
    majorOptions: ["计算机科学", "软件工程", "信息安全"],
    classOptions: ["全部班级", "计科 2201", "计科 2202", "计科 2203"],
    filters: {
      gradeIndex: 0,
      majorIndex: 0,
      classIndex: 0
    }
  },
  onShow() {
    this.loadOverview();
  },
  loadOverview() {
    this.setData({ loading: true });
    counselorService
      .fetchDashboard()
      .then((data) => {
        if (data) {
          this.setData({ overview: data });
        }
      })
      .catch(() => {
        this.setData({ overview: defaultOverview });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
  handleViewAlerts() {
    wx.navigateTo({
      url: "/subpackages/counselor/pages/alerts/index"
    });
  },
  handleFilterChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value) || 0;
    this.setData(
      {
        [`filters.${field}`]: value
      },
      () => this.loadOverview()
    );
  },
  handleQuickMakeup() {
    wx.navigateTo({
      url: "/subpackages/counselor/pages/makeup-review/index"
    });
  }
});

const adminService = require("../../../../common/services/admin");

Page({
  data: {
    list: [],
    loading: false
  },
  onShow() {
    this.loadCourses();
  },
  loadCourses() {
    this.setData({ loading: true });
    adminService
      .listCourses()
      .then((data) => {
        this.setData({ list: data && data.length ? data : [] });
      })
      .catch(() => {
        this.setData({ list: [] });
      })
      .finally(() => this.setData({ loading: false }));
  }
});

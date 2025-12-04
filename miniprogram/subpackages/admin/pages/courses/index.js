const adminService = require("../../../../common/services/admin");
const { adminCoursesMock } = require("../../../../common/mock/admin");

Page({
  data: {
    list: adminCoursesMock,
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
        this.setData({ list: data && data.length ? data : adminCoursesMock });
      })
      .catch(() => {
        this.setData({ list: adminCoursesMock });
      })
      .finally(() => this.setData({ loading: false }));
  }
});

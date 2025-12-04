const adminService = require("../../../../common/services/admin");
const { adminUsersMock } = require("../../../../common/mock/admin");

Page({
  data: {
    list: adminUsersMock,
    displayList: adminUsersMock,
    filter: "",
    loading: false
  },
  onShow() {
    this.loadUsers();
  },
  handleInput(event) {
    const filter = event.detail.value;
    this.setData({ filter });
    this.filterList(filter);
  },
  loadUsers() {
    this.setData({ loading: true });
    adminService
      .listUsers()
      .then((data) => {
        const list = data && data.length ? data : adminUsersMock;
        this.setData({
          list,
          displayList: list
        });
      })
      .catch(() => {
        this.setData({ list: adminUsersMock, displayList: adminUsersMock });
      })
      .finally(() => this.setData({ loading: false }));
  },
  filterList(keyword) {
    const trimmed = keyword.trim();
    if (!trimmed) {
      this.setData({ displayList: this.data.list });
      return;
    }
    const filtered = this.data.list.filter((item) => item.name.includes(trimmed) || item.role.includes(trimmed));
    this.setData({ displayList: filtered });
  }
});

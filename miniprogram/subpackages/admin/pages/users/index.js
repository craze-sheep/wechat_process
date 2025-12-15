const adminService = require("../../../../common/services/admin");

Page({
  data: {
    list: [],
    displayList: [],
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
        const list = data && data.length ? data : [];
        this.setData({
          list,
          displayList: list
        });
      })
      .catch(() => {
        this.setData({ list: [], displayList: [] });
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

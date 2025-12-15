const notificationService = require("../../common/services/notification");

Page({
  data: {
    loading: false,
    refreshing: false,
    items: [],
    error: ""
  },
  formatTime(ts) {
    if (!ts) return "";
    const date = new Date(ts);
    const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
      date.getMinutes()
    )}`;
  },
  onShow() {
    this.loadMessages();
  },
  loadMessages() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: "" });
    notificationService
      .list({ limit: 50 })
      .then((list = []) => {
        const mapped = list.map((item) => ({
          ...item,
          displayTime: this.formatTime(item.createdAt)
        }));
        this.setData({ items: mapped });
      })
      .catch((err) => {
        const message = err?.message || "加载消息失败";
        this.setData({ error: message });
        wx.showToast({ title: message, icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false, refreshing: false });
      });
  },
  handleMarkRead(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) return;
    const items = (this.data.items || []).map((item) =>
      item.id === id ? { ...item, read: true } : item
    );
    this.setData({ items });
    notificationService.markRead({ messageId: id }).catch(() => {});
  },
  handleRetry() {
    this.loadMessages();
  },
  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadMessages();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 600);
  }
});

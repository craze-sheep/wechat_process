const adminService = require("../../../../common/services/admin");
const XLSX = require("../../../../common/utils/xlsx");

const defaultOverview = {
  userTotal: 0,
  teacherTotal: 0,
  counselorTotal: 0,
  pendingApprovals: 0,
  services: [],
  logs: []
};

Page({
  data: {
    overview: defaultOverview,
    logs: [],
    loading: false,
    bulkLoading: false,
    notifyLoading: false,
    notifyTitle: "",
    notifyContent: "",
    messages: [],
    importing: false,
    exporting: false,
    serviceStatus: defaultOverview.services
  },
  onShow() {
    this.loadOverview();
    this.loadMessages();
  },
  loadOverview() {
    this.setData({ loading: true });
    adminService
      .fetchOverview()
      .then((data) => {
        this.setData({
          overview: data || defaultOverview,
          logs: (data && data.logs) || defaultOverview.logs,
          serviceStatus: (data && data.services) || defaultOverview.services
        });
      })
      .catch(() => {
        this.setData({
          overview: defaultOverview,
          logs: defaultOverview.logs,
          serviceStatus: defaultOverview.services
        });
      })
      .finally(() => this.setData({ loading: false }));
  },
  loadMessages() {
    adminService
      .listMessages()
      .then((list) => {
        this.setData({ messages: list || [] });
      })
      .catch(() => this.setData({ messages: [] }));
  },
  handleBulkSync() {
    if (this.data.bulkLoading) return;
    this.setData({ bulkLoading: true });
    adminService
      .bulkUpsertUsers([
        { _id: "stu_sync_01", name: "测试学生A", role: "student", department: "计算机学院", status: "active" },
        { _id: "tch_sync_01", name: "测试教师A", role: "teacher", department: "数学学院", status: "active" }
      ])
      .then(() => {
        wx.showToast({ title: "同步完成", icon: "success" });
        this.loadOverview();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "同步失败", icon: "none" });
      })
      .finally(() => this.setData({ bulkLoading: false }));
  },
  handleNotifyInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },
  handleOpenMessages() {
    wx.navigateTo({
      url: "/pages/messages/index"
    });
  },
  handleSendNotification() {
    if (this.data.notifyLoading) return;
    if (!this.data.notifyTitle || !this.data.notifyContent) {
      wx.showToast({ title: "请填写标题和内容", icon: "none" });
      return;
    }
    this.setData({ notifyLoading: true });
    adminService
      .sendNotification({
        title: this.data.notifyTitle,
        content: this.data.notifyContent,
        targetRole: "all"
      })
      .then(() => {
        wx.showToast({ title: "已发送", icon: "success" });
        this.setData({ notifyTitle: "", notifyContent: "" });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "发送失败", icon: "none" });
      })
      .finally(() => this.setData({ notifyLoading: false }));
  },
  handleImportCourses() {
    if (this.data.importing) return;
    wx.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["xlsx", "xls"],
      success: (res) => {
        const file = res.tempFiles[0];
        if (!file) return;
        this.parseExcel(file.path);
      },
      fail: () => {
        wx.showToast({ title: "选择文件失败", icon: "none" });
      }
    });
  },
  parseExcel(path) {
    this.setData({ importing: true });
    const fs = wx.getFileSystemManager();
    fs.readFile({
      filePath: path,
      success: (res) => {
        try {
          const workbook = XLSX.read(res.data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          if (!json.length) {
            wx.showToast({ title: "空文件", icon: "none" });
            return;
          }
          const headers = Object.keys(json[0]);
          if (headers.includes("role")) {
            adminService
              .bulkUpsertUsers(
                json.map((row) => ({
                  _id: row.id || row._id || `user_${Date.now()}`,
                  name: row.name,
                  role: row.role,
                  department: row.dept || row.department,
                  status: row.status || "active"
                }))
              )
              .then(() => {
                wx.showToast({ title: "用户导入成功", icon: "success" });
                this.loadOverview();
              })
              .catch((err) => {
                wx.showToast({ title: err.message || "导入失败", icon: "none" });
              });
          } else if (headers.includes("clazz")) {
            adminService
              .importCourses(
                json.map((row) => ({
                  _id: row.id || row._id || `course_${Date.now()}`,
                  name: row.name,
                  teacherId: row.teacher || row.teacherId,
                  clazz: row.clazz,
                  defaultMode: row.defaultMode || "标准模式"
                }))
              )
              .then(() => {
                wx.showToast({ title: "课程导入成功", icon: "success" });
                this.loadOverview();
              })
              .catch((err) => {
                wx.showToast({ title: err.message || "导入失败", icon: "none" });
              });
          } else {
            wx.showToast({ title: "未识别的模板", icon: "none" });
          }
        } catch (err) {
          wx.showToast({ title: err.message || "解析失败", icon: "none" });
        }
      },
      fail: () => {
        wx.showToast({ title: "读取失败", icon: "none" });
      },
      complete: () => this.setData({ importing: false })
    });
  },
  handleExportMessages() {
    if (!this.data.messages.length || this.data.exporting) {
      wx.showToast({ title: "暂无可导出的通知", icon: "none" });
      return;
    }
    this.setData({ exporting: true });
    try {
      const sheetData = [
        ["标题", "内容", "时间"],
        ...this.data.messages.map((item) => [item.title, item.content, item.time])
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "通知");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/notifications.xlsx`;
      fs.writeFile({
        filePath,
        data: buffer,
        encoding: "binary",
        success: () => {
          wx.openDocument({
            filePath,
            showMenu: true
          });
        },
        fail: () => {
          wx.showToast({ title: "导出失败", icon: "none" });
        },
        complete: () => this.setData({ exporting: false })
      });
    } catch (err) {
      this.setData({ exporting: false });
      wx.showToast({ title: err.message || "导出失败", icon: "none" });
    }
  }
});

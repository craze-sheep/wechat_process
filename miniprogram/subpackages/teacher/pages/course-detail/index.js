const attendanceService = require("../../../../common/services/attendance");
const { getDB } = require("../../../../common/services/cloud");
const defaultTeacherCourses = [
  {
    id: "course-001",
    name: "高等数学",
    clazz: "计科 2001",
    schedule: "周一 08:00-09:40",
    location: "教学楼 A201",
    attendanceRate: "96%"
  },
  {
    id: "course-002",
    name: "数据结构",
    clazz: "计科 2002",
    schedule: "周三 10:00-11:40",
    location: "实验楼 305",
    attendanceRate: "92%"
  }
];

const defaultCourseDetail = defaultTeacherCourses[0];
const XLSX = require("../../../../common/utils/xlsx");

const formatDateTime = (timestamp) => {
  const date = new Date(timestamp || Date.now());
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

Page({
  data: {
    courseId: "",
    courseName: "",
    detail: null,
    allRecords: [],
    stats: {
      total: 0,
      normal: 0,
      late: 0,
      absent: 0
    },
    records: [],
    loading: false,
    exporting: false,
    rangeOptions: ["最近7次", "最近30次", "全部"],
    rangeIndex: 0,
    anomalies: [],
    chartConfig: {
      lazyLoad: true
    },
    pieConfig: {
      lazyLoad: true
    }
  },
  onLoad(options) {
    this.setData({
      courseId: (options && options.courseId) || "",
      courseName: decodeURIComponent((options && options.courseName) || "")
    });
    this.loadDetail();
  },
  loadDetail() {
    this.setData({ loading: true });
    const db = getDB();
    const coursePromise =
      db && this.data.courseId
        ? db
            .collection("courses")
            .doc(this.data.courseId)
            .get()
            .then((res) => res.data)
            .catch(() => defaultTeacherCourses[0])
        : Promise.resolve(defaultTeacherCourses[0]);
    Promise.all([coursePromise, attendanceService.listRecords({ courseId: this.data.courseId })])
      .then(([course, listResult]) => {
        const rawRecords = Array.isArray(listResult) ? listResult : listResult?.signed || [];
        const records = rawRecords.map((record) => ({
          id: record.recordId || record._id,
          student: record.studentName || record.studentId,
          status: record.status || "normal",
          time: formatDateTime(record.signedAt),
          timestamp: record.signedAt
        }));
        this.setData(
          {
            detail: course,
            allRecords: records
          },
          () => this.applyRangeFilter()
        );
      })
      .catch(() => {
        this.setData({
          detail: defaultTeacherCourses[0],
          stats: {
            total: 0,
            normal: 0,
            late: 0,
            absent: 0
          },
          records: [],
          allRecords: []
        });
      })
      .finally(() => this.setData({ loading: false }));
  },
  handleRangeChange(event) {
    this.setData({ rangeIndex: Number(event.detail.value) || 0 }, () => this.applyRangeFilter());
  },
  applyRangeFilter() {
    let list = this.data.allRecords.slice();
    if (!list.length) {
      this.setData({ records: [], stats: { total: 0, normal: 0, late: 0, absent: 0 }, anomalies: [] });
      return;
    }
    if (this.data.rangeIndex === 0) {
      list = list.slice(-7);
    } else if (this.data.rangeIndex === 1) {
      list = list.slice(-30);
    }
    const stats = list.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "normal") acc.normal += 1;
        if (record.status === "late") acc.late += 1;
        if (record.status === "absent") acc.absent += 1;
        return acc;
      },
      { total: 0, normal: 0, late: 0, absent: 0 }
    );
    this.setData(
      {
        records: list,
        stats
      },
      () => {
        this.initCharts(list, stats);
        this.updateAnomalies(list);
      }
    );
  },
  updateAnomalies(records = []) {
    const summary = {};
    records.forEach((record) => {
      const key = record.student || "未知";
      if (!summary[key]) summary[key] = { late: 0, absent: 0 };
      if (record.status === "late") summary[key].late += 1;
      if (record.status === "absent") summary[key].absent += 1;
    });
    const list = Object.keys(summary)
      .filter((name) => summary[name].absent >= 1 || summary[name].late >= 2)
      .map((name) => ({
        name,
        desc: `迟到 ${summary[name].late} 次 / 缺勤 ${summary[name].absent} 次`
      }));
    this.setData({ anomalies: list });
  },
  initCharts(records, stats) {
    const historyChartComp = this.selectComponent("#historyChart");
    const pieChartComp = this.selectComponent("#pieChart");
    const grouped = {};
    records.forEach((record) => {
      const date = record.time.slice(0, 10);
      if (!grouped[date]) {
        grouped[date] = { normal: 0, late: 0, absent: 0 };
      }
      grouped[date][record.status] = (grouped[date][record.status] || 0) + 1;
    });
    const dates = Object.keys(grouped).sort();
    const normalSeries = dates.map((d) => grouped[d].normal || 0);
    const lateSeries = dates.map((d) => grouped[d].late || 0);
    const absentSeries = dates.map((d) => grouped[d].absent || 0);

    historyChartComp &&
      historyChartComp.init((canvas, width, height, dpr) => {
        const echarts = require("../../../../components/ec-canvas/echarts");
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        chart.setOption({
          tooltip: { trigger: "axis" },
          legend: { data: ["正常", "迟到", "缺勤"] },
          grid: { left: 40, right: 20, bottom: 30, top: 40 },
          xAxis: { type: "category", data: dates },
          yAxis: { type: "value", minInterval: 1 },
          series: [
            { name: "正常", type: "line", data: normalSeries },
            { name: "迟到", type: "line", data: lateSeries },
            { name: "缺勤", type: "line", data: absentSeries }
          ]
        });
        return chart;
      });

    pieChartComp &&
      pieChartComp.init((canvas, width, height, dpr) => {
        const echarts = require("../../../../components/ec-canvas/echarts");
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        chart.setOption({
          tooltip: { trigger: "item" },
          legend: { orient: "vertical", left: "left" },
          series: [
            {
              name: "占比",
              type: "pie",
              radius: "65%",
              data: [
                { value: stats.normal, name: "正常" },
                { value: stats.late, name: "迟到" },
                { value: stats.absent, name: "缺勤" }
              ],
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: "rgba(0, 0, 0, 0.5)"
                }
              }
            }
          ]
        });
        return chart;
      });
  },
  handleExport() {
    if (!this.data.records.length) {
      wx.showToast({ title: "暂无数据可导出", icon: "none" });
      return;
    }
    this.setData({ exporting: true });
    try {
      const sheetData = [
        ["学生", "状态", "时间"],
        ...this.data.records.map((item) => [item.student, item.status, item.time])
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "签到记录");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const fs = wx.getFileSystemManager();
      const filePath = `${wx.env.USER_DATA_PATH}/course-${this.data.courseId || "export"}.xlsx`;
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
        }
      });
    } catch (err) {
      wx.showToast({ title: err.message || "导出失败", icon: "none" });
    } finally {
      this.setData({ exporting: false });
    }
  }
});

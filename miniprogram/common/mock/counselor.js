const overviewMock = {
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

const alertsMock = [
  {
    id: "alert-001",
    student: "张晓",
    clazz: "计科 2202",
    reason: "连续缺勤 3 次",
    level: "serious",
    lastAbsence: "11-10 算法设计"
  },
  {
    id: "alert-002",
    student: "王凯",
    clazz: "计科 2201",
    reason: "缺勤率 28%",
    level: "warning",
    lastAbsence: "11-12 数据结构"
  },
  {
    id: "alert-003",
    student: "李倩",
    clazz: "计科 2203",
    reason: "近期缺勤上升",
    level: "warning",
    lastAbsence: "11-11 英语"
  }
];

const studentDetailMock = {
  base: {
    name: "张晓",
    clazz: "计科 2202",
    phone: "138****1234",
    guardian: "父亲 / 139****8888"
  },
  stats: {
    total: 42,
    normal: 34,
    late: 4,
    absent: 4,
    makeup: 2
  },
  followups: [
    { time: "2025-11-05 14:00", content: "电话联系家长，说明考勤情况", owner: "辅导员" },
    { time: "2025-11-08 09:30", content: "与学生面谈，确认近期压力大", owner: "辅导员" }
  ],
  timeline: [
    { course: "高等数学", date: "11-10", status: "缺勤" },
    { course: "计算机网络", date: "11-08", status: "迟到" },
    { course: "英语", date: "11-06", status: "补签通过" }
  ]
};

module.exports = {
  overviewMock,
  alertsMock,
  studentDetailMock
};

const studentDashboardMock = {
  profile: {
    name: "李明",
    major: "计算机科学与技术",
    studentNo: "2020012345"
  },
  stats: {
    weekAttendance: "95%",
    lateCount: 1,
    absentCount: 0,
    trend: "+2%"
  },
  courses: [
    {
      id: "course-001",
      name: "高等数学",
      teacher: "王老师",
      time: "08:00-09:40",
      location: "教学楼 A201",
      status: "ongoing"
    },
    {
      id: "course-002",
      name: "数据结构",
      teacher: "刘老师",
      time: "10:00-11:40",
      location: "实验楼 305",
      status: "upcoming"
    },
    {
      id: "course-003",
      name: "大学英语",
      teacher: "张老师",
      time: "14:00-15:40",
      location: "综合楼 402",
      status: "completed"
    }
  ],
  reminders: [
    {
      id: "remind-1",
      text: "10:00 数据结构课程签到将于 15 分钟后开启",
      type: "info"
    },
    {
      id: "remind-2",
      text: "上周缺勤 1 次，记得及时提交补签申请",
      type: "warning"
    }
  ]
};

const signTaskMock = {
  batchId: "batch-001",
  courseId: "course-001",
  name: "高等数学",
  teacher: "王老师",
  location: "教学楼 A201",
  deadline: "09:00 截止",
  mode: "标准模式",
  countdown: 180,
  distance: "23m",
  faceRequired: false,
  steps: [
    { title: "定位验证", status: "done" },
    { title: "二维码扫码", status: "pending" },
    { title: "人脸识别", status: "skipped" }
  ]
};

const makeupRecordsMock = [
  {
    id: "mk-001",
    course: "大学英语",
    date: "2025-11-02",
    status: "approved",
    reason: "参加竞赛",
    approver: "张老师"
  },
  {
    id: "mk-002",
    course: "线性代数",
    date: "2025-11-05",
    status: "pending",
    reason: "发烧请假",
    approver: "待审核"
  }
];

module.exports = {
  studentDashboardMock,
  signTaskMock,
  makeupRecordsMock
};

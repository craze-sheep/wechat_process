const teacherCoursesMock = [
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

const signLaunchDefaults = {
  range: 50,
  duration: 10,
  mode: "标准模式",
  lateBuffer: 5
};

const signMonitorMock = {
  batchId: "batch-123",
  courseName: "高等数学",
  total: 62,
  signed: 49,
  qrExpiredIn: 25,
  studentsSigned: [
    { name: "李明", status: "正常", time: "08:05" },
    { name: "王强", status: "迟到", time: "08:11" }
  ],
  studentsPending: [
    { name: "赵敏", status: "未签到" },
    { name: "陈阳", status: "未签到" }
  ],
  abnormal: [
    { name: "周九", reason: "定位失败 3 次" },
    { name: "郑十", reason: "人脸识别失败 2 次" }
  ]
};

const approvalListMock = [
  {
    id: "mk-002",
    student: "李明",
    course: "数据结构",
    reason: "发烧请假",
    submittedAt: "11-11 21:30",
    status: "pending"
  },
  {
    id: "mk-003",
    student: "王强",
    course: "高等数学",
    reason: "比赛外出",
    submittedAt: "11-10 08:12",
    status: "pending"
  }
];

module.exports = {
  teacherCoursesMock,
  signLaunchDefaults,
  signMonitorMock,
  approvalListMock
};

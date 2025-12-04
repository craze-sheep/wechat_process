const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const COLLECTIONS = [
  "users",
  "courses",
  "enrollments",
  "sign_batches",
  "sign_records",
  "makeup_requests",
  "alerts",
  "messages",
  "logs"
];
const IGNORABLE_ERR_CODES = [-502005, -501001];

const seeds = {
  users: [
    {
      _id: "stu_001",
      role: "student",
      name: "李明",
      major: "计算机科学与技术",
      status: "active",
      faceStatus: "pending",
      openid: "demo-student-openid",
      token: "token-student",
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      _id: "tch_001",
      role: "teacher",
      name: "王老师",
      department: "计算机学院",
      status: "active",
      openid: "demo-teacher-openid",
      token: "token-teacher",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  courses: [
    {
      _id: "course_001",
      name: "高等数学",
      teacherId: "tch_001",
      clazz: "计科 2001",
      schedule: [
        { weekday: 1, time: "08:00-09:40", location: "教学楼 A201" },
        { weekday: 3, time: "08:00-09:40", location: "教学楼 A201" }
      ],
      defaultMode: "标准模式",
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      _id: "course_002",
      name: "数据结构",
      teacherId: "tch_001",
      clazz: "计科 2002",
      schedule: [{ weekday: 3, time: "10:00-11:40", location: "实验楼 305" }],
      defaultMode: "高安全模式",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  enrollments: [
    {
      _id: "enroll_001",
      courseId: "course_001",
      studentId: "stu_001",
      status: "enrolled",
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      _id: "enroll_002",
      courseId: "course_002",
      studentId: "stu_001",
      status: "auditing",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  sign_batches: [
    {
      _id: "batch_001",
      batchId: "batch_001",
      courseId: "course_001",
      mode: "标准模式",
      startTime: Date.now(),
      endTime: Date.now() + 10 * 60 * 1000,
      qrSeed: "seed-batch-001",
      location: {
        latitude: 30.123,
        longitude: 120.123,
        radius: 50
      },
      createdBy: "tch_001",
      courseName: "高等数学",
      status: "open",
      total: 62,
      signed: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  sign_records: [
    {
      _id: "record_001",
      recordId: "record_001",
      batchId: "batch_001",
      courseId: "course_001",
      studentId: "stu_001",
      status: "normal",
      verify: {
        location: {
          latitude: 30.124,
          longitude: 120.125,
          distance: 23
        },
        qr: true,
        face: false
      },
      courseName: "高等数学",
      studentName: "李明",
      signedAt: Date.now()
    }
  ],
  makeup_requests: [
    {
      _id: "mk_001",
      requestId: "mk_001",
      courseId: "course_001",
      courseName: "高等数学",
      studentId: "stu_001",
      studentName: "李明",
      type: "病假",
      reason: "发烧请假",
      evidence: "",
      status: "pending",
      approver: "",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  alerts: [
    {
      _id: "alert_001",
      alertId: "alert_001",
      studentId: "stu_001",
      studentName: "李明",
      clazz: "计科 2001",
      level: "warning",
      reason: "缺勤率 25%",
      lastAbsence: "11-12 数据结构",
      status: "open",
      followups: [
        { time: Date.now() - 2 * 24 * 60 * 60 * 1000, content: "电话提醒家长，安排沟通", owner: "辅导员" }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  messages: [
    {
      _id: "msg_001",
      messageId: "msg_001",
      title: "系统例行维护",
      content: "今晚 23:00-24:00 将进行系统维护，请提前完成签到。",
      targetRole: "all",
      createdAt: Date.now()
    }
  ],
  logs: [
    {
      _id: "log_001",
      operatorId: "tch_001",
      action: "initialize_collections",
      payload: { collections: ["users", "courses", "enrollments", "sign_batches"] },
      timestamp: Date.now()
    },
    {
      _id: "log_002",
      operatorId: "system",
      action: "seed_sign_batch",
      payload: { batchId: "batch_001", courseId: "course_001" },
      timestamp: Date.now()
    }
  ]
};

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (err) {
    if (!IGNORABLE_ERR_CODES.includes(err.errCode)) {
      throw err;
    }
  }
}

async function upsertDocuments(name, docs = []) {
  const collection = db.collection(name);
  for (const doc of docs) {
    await collection
      .doc(doc._id)
      .set({
        data: {
          ...doc,
          updatedAt: Date.now()
        }
      })
      .catch((err) => {
        throw new Error(`写入 ${name}/${doc._id} 失败: ${err.message || err.errMsg}`);
      });
  }
}

exports.main = async () => {
  try {
    for (const name of COLLECTIONS) {
      await ensureCollection(name);
      await upsertDocuments(name, seeds[name]);
    }
    return {
      code: 0,
      message: "Collections initialized"
    };
  } catch (err) {
    return {
      code: 500,
      message: err.message || err.errMsg || "初始化失败"
    };
  }
};

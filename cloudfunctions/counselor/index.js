const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const success = (data = null) => ({
  code: 0,
  data
});

const failure = (message = "服务异常", code = 500) => ({
  code,
  message
});

const handleError = (err, fallbackMessage) => {
  console.error("[counselor] unexpected error", err);
  const message = err?.message || err?.errMsg || fallbackMessage || "云函数异常";
  const code = err?.code || err?.errCode || 500;
  return failure(message, code);
};

const counselorDashboard = {
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

const counselorAlerts = [
  {
    id: "alert-001",
    student: "张晓",
    clazz: "计科 2202",
    reason: "连续缺勤 3 次",
    level: "serious",
    lastAbsence: "11-10 算法设计"
  }
];

const studentDetails = {};

const usersCollection = db.collection("users");
const recordsCollection = db.collection("sign_records");
const coursesCollection = db.collection("courses");
const alertsCollection = db.collection("alerts");
const TEMPLATE_ID = process.env.SUBSCRIBE_TEMPLATE_ID || "1wJtcMTVpGkxK83NGW9ADX8zSqubeYcXx0fbzduCqUo";

const truncate = (value = "", max = 20) => {
  const str = value || "";
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

const sendSubscribe = async (openid, payload = {}) => {
  if (!openid || !TEMPLATE_ID) return;
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: TEMPLATE_ID,
      page: payload.page || "pages/index/index",
      data: {
        thing2: { value: truncate(payload.title || "考勤提醒") },
        thing3: { value: truncate(payload.message || "考勤状态更新") },
        thing9: { value: truncate(payload.action || "请关注出勤") },
        thing4: { value: truncate(payload.activity || "智能考勤") },
        thing14: { value: truncate(payload.role || "学生") }
      }
    });
  } catch (err) {
    console.warn("subscribe message send failed", err);
  }
};

const formatDate = (timestamp) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildDashboard = async () => {
  try {
    const [totalRes, normalRes, lateRes, absentRes, coursesRes] = await Promise.all([
      recordsCollection.count(),
      recordsCollection.where({ status: "normal" }).count(),
      recordsCollection.where({ status: "late" }).count(),
      recordsCollection.where({ status: "absent" }).count(),
      coursesCollection.limit(5).get()
    ]);
    const total = totalRes.total || 0;
    const normal = normalRes.total || 0;
    const late = lateRes.total || 0;
    const absent = absentRes.total || 0;
    const rate = total ? `${Math.round((normal / total) * 100)}%` : "0%";
    const classes = coursesRes.data.map((course) => {
      const attendanceRate = course.attendanceRate || rate;
      let status = "good";
      const numericRate = parseInt(attendanceRate, 10);
      if (!Number.isNaN(numericRate)) {
        if (numericRate < 90) status = "warn";
        if (numericRate < 85) status = "risk";
      }
      return {
        name: course.clazz || course.name || "未命名班级",
        rate: attendanceRate,
        status
      };
    });
    return {
      grade: "2022级计科",
      overallRate: rate,
      lateCount: late,
      absentCount: absent,
      alerts: Math.max(absent + late - 1, 0),
      trend: total ? "+0.5%" : "0%",
      classes: classes.length ? classes : counselorDashboard.classes
    };
  } catch (err) {
    console.error("buildDashboard fallback", err);
    return counselorDashboard;
  }
};

const buildAlerts = async () => {
  try {
    const alertsRes = await alertsCollection.orderBy("createdAt", "desc").limit(50).get();
    if (alertsRes.data.length) {
      return alertsRes.data.map((item) => ({
        id: item.alertId || item._id,
        studentId: item.studentId,
        student: item.studentName,
        clazz: item.clazz,
        reason: item.reason,
        level: item.level,
        lastAbsence: item.lastAbsence
      }));
    }
  } catch (err) {
    console.warn("alerts collection unavailable, fallback to records", err);
  }
  try {
    const res = await recordsCollection
      .where({
        status: _.in(["absent", "late"])
      })
      .orderBy("signedAt", "desc")
      .limit(50)
      .get();
    if (!res.data.length) {
      return counselorAlerts;
    }
    const map = new Map();
    res.data.forEach((record) => {
      const key = record.studentId || record.studentName || record.recordId;
      if (map.has(key)) return;
      map.set(key, {
        id: key,
        studentId: record.studentId,
        student: record.studentName || "未命名学生",
        clazz: record.clazz || "未分班",
        reason: record.status === "absent" ? "缺勤" : "迟到",
        level: record.status === "absent" ? "serious" : "warning",
        lastAbsence: `${formatDate(record.signedAt)} ${record.courseName || record.courseId || ""}`
      });
    });
    return Array.from(map.values());
  } catch (err) {
    console.error("buildAlerts fallback", err);
    return counselorAlerts;
  }
};

const buildStudentDetail = async (studentId) => {
  if (!studentId) return null;
  try {
    const [userRes, recordRes, alertRes] = await Promise.all([
      usersCollection
        .doc(studentId)
        .get()
        .catch(() => ({ data: null })),
      recordsCollection.where({ studentId }).orderBy("signedAt", "desc").limit(50).get(),
      alertsCollection.where({ studentId }).limit(1).get()
    ]);
    const user = userRes.data;
    const alertDoc = (alertRes.data && alertRes.data[0]) || null;
    if (!user && !recordRes.data.length) {
      return null;
    }
    const stats = recordRes.data.reduce(
      (acc, record) => {
        acc.total += 1;
        if (record.status === "normal") acc.normal += 1;
        if (record.status === "late") acc.late += 1;
        if (record.status === "absent") acc.absent += 1;
        if (record.status === "makeup") acc.makeup += 1;
        return acc;
      },
      { total: 0, normal: 0, late: 0, absent: 0, makeup: 0 }
    );
    const timeline = recordRes.data.map((record) => ({
      course: record.courseName || record.courseId || "未命名课程",
      date: formatDate(record.signedAt),
      status: record.status
    }));
    return {
      base: {
        name: user?.name || "未命名学生",
        clazz: user?.clazz || "未分班",
        phone: user?.phone || "无",
        guardian: user?.guardian || "无"
      },
      stats,
      followups: alertDoc?.followups || [],
      timeline
    };
  } catch (err) {
    console.error("buildStudentDetail fallback", err);
    return studentDetails[studentId] || null;
  }
};

exports.main = async (event) => {
  const { action, studentId } = event;
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    switch (action) {
      case "dashboard":
        return success(await buildDashboard());
      case "alerts":
        return success(await buildAlerts());
      case "studentDetail": {
        const detail = (await buildStudentDetail(studentId)) || studentDetails[studentId] || null;
        if (!detail) {
          return failure("学生不存在", 404);
        }
        return success(detail);
      }
      case "updateAlertStatus": {
        const { alertId, status, ids = [] } = event;
        const targets = ids.length ? ids : alertId ? [alertId] : [];
        if (!targets.length) {
          return failure("alertId 或 ids 必填", 400);
        }
        const tasks = targets.map(async (id) => {
          const now = Date.now();
          await alertsCollection.doc(id).update({
            data: {
              status: status || "closed",
              updatedAt: now
            }
          });
          const alertDoc = await alertsCollection
            .doc(id)
            .get()
            .catch(() => null);
          if (!alertDoc || !alertDoc.data || !alertDoc.data.studentId) return;
          const userRes = await usersCollection
            .doc(alertDoc.data.studentId)
            .get()
            .catch(() => null);
          const openid = userRes && userRes.data && userRes.data.openid;
          await sendSubscribe(openid, {
            title: "考勤预警更新",
            message: status === "closed" ? "预警已处理" : "预警状态更新",
            action: alertDoc.data.reason || "请关注考勤",
            activity: alertDoc.data.courseName || alertDoc.data.clazz || "智能考勤",
            role: (userRes && userRes.data && userRes.data.name) || "学生"
          });
        });
        await Promise.all(tasks);
        return success({ updated: targets.length });
      }
      case "addFollowup": {
        const { studentId: targetId, content } = event;
        if (!targetId || !content) {
          return failure("studentId/content 必填", 400);
        }
        const followup = {
          time: Date.now(),
          content,
          owner: "辅导员"
        };
        const userRes = await usersCollection
          .doc(targetId)
          .get()
          .catch(() => null);
        await alertsCollection
          .where({ studentId: targetId })
          .update({
            data: {
              followups: _.push([followup]),
              updatedAt: Date.now()
            }
          });
        const openid = userRes && userRes.data && userRes.data.openid;
        await sendSubscribe(openid, {
          title: "辅导员跟进提醒",
          message: content,
          action: "请及时回复",
          activity: "辅导员跟进",
          role: (userRes && userRes.data && userRes.data.name) || "学生"
        });
        return success(followup);
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

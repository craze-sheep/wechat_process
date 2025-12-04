const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

const success = (data = null) => ({
  code: 0,
  data
});

const failure = (message = "服务异常", code = 500) => ({
  code,
  message
});

const handleError = (err, fallbackMessage) => {
  console.error("[admin] unexpected error", err);
  const message = err?.message || err?.errMsg || fallbackMessage || "云函数异常";
  const code = err?.code || err?.errCode || 500;
  return failure(message, code);
};

const usersCollection = db.collection("users");
const coursesCollection = db.collection("courses");
const batchesCollection = db.collection("sign_batches");
const recordsCollection = db.collection("sign_records");
const messagesCollection = db.collection("messages");
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
        thing2: { value: truncate(payload.title || "系统通知") },
        thing3: { value: truncate(payload.message || "请注意考勤提醒") },
        thing9: { value: truncate(payload.action || "请查阅详情") },
        thing4: { value: truncate(payload.activity || "智能考勤") },
        thing14: { value: truncate(payload.role || "学生") }
      }
    });
  } catch (err) {
    console.warn("notify subscribe failed", err);
  }
};

const countUsers = async (where = {}) => {
  const res = await usersCollection.where(where).count();
  return res.total || 0;
};

const countRecords = async (where = {}) => {
  const res = await recordsCollection.where(where).count();
  return res.total || 0;
};

const formatTime = (timestamp) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  const pad = (value) => (value < 10 ? `0${value}` : `${value}`);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

exports.main = async (event) => {
  const { action } = event;
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    switch (action) {
      case "overview": {
        const [userTotal, teacherTotal, counselorTotal, pendingApprovals, latestBatchRes, logsRes] = await Promise.all([
          countUsers(),
          countUsers({ role: "teacher" }),
          countUsers({ role: "counselor" }),
          countRecords({ status: "pending" }),
          batchesCollection.orderBy("updatedAt", "desc").limit(1).get(),
          batchesCollection.orderBy("updatedAt", "desc").limit(5).get()
        ]);
        const latestBatch = latestBatchRes.data[0] || null;
        const logs =
          logsRes.data.map((item, index) => ({
            id: item.batchId || item._id || `log-${index}`,
            action: `${item.courseName || item.courseId || "课程"} 签到`,
            operator: item.createdBy || "系统",
            time: formatTime(item.updatedAt || item.createdAt)
          })) || [];
        return success({
          userTotal,
          teacherTotal,
          counselorTotal,
          pendingApprovals,
          lastDeploy: formatTime(latestBatch?.updatedAt || latestBatch?.createdAt),
          logs
        });
      }
      case "listUsers": {
        const res = await usersCollection.orderBy("updatedAt", "desc").limit(100).get();
        const list = res.data.map((item) => ({
          id: item._id,
          name: item.name,
          role: item.role,
          dept: item.department || item.major || "",
          status: item.status || "active"
        }));
        return success(list);
      }
      case "listCourses": {
        const res = await coursesCollection.orderBy("createdAt", "desc").limit(100).get();
        const list = res.data.map((item) => ({
          id: item._id,
          name: item.name,
          teacher: item.teacherId || "未设置",
          clazz: item.clazz || "未关联班级",
          defaultMode: item.defaultMode || "标准模式"
        }));
        return success(list);
      }
      case "listMessages": {
        const res = await messagesCollection.orderBy("createdAt", "desc").limit(20).get();
        const list = res.data.map((item) => ({
          id: item.messageId || item._id,
          title: item.title,
          content: item.content,
          time: formatTime(item.createdAt)
        }));
        return success(list);
      }
      case "bulkUpsertUsers": {
        const { users = [] } = event;
        if (!Array.isArray(users) || !users.length) {
          return failure("users 参数不能为空", 400);
        }
        const now = Date.now();
        await Promise.all(
          users.map((user) => {
            const docId = user._id || `user_${now}_${Math.random().toString(36).slice(2, 6)}`;
            return usersCollection.doc(docId).set({
              data: {
                ...user,
                _id: docId,
                updatedAt: now,
                createdAt: user.createdAt || now
              }
            });
          })
        );
        return success({ count: users.length });
      }
      case "sendNotification": {
        const { title, content, targetRole = "all" } = event;
        if (!title || !content) {
          return failure("title/content 不能为空", 400);
        }
        const now = Date.now();
        const messageId = `msg_${now}`;
        await messagesCollection.doc(messageId).set({
          data: {
            _id: messageId,
            messageId,
            title,
            content,
            targetRole,
            createdAt: now
          }
        });
        const targetWhere = targetRole === "all" ? {} : { role: targetRole };
        const userList = await usersCollection.where(targetWhere).limit(50).get();
        await Promise.all(
          (userList.data || []).map((user) =>
            sendSubscribe(user.openid, {
              title,
              message: content,
              action: "查看通知",
              activity: "管理员通知",
              role: user.name || "同学"
            })
          )
        );
        return success({ messageId });
      }
      case "importCourses": {
        const { courses = [] } = event;
        if (!Array.isArray(courses) || !courses.length) {
          return failure("courses 参数不能为空", 400);
        }
        const now = Date.now();
        await Promise.all(
          courses.map((course, index) => {
            const docId = course._id || course.courseId || `course_${now}_${index}`;
            return coursesCollection.doc(docId).set({
              data: {
                ...course,
                _id: docId,
                updatedAt: now,
                createdAt: course.createdAt || now
              }
            });
          })
        );
        return success({ count: courses.length });
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

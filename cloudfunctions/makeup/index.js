const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const requestsCollection = db.collection("makeup_requests");
const usersCollection = db.collection("users");

const success = (data = null) => ({
  code: 0,
  data
});

const failure = (message = "服务异常", code = 500) => ({
  code,
  message
});

const handleError = (err, fallbackMessage) => {
  console.error("[makeup] unexpected error", err);
  const message = err?.message || err?.errMsg || fallbackMessage || "云函数异常";
  const code = err?.code || err?.errCode || 500;
  return failure(message, code);
};

const getUserByOpenid = async (openid) => {
  if (!openid) return null;
  const res = await usersCollection.where({ openid }).limit(1).get();
  return res.data[0] || null;
};

exports.main = async (event) => {
  const { action } = event;
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    const { OPENID } = cloud.getWXContext();
    const user = (await getUserByOpenid(event.openid || OPENID)) || {};
    switch (action) {
      case "submit": {
        const payload = event.payload || {};
        const now = Date.now();
        const requestId = payload.requestId || `mk_${now}`;
        const data = {
          _id: requestId,
          requestId,
          courseId: payload.courseId || "",
          courseName: payload.courseName || payload.courseId || "",
          studentId: payload.studentId || user._id || "",
          studentName: payload.studentName || user.name || "未命名学生",
          type: payload.type || "事假",
          reason: payload.reason || "",
          evidence: payload.evidence || "",
          status: "pending",
          approver: "",
          createdAt: now,
          updatedAt: now
        };
        await requestsCollection.doc(requestId).set({ data });
        return success(data);
      }
      case "listByStudent": {
        const targetId = event.studentId || user._id;
        if (!targetId) return success([]);
        const res = await requestsCollection.where({ studentId: targetId }).orderBy("createdAt", "desc").get();
        return success(res.data || []);
      }
      case "listPending": {
        const res = await requestsCollection.where({ status: "pending" }).orderBy("createdAt", "desc").get();
        return success(res.data || []);
      }
      case "updateStatus": {
        const { requestId, status, approver, remark } = event;
        if (!requestId || !status) {
          return failure("requestId/status 必填", 400);
        }
        await requestsCollection
          .doc(requestId)
          .update({
            data: {
              status,
              approver: approver || user.name || "教师",
              remark: remark || "",
              updatedAt: Date.now()
            }
          })
          .catch((err) => {
            throw err;
          });
        return success({ requestId, status });
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

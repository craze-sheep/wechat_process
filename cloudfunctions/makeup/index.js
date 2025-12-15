const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const requestsCollection = db.collection("makeup_requests");
const usersCollection = db.collection("users");
const recordsCollection = db.collection("sign_records");
const messagesCollection = db.collection("messages");

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

const extractToken = (event) => event?.token || event?.data?.token;

const ensureAuth = async (event, allowedRoles = []) => {
  const token = extractToken(event);
  if (!token) throw { message: "未登录", code: 401 };
  const { OPENID } = cloud.getWXContext();
  const res = await usersCollection.where({ openid: OPENID, token }).limit(1).get();
  const user = res.data?.[0];
  if (!user) throw { message: "token 无效", code: 401 };
  if (user.tokenExpire && user.tokenExpire <= Date.now()) throw { message: "登录已过期", code: 401 };
  if (allowedRoles.length && !allowedRoles.includes(user.role)) throw { message: "无权限", code: 403 };
  return user;
};

exports.main = async (event) => {
  console.log("[makeup] event payload", event);
  const action = event?.action || event?.data?.action;
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    switch (action) {
      case "submit": {
        const user = await ensureAuth(event, ["student", "teacher", "counselor", "admin"]);
        const payload = event.payload || {};
        const targetRecordId = payload.recordId;
        if (!targetRecordId) {
          return failure("recordId 必填", 400);
        }
        const recordRes = await recordsCollection
          .doc(targetRecordId)
          .get()
          .catch(() => ({ data: null }));
        const record = recordRes.data;
        if (!record) {
          return failure("对应考勤记录不存在", 404);
        }
        if (record.studentId && record.studentId !== user._id) {
          return failure("无权限提交他人记录", 403);
        }
        if (record.status && record.status !== "absent" && record.status !== "late") {
          return failure("仅缺勤/迟到记录可申请补签", 400);
        }
        const now = Date.now();
        const requestId = payload.requestId || `mk_${now}`;
        const data = {
          _id: requestId,
          requestId,
          recordId: targetRecordId,
          batchId: record.batchId || "",
          courseId: record.courseId || payload.courseId || "",
          courseName: record.courseName || payload.courseName || payload.courseId || "",
          studentId: record.studentId || user._id || "",
          studentName: record.studentName || user.name || "未命名学生",
          reasonType: payload.reasonType || payload.type || "事假",
          reasonText: payload.reasonText || payload.reason || "",
          attachments: payload.attachments || payload.evidence || [],
          status: "counselor_pending",
          approver: "",
          remark: "",
          createdAt: now,
          updatedAt: now
        };
        await requestsCollection.doc(requestId).set({ data });
        await writeMessage({
          targetId: data.studentId,
          targetRole: "student",
          content: "补签申请已提交，等待辅导员审批",
          payload: { requestId }
        });
        return success(data);
      }
      case "listByStudent": {
        const user = await ensureAuth(event, ["student", "teacher", "counselor", "admin"]);
        const targetId = event.studentId || user._id;
        if (!targetId) return success([]);
        const res = await requestsCollection.where({ studentId: targetId }).orderBy("createdAt", "desc").get();
        return success(res.data || []);
      }
      case "listPending": {
        const user = await ensureAuth(event, ["teacher", "counselor", "admin"]);
        let query = {};
        if (user.role === "counselor") {
          query = { status: _.in(["counselor_pending", "pending"]) };
        } else if (user.role === "teacher") {
          query = { status: "counselor_approved" };
        }
        const res = await requestsCollection.where(query).orderBy("createdAt", "desc").get();
        return success(res.data || []);
      }
      case "updateStatus": {
        const user = await ensureAuth(event, ["teacher", "counselor", "admin"]);
        const { requestId, status, approver, remark } = event;
        if (!requestId || !status) {
          return failure("requestId/status 必填", 400);
        }
        const allowedStatus =
          user.role === "counselor"
            ? ["counselor_approved", "counselor_rejected"]
            : ["teacher_approved", "teacher_rejected"];
        if (!allowedStatus.includes(status)) {
          return failure("状态不合法", 400);
        }
        const reqRes = await requestsCollection
          .doc(requestId)
          .get()
          .catch(() => ({ data: null }));
        const reqDoc = reqRes.data;
        if (!reqDoc) {
          return failure("补签申请不存在", 404);
        }
        await requestsCollection
          .doc(requestId)
          .update({
            data: {
              status,
              approver: approver || user.name || (user.role === "counselor" ? "辅导员" : "教师"),
              remark: remark || "",
              updatedAt: Date.now()
            }
          })
          .catch((err) => {
            throw err;
          });
        if (user.role === "teacher" && status === "teacher_approved" && reqDoc.recordId) {
          await recordsCollection
            .doc(reqDoc.recordId)
            .update({
              data: {
                status: "makeup",
                updatedAt: Date.now(),
                makeupRequestId: requestId
              }
            })
            .catch(() => null);
        }
        await writeMessage({
          targetId: reqDoc.studentId,
          targetRole: "student",
          content:
            status === "teacher_approved"
              ? "补签申请已通过"
              : status === "teacher_rejected"
              ? "补签申请被老师驳回"
              : status === "counselor_approved"
              ? "辅导员已通过，待老师审批"
              : "补签申请被辅导员驳回",
          payload: { requestId, status }
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

const writeMessage = async ({ targetId, targetRole, content, payload }) => {
  try {
    if (!targetId) return;
    await messagesCollection.add({
      data: {
        targetId,
        targetRole: targetRole || "student",
        type: "makeup_status",
        content: content || "",
        payload: payload || {},
        createdAt: Date.now(),
        readStatus: 0
      }
    });
  } catch (e) {
    console.warn("[makeup] writeMessage failed", e);
  }
};

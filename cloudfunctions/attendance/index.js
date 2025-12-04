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
  console.error("[attendance] unexpected error", err);
  const message = err?.message || err?.errMsg || fallbackMessage || "云函数异常";
  const code = err?.code || err?.errCode || 500;
  return failure(message, code);
};

const mockBatches = [
  {
    batchId: "batch-123",
    courseId: "course-001",
    courseName: "高等数学",
    mode: "标准模式",
    startTime: Date.now(),
    endTime: Date.now() + 10 * 60 * 1000,
    qrSeed: "seed-xyz",
    location: null,
    createdBy: "tch_001",
    total: 62,
    signed: 49,
    expiresIn: 600
  }
];

const batchCollection = db.collection("sign_batches");
const recordCollection = db.collection("sign_records");
const courseCollection = db.collection("courses");
const userCollection = db.collection("users");
const messageCollection = db.collection("messages");

const normalizeBatch = (doc) => {
  if (!doc) return null;
  const now = Date.now();
  const batchId = doc.batchId || doc._id;
  const remaining = doc.endTime ? doc.endTime - now : 0;
  return {
    batchId,
    courseId: doc.courseId || "",
    courseName: doc.courseName || "",
    mode: doc.mode || "标准模式",
    startTime: doc.startTime || now,
    endTime: doc.endTime || now,
    status: doc.status || "open",
    qrSeed: doc.qrSeed || `seed-${batchId}`,
    location: doc.location || null,
    createdBy: doc.createdBy || "",
    total: typeof doc.total === "number" ? doc.total : 0,
    signed: typeof doc.signed === "number" ? doc.signed : 0,
    qrRefreshInterval: doc.qrRefreshInterval || 30,
    autoCloseMinutes: doc.autoCloseMinutes || 15,
    expiresIn: doc.endTime ? Math.max(0, Math.floor(remaining / 1000)) : 0
  };
};

const ensureAutoClose = async (doc) => {
  if (!doc || doc.status === "closed") return doc;
  if (doc.endTime && Date.now() > doc.endTime) {
    await batchCollection.where({ batchId: doc.batchId || doc._id }).update({
      data: {
        status: "closed",
        updatedAt: Date.now()
      }
    });
    return { ...doc, status: "closed" };
  }
  return doc;
};

const fetchBatchFromDB = async ({ batchId, courseId }) => {
  let query = batchCollection;
  if (batchId) {
    query = query.where({ batchId });
  } else if (courseId) {
    query = query.where({ courseId }).orderBy("startTime", "desc");
  } else {
    query = query.orderBy("startTime", "desc");
  }
  const res = await query.limit(1).get();
  const doc = res.data[0] ? await ensureAutoClose(res.data[0]) : null;
  return normalizeBatch(doc);
};

const getBatchDoc = async (batchId) => {
  if (!batchId) return null;
  const res = await batchCollection.where({ batchId }).limit(1).get();
  return res.data[0] || null;
};

const fetchCourse = async (courseId) => {
  if (!courseId) return null;
  try {
    const res = await courseCollection.doc(courseId).get();
    return res.data || null;
  } catch (err) {
    return null;
  }
};

const getUserByOpenid = async (openid) => {
  if (!openid) return null;
  const res = await userCollection.where({ openid }).limit(1).get();
  return res.data[0] || null;
};

const mapRecord = (record) => ({
  id: record.recordId || record._id,
  studentId: record.studentId,
  studentName: record.studentName || "学生",
  status: record.status || "normal",
  time: record.signedAt || Date.now()
});

exports.main = async (event) => {
  const { action } = event;
  if (!action) {
    return failure("action 不能为空", 400);
  }

  try {
    switch (action) {
      case "fetchBatch": {
        const { batchId, courseId } = event;
        const batch = (await fetchBatchFromDB({ batchId, courseId })) || mockBatches[0] || null;
        return success(batch);
      }
      case "startSign": {
        const payload = event.payload || {};
        const now = Date.now();
        const batchId = payload.batchId || `batch-${now}`;
        const courseInfo = payload.courseId ? await fetchCourse(payload.courseId) : null;
        const record = {
          _id: batchId,
          batchId,
          courseId: payload.courseId || (courseInfo && courseInfo._id) || "",
          courseName: payload.courseName || (courseInfo && courseInfo.name) || "",
          mode: payload.mode || courseInfo?.defaultMode || "标准模式",
          startTime: payload.startTime || now,
          endTime: payload.endTime || now + (payload.duration || 10) * 60 * 1000,
          qrSeed: payload.qrSeed || `seed-${batchId}`,
          location: payload.location || null,
          createdBy: payload.createdBy || courseInfo?.teacherId || "",
          total: typeof payload.total === "number" ? payload.total : courseInfo?.expectedStudents || 0,
          signed: payload.signed || 0,
          status: payload.status || "open",
          qrRefreshInterval: payload.qrRefreshInterval || 30,
          autoCloseMinutes: payload.autoCloseMinutes || Math.round(payload.duration || 10),
          createdAt: now,
          updatedAt: now
        };
        await batchCollection.doc(batchId).set({ data: record });
        return success(normalizeBatch(record));
      }
      case "submitRecord": {
        const payload = event.payload || {};
        if (!payload.batchId) {
          return failure("batchId 必填", 400);
        }
        const { OPENID } = cloud.getWXContext();
        const user = (await getUserByOpenid(event.openid || OPENID)) || {};
        const batch = (await getBatchDoc(payload.batchId)) || {};
        const now = Date.now();
        const recordId = payload.recordId || `record-${now}`;
        const data = {
          _id: recordId,
          recordId,
          batchId: payload.batchId,
          courseId: payload.courseId || batch.courseId || "",
          courseName: payload.courseName || batch.courseName || "",
          studentId: payload.studentId || user._id || "",
          studentName: payload.studentName || user.name || "",
          status: payload.status || "normal",
          verify: payload.verify || {},
          signedAt: now
        };
        await recordCollection.doc(recordId).set({ data });
        await batchCollection
          .where({ batchId: payload.batchId })
          .update({
            data: {
              signed: _.inc(1),
              updatedAt: now
            }
          })
          .catch(() => null);
        return success({
          status: "success",
          recordId
        });
      }
      case "listRecords": {
        const { batchId, studentId, courseId } = event;
        let query = recordCollection;
        if (studentId) {
          query = query.where({ studentId }).orderBy("signedAt", "desc");
        } else if (batchId) {
          query = query.where({ batchId }).orderBy("signedAt", "desc");
        } else if (courseId) {
          query = query.where({ courseId }).orderBy("signedAt", "desc");
        } else {
          query = query.orderBy("signedAt", "desc");
        }
        const res = await query.limit(100).get();
        const data = res.data || [];
        if (studentId) {
          return success(
            data.map((item) => ({
              ...item,
              displayTime: item.signedAt
            }))
          );
        }
        return success({
          signed: data.map(mapRecord),
          pending: []
        });
      }
      case "refreshQr": {
        const { batchId } = event;
        if (!batchId) return failure("batchId 必填", 400);
        const newSeed = `seed-${Date.now()}`;
        await batchCollection
          .where({ batchId })
          .update({
            data: {
              qrSeed: newSeed,
              updatedAt: Date.now()
            }
          });
        return success({ batchId, qrSeed: newSeed });
      }
      case "closeBatch": {
        const { batchId } = event;
        if (!batchId) return failure("batchId 必填", 400);
        await batchCollection
          .where({ batchId })
          .update({
            data: {
              status: "closed",
              updatedAt: Date.now()
            }
          });
        return success({ batchId });
      }
      case "sendReminder": {
        const { batchId, message } = event;
        if (!batchId) {
          return failure("batchId 必填", 400);
        }
        const now = Date.now();
        await messageCollection.add({
          data: {
            batchId,
            messageId: `reminder_${now}`,
            title: "签到提醒",
            content: message || "请尽快完成签到",
            targetRole: "student",
            createdAt: now
          }
        });
        return success({ batchId });
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

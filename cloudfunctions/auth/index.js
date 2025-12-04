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
  console.error("[auth] unexpected error", err);
  const message = err?.message || err?.errMsg || fallbackMessage || "云函数异常";
  const code = err?.code || err?.errCode || 500;
  return failure(message, code);
};

const mockUsers = {
  "openid-student": {
    role: "student",
    name: "李明",
    token: "token-student"
  }
};

const usersCollection = db.collection("users");

const pickProfile = (doc) => {
  if (!doc) return null;
  return {
    _id: doc._id,
    role: doc.role,
    name: doc.name,
    major: doc.major,
    department: doc.department,
    status: doc.status,
    token: doc.token || `token-${doc.role || "student"}`
  };
};

const getUserByOpenid = async (openid) => {
  if (!openid) return null;
  const res = await usersCollection.where({ openid }).limit(1).get();
  return res.data[0] || null;
};

const upsertUser = async (openid, payload = {}) => {
  const existed = await getUserByOpenid(openid);
  const now = Date.now();
  const docId = existed?._id || payload._id || `user_${now}`;
  const record = {
    ...existed,
    ...payload,
    _id: docId,
    openid,
    token: payload.token || existed?.token || `token-${payload.role || existed?.role || "student"}`,
    role: payload.role || existed?.role || "student",
    status: payload.status || existed?.status || "active",
    createdAt: existed?.createdAt || now,
    updatedAt: now
  };
  await usersCollection.doc(docId).set({
    data: record
  });
  return record;
};

const ensureUser = async (openid) => {
  const existed = await getUserByOpenid(openid);
  if (existed) return existed;
  const mock = mockUsers["openid-student"] || {
    role: "student",
    name: "访客"
  };
  return upsertUser(openid, mock);
};

exports.main = async (event) => {
  const { action } = event;
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    const { OPENID } = cloud.getWXContext();
    const targetOpenid = event.openid || OPENID;
    switch (action) {
      case "login": {
        const user = await ensureUser(targetOpenid);
        return success(pickProfile(user));
      }
      case "switchRole": {
        const { role } = event;
        if (!role) {
          return failure("role 必填", 400);
        }
        const user = await upsertUser(targetOpenid, {
          role,
          token: `token-${role}`
        });
        return success({
          role: user.role,
          token: user.token
        });
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

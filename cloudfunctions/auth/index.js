const cloud = require("wx-server-sdk");
const crypto = require("crypto");

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

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const generateToken = () => {
  const random = crypto.randomBytes(16).toString("hex");
  const token = `tk_${random}`;
  const expireAt = Date.now() + TOKEN_TTL_MS;
  return { token, expireAt };
};

const isTokenValid = (doc = {}) => {
  if (!doc.token || !doc.tokenExpire) return false;
  return doc.tokenExpire > Date.now();
};

const pickProfile = (doc) => {
  if (!doc) return null;
  return {
    _id: doc._id,
    username: doc.username,
    role: doc.role,
    name: doc.name,
    major: doc.major,
    department: doc.department,
    status: doc.status,
    token: doc.token || `token-${doc.role || "student"}`,
    tokenExpire: doc.tokenExpire
  };
};

const getUserByOpenid = async (openid) => {
  if (!openid) return null;
  const res = await usersCollection.where({ openid }).limit(1).get();
  return res.data[0] || null;
};

const getUserByAccount = async (account) => {
  if (!account) return null;
  const res = await usersCollection
    .where(
      _.or([
        { username: account },
        { _id: account },
        { openid: account },
        { phone: account }
      ])
    )
    .limit(1)
    .get();
  return res.data[0] || null;
};

const upsertUser = async (openid, payload = {}) => {
  const existed = await getUserByOpenid(openid);
  const now = Date.now();
  const docId = existed?._id || payload._id || `user_${now}`;
  const nextToken =
    payload.token || (isTokenValid(existed) ? existed.token : null) || generateToken().token;
  const nextExpire =
    payload.tokenExpire || (isTokenValid(existed) ? existed.tokenExpire : null) || Date.now() + TOKEN_TTL_MS;
  const record = {
    ...existed,
    ...payload,
    _id: docId,
    openid,
    token: nextToken,
    tokenExpire: nextExpire,
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
  console.log("auth event", event);
  const action = event?.action || event?.data?.action;
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    const { OPENID } = cloud.getWXContext();
    const targetOpenid = event.openid || OPENID;
    switch (action) {
      case "login": {
        const user = await ensureUser(targetOpenid);
        const tokenData = generateToken();
        await usersCollection.doc(user._id).update({
          data: {
            token: tokenData.token,
            tokenExpire: tokenData.expireAt,
            updatedAt: Date.now()
          }
        });
        return success(
          pickProfile({
            ...user,
            token: tokenData.token,
            tokenExpire: tokenData.expireAt
          })
        );
      }
      case "switchRole": {
        const { role } = event;
        if (!role) {
          return failure("role 必填", 400);
        }
        const tokenData = generateToken();
        const user = await upsertUser(targetOpenid, {
          role,
          token: tokenData.token,
          tokenExpire: tokenData.expireAt
        });
        return success({
          role: user.role,
          token: user.token,
          tokenExpire: user.tokenExpire
        });
      }
      case "loginWithPassword": {
        const { username, password } = event;
        if (!username || !password) {
          return failure("username/password 必填", 400);
        }
        const user = await getUserByAccount(username);
        if (!user) {
          return failure("账号不存在", 404);
        }
        if (!user.password || user.password !== password) {
          return failure("账号或密码错误", 401);
        }
        const tokenData = generateToken();
        await usersCollection.doc(user._id).update({
          data: {
            token: tokenData.token,
            tokenExpire: tokenData.expireAt,
            updatedAt: Date.now()
          }
        });
        return success(
          pickProfile({
            ...user,
            token: tokenData.token,
            tokenExpire: tokenData.expireAt
          })
        );
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

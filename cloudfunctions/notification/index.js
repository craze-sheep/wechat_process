const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const usersCollection = db.collection("users");
const messagesCollection = db.collection("messages");
const readsCollection = db.collection("message_reads");

const success = (data = null) => ({
  code: 0,
  data
});

const failure = (message = "服务异常", code = 500) => ({
  code,
  message
});

const handleError = (err, fallbackMessage) => {
  console.error("[notification] unexpected error", err);
  const message = err?.message || err?.errMsg || fallbackMessage || "云函数异常";
  const code = err?.code || err?.errCode || 500;
  return failure(message, code);
};

const extractToken = (event) => event?.token || event?.data?.token;

const ensureAuth = async (event) => {
  const token = extractToken(event);
  if (!token) throw { message: "未登录", code: 401 };
  const { OPENID } = cloud.getWXContext();
  const res = await usersCollection.where({ openid: OPENID, token }).limit(1).get();
  const user = res.data?.[0];
  if (!user) throw { message: "token 无效", code: 401 };
  if (user.tokenExpire && user.tokenExpire <= Date.now()) throw { message: "登录已过期", code: 401 };
  return user;
};

const mapNotification = (doc, readSet) => {
  const id = doc.messageId || doc._id;
  return {
    id,
    title: doc.title || "系统通知",
    content: doc.content || "",
    targetRole: doc.targetRole || "all",
    createdAt: doc.createdAt || 0,
    read: readSet.has(id)
  };
};

exports.main = async (event) => {
  console.log("[notification] event payload", event);
  const action = event?.action || event?.data?.action || "list";
  if (!action) {
    return failure("action 不能为空", 400);
  }
  try {
    switch (action) {
      case "list": {
        const user = await ensureAuth(event);
        const limit = Math.min(100, parseInt(event.limit, 10) || 20);
        const roles = ["all"];
        if (user.role) roles.push(user.role);
        const res = await messagesCollection
          .where({
            targetRole: _.in(roles)
          })
          .orderBy("createdAt", "desc")
          .limit(limit)
          .get();
        const docs = res.data || [];
        const ids = docs.map((item) => item.messageId || item._id).filter(Boolean);
        let readSet = new Set();
        if (ids.length) {
          const readRes = await readsCollection
            .where({
              userId: user._id,
              messageId: _.in(ids)
            })
            .get();
          readSet = new Set((readRes.data || []).map((item) => item.messageId));
        }
        return success(docs.map((doc) => mapNotification(doc, readSet)));
      }
      case "markRead": {
        const user = await ensureAuth(event);
        const { messageId } = event;
        if (!messageId) {
          return failure("messageId 必填", 400);
        }
        const docId = `${user._id || "user"}_${messageId}`;
        const now = Date.now();
        await readsCollection.doc(docId).set({
          data: {
            _id: docId,
            messageId,
            userId: user._id,
            readAt: now
          }
        });
        return success({ messageId });
      }
      case "unreadCount": {
        const user = await ensureAuth(event);
        const roles = ["all"];
        if (user.role) roles.push(user.role);
        const [allRes, readRes] = await Promise.all([
          messagesCollection
            .where({
              targetRole: _.in(roles)
            })
            .count(),
          readsCollection
            .where({
              userId: user._id
            })
            .count()
        ]);
        const total = allRes.total || 0;
        const read = readRes.total || 0;
        const unread = Math.max(0, total - read);
        return success({ total, unread });
      }
      default:
        return failure(`未知 action: ${action}`, 400);
    }
  } catch (err) {
    return handleError(err);
  }
};

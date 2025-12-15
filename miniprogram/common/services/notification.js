const { callFunction } = require("./cloud");

const normalize = (res) => {
  const result = (res && res.result) || {};
  const hasCode = typeof result.code !== "undefined";
  if (hasCode && result.code !== 0) {
    throw new Error(result.message || "云函数异常");
  }
  return hasCode ? result.data : result;
};

const list = (payload = {}) =>
  callFunction("notification", {
    action: "list",
    ...payload
  }).then(normalize);

const markRead = ({ messageId }) =>
  callFunction("notification", {
    action: "markRead",
    messageId
  }).then(normalize);

const unreadCount = () =>
  callFunction("notification", {
    action: "unreadCount"
  }).then(normalize);

module.exports = {
  list,
  markRead,
  unreadCount
};

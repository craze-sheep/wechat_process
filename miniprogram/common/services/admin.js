const { callFunction } = require("./cloud");

const normalize = (res) => {
  const result = (res && res.result) || {};
  const hasCode = typeof result.code !== "undefined";
  if (hasCode && result.code !== 0) {
    throw new Error(result.message || "云函数异常");
  }
  return hasCode ? result.data : result;
};

const fetchOverview = () =>
  callFunction("admin", {
    action: "overview"
  }).then(normalize);

const listUsers = () =>
  callFunction("admin", {
    action: "listUsers"
  }).then(normalize);

const listCourses = () =>
  callFunction("admin", {
    action: "listCourses"
  }).then(normalize);

const listMessages = () =>
  callFunction("admin", {
    action: "listMessages"
  }).then(normalize);

const bulkUpsertUsers = (users) =>
  callFunction("admin", {
    action: "bulkUpsertUsers",
    users
  }).then(normalize);

const sendNotification = ({ title, content, targetRole }) =>
  callFunction("admin", {
    action: "sendNotification",
    title,
    content,
    targetRole
  }).then(normalize);

const importCourses = (courses) =>
  callFunction("admin", {
    action: "importCourses",
    courses
  }).then(normalize);

module.exports = {
  fetchOverview,
  listUsers,
  listCourses,
  listMessages,
  bulkUpsertUsers,
  sendNotification,
  importCourses
};

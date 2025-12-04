const { callFunction } = require("./cloud");

const normalize = (res) => {
  const result = (res && res.result) || {};
  const hasCode = typeof result.code !== "undefined";
  if (hasCode && result.code !== 0) {
    throw new Error(result.message || "云函数异常");
  }
  return hasCode ? result.data : result;
};

const fetchDashboard = () =>
  callFunction("counselor", {
    action: "dashboard"
  }).then(normalize);

const fetchAlerts = () =>
  callFunction("counselor", {
    action: "alerts"
  }).then(normalize);

const fetchStudentDetail = (studentId) =>
  callFunction("counselor", {
    action: "studentDetail",
    studentId
  }).then(normalize);

const updateAlertStatus = ({ alertId, status, ids }) =>
  callFunction("counselor", {
    action: "updateAlertStatus",
    alertId,
    status,
    ids
  }).then(normalize);

const addFollowup = ({ studentId, content }) =>
  callFunction("counselor", {
    action: "addFollowup",
    studentId,
    content
  }).then(normalize);

module.exports = {
  fetchDashboard,
  fetchAlerts,
  fetchStudentDetail,
  updateAlertStatus,
  addFollowup
};

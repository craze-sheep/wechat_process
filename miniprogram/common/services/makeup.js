const { callFunction } = require("./cloud");

const normalize = (res) => {
  const result = (res && res.result) || {};
  const hasCode = typeof result.code !== "undefined";
  if (hasCode && result.code !== 0) {
    throw new Error(result.message || "云函数异常");
  }
  return hasCode ? result.data : result;
};

const submitRequest = (payload) =>
  callFunction("makeup", {
    action: "submit",
    payload
  }).then(normalize);

const listStudentRequests = () =>
  callFunction("makeup", {
    action: "listByStudent"
  }).then(normalize);

const listPendingRequests = () =>
  callFunction("makeup", {
    action: "listPending"
  }).then(normalize);

const updateStatus = ({ requestId, status, remark }) =>
  callFunction("makeup", {
    action: "updateStatus",
    requestId,
    status,
    remark
  }).then(normalize);

module.exports = {
  submitRequest,
  listStudentRequests,
  listPendingRequests,
  updateStatus
};

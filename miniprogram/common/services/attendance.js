const { callFunction } = require("./cloud");

const normalize = (res) => {
  const result = (res && res.result) || {};
  const hasCode = typeof result.code !== "undefined";
  if (hasCode && result.code !== 0) {
    throw new Error(result.message || "云函数异常");
  }
  return hasCode ? result.data : result;
};

const fetchBatch = ({ courseId, batchId } = {}) =>
  callFunction("attendance", {
    action: "fetchBatch",
    courseId,
    batchId
  }).then(normalize);

const startSign = (payload) =>
  callFunction("attendance", {
    action: "startSign",
    payload
  }).then(normalize);

const submitRecord = (payload) =>
  callFunction("attendance", {
    action: "submitRecord",
    payload
  }).then(normalize);

const listRecords = (payload = {}) =>
  callFunction("attendance", {
    action: "listRecords",
    ...payload
  }).then(normalize);

const sendReminder = (payload = {}) =>
  callFunction("attendance", {
    action: "sendReminder",
    ...payload
  }).then(normalize);

const refreshQr = ({ batchId }) =>
  callFunction("attendance", {
    action: "refreshQr",
    batchId
  }).then(normalize);

const closeBatch = ({ batchId }) =>
  callFunction("attendance", {
    action: "closeBatch",
    batchId
  }).then(normalize);

module.exports = {
  fetchBatch,
  startSign,
  submitRecord,
  listRecords,
  sendReminder,
  refreshQr,
  closeBatch
};

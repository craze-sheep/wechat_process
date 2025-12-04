const { callFunction } = require("./cloud");

const normalize = (res) => {
  const result = (res && res.result) || {};
  const hasCode = typeof result.code !== "undefined";
  if (hasCode && result.code !== 0) {
    throw new Error(result.message || "云函数异常");
  }
  return hasCode ? result.data : result;
};

const login = () =>
  callFunction("auth", {
    action: "login"
  }).then(normalize);

const switchRole = (role) =>
  callFunction("auth", {
    action: "switchRole",
    role
  }).then(normalize);

module.exports = {
  login,
  switchRole
};

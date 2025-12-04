# 智能考勤小程序（realize）

## 1. 本地运行
1. 用微信开发者工具导入 `realize/` 目录，并将 `project.config.json` 中的 `appid` 替换成你的小程序 AppID。
2. 打开「详情」->「本地设置」，勾选“使用云开发”与 “上传代码时压缩 JS” 等常规选项即可（项目已是纯 JS，不再依赖 TypeScript 编译）。
3. 进入「工具」->「构建 npm」，确保 `node_modules/` 生效；若提示不存在 npm 包，可直接忽略。

## 2. 配置云环境
1. 在开发者工具里开通云开发，创建环境并记录 `envId`。
2. 在调试器 console 执行 `getApp().setCloudEnv('你的envId')`，或在 `miniprogram/app.js` 的 `globalData.cloudEnvId` 写死（仍推荐通过 `setCloudEnv`，便于切换）。若暂未设置，程序会退回到 `wx.cloud.DYNAMIC_CURRENT_ENV`，此模式依赖开发者工具中选择的默认环境。
3. 重新编译后，可在任何页面调用 `wx.cloud` 能力；若忘记配置，会在界面上收到“未初始化云环境”的提示。

## 3. 初始化数据库
1. 云开发控制台选择刚才的环境。
2. 右键 `cloudfunctions/initCollections` ->「上传并部署：云端安装依赖」。
3. 部署完成后点击「在云端运行」一次，函数会自动创建并写入示例数据到以下集合：
   - `users`
   - `courses`
   - `enrollments`
   - `sign_batches`
   - `sign_records`
   - `makeup_requests`
   - `alerts`
   - `messages`
   - `logs`

云函数会自动写入示例数据（学生/教师/课程/签到批次/签到记录），方便前端直接联调。

> 若集合已存在，函数会跳过创建并刷新示例文档（`doc.set` 会覆盖同名 `_id`）。

## 4. 登录与功能验证
1. 回到首页点击「云端登录」，会调用 `cloudfunctions/auth` 返回示例用户资料，并自动记录 token / role。
2. 学生端首页会优先读取云数据库的 `courses` 集合；若云端不可用，将回退到 mock 数据。
3. 学生签到页会调用 `attendance.fetchBatch` 获取最新批次，提交时会调用 `attendance.submitRecord`。
4. 教师端发起签到会调用 `attendance.startSign`，实时监控页则通过 `attendance.fetchBatch` 拉取批次状态。
5. 辅导员端新上线三个页面：`dashboard`（出勤大盘）、`alerts`（预警列表）、`student-detail`（档案跟进），对应 `cloudfunctions/counselor`。
6. 管理员端包含 `users`、`courses`、`settings` 三个页面，数据来自 `cloudfunctions/admin`，可快速查看规模指标与操作日志。

## 5. 下一步开发建议
- 继续完善辅导员、管理员分包页面与云函数逻辑。
- 将补签申请、预警管理等流程与云数据库打通（例如新增 `makeup_requests` 集合）。
- 为 `attendance` 云函数补充真实的业务校验（定位、人脸、人为异常检测等）。

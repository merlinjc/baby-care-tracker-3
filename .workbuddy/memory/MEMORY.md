# 项目记忆

## 项目背景
Baby Care Tracker 是一个微信小程序项目，用于追踪宝宝的日常护理记录。当前正在进行 v4.0 UI 重构。

## 开发方法论
项目采用 **Spec-Driven Development** 工程化方法论：
- 六层文档体系作为 AI 上下文基座
- Spec 三件套（requirements/design/tasks）规范每个 feature
- Git Flow 版本控制纪律
- 三阶段开发工作流（开发前/中/后）
- 10 轮交叉 Review 确保质量

## 文档规范
- 禁止使用 emoji，统一使用 PNG 图标，不足时以 Iconify 补充
- 输出风格简洁、结构化，内容精炼、无冗余
- 采用渐进式工作方式：先搭框架再填充细节
- 重视设计与代码的交叉复核

## Git 工作流
- 分支命名：feature/<spec-name>
- Commit 规范：Conventional Commits
- 每个 Task 至少一个 commit
- 每个 commit 可独立编译运行
- 关联 T-x.x 和 FR-x 编号

## 质量保障
- 暗色模式 28 项矩阵检查
- 文档同步更新
- 逐日验收节点
- Commit 粒度控制

## 项目状态
- 当前分支：feature/ui-redesign-v4
- 开发进度：已完成 v4.0 UI 重构（8 天 32 任务 23 commits）
- 下一步：继续优化和维护

## 用户偏好
- 偏好简洁、结构化的输出风格
- 关注 AI 行业动态，聚焦 AI 编程与具身智能
- 习惯渐进式工作方式
- 重视设计与代码的交叉复核

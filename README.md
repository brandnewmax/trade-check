# SnapCheckAlgo

外贸询盘背景调查 API 服务——给定询盘文本 + 卖家自画像，返回结构化风险评估（四维评分 + 风险等级）、发件方实体、以及 8 路 OSINT 情报（LinkedIn、Panjiva 海关记录、Wayback 建站时间等）。

**生产地址**: https://snap-check-algo.vercel.app
**主端点**: `POST /api/v1/analyze`（SSE 流式）

作为独立 API 服务部署，供 [SN 平台 (ai-sn)](https://github.com/tommyso24) 等上游产品调用。

---

## 文档

- **[SN 平台对接指南](./docs/sn-integration-guide.md)** — 如何调用 SnapCheckAlgo API（面向集成方工程师，自成体系）
- **[项目 notebook](./notebook.md)** — 完整项目状态、系统架构、部署记录、技术决策（面向本仓库开发者）

## 快速开始

```bash
npm install
npm run dev              # 本地 http://localhost:3000
```

环境变量（Upstash Redis、LLM Base URL、API Key 等）详见 `notebook.md`。

## 部署后验证

每次部署完成后跑冒烟测试确保核心功能没崩：

```bash
export SNAPCHECK_SERVICE_API_KEY="<your-key>"
bash scripts/smoke-test.sh
```

覆盖 5 个测试点：健康检查、鉴权失败、空输入校验、离线模式端到端、联网模式端到端（含 60s 代理边缘穿越验证）。全绿时 exit 0，任意失败 exit 1，环境问题 exit 2。

## 技术栈

- Next.js 14 App Router（Fluid Compute）
- Upstash Redis（会话、设置、query 历史、obs 观察日志）
- Serper.dev（Google 搜索代理）
- Archive.org CDX API（建站时间）
- Vercel Pro（`maxDuration: 300s`）

## 贡献

仓库地址：https://github.com/tommyso24/SnapCheckAlgo

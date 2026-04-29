# iFace Construction Bank

这是基于原 iFace 项目改造的一款本地建工刷题网站。题库、做题进度、错题状态和 AI 对话默认保存在浏览器本地，无需注册、无需服务器，打开即可使用。

本项目经过 AI 辅助改造与题库清洗，题目数据也经过 OCR / 规则脚本 / AI 审校等流程处理。请务必自行鉴别题目、答案和解析的准确性，本项目不保证题库内容与任何官方教材、考试真题或培训资料完全一致。

## 当前能力

- 内置三个并行科目分支：`公路工程管理与实务`、`建设工程法规及相关知识`、`建设工程施工管理`。
- 支持 `单选题`、`多选题`、`解答题`。
- 支持章节题、历年真题、模拟试卷等目录化浏览。
- 支持题干配图，图片以静态资源形式按需加载。
- 支持自定义 JSON / Markdown 题目导入。
- 学习进度、练习记录、AI 对话等数据默认保存在浏览器本地 IndexedDB。
- 可选接入兼容 OpenAI API 的模型，用于答案点评、解析辅助和解题指导。

## 关于 PDF 和版权

仓库不应提交原始 PDF 题库文件。PDF 原题可能涉及版权或授权问题，因此本项目只建议分发已经整理好的 JSON 题目数据和必要的题目图片资源。

普通用户不需要 PDF，也不需要运行 PDF 构建脚本。你可以直接：

- 使用内置的 `public/questions/construction/**/*.json` 题库。
- 在页面中导入自己的 JSON / Markdown 题目。
- 通过 `public/question-assets/construction/` 使用已提取好的题目配图。

为了避免误提交原始资料，仓库已忽略：

```text
local-pdf-sources/
*.pdf
*.PDF
```

如果你确实需要在本机离线处理自己拥有授权的 PDF，可以查看可选工具目录：

```text
tools/pdf-pipeline/
```

该目录不是普通用户使用网站所必需的部分。

## 开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

题库 JSON 质量审计：

```bash
python scripts/audit_construction_json.py --fail-on-error
```

## GitHub 云同步配置

云同步使用 GitHub OAuth 登录，并把学习进度与自定义题库备份到你的私有 Gist。这个功能需要自行配置 GitHub OAuth App 和 `/api/auth` 服务端函数；如果不配置，网站仍可正常本地刷题，只是云同步不可用。

创建 GitHub OAuth App：

- 入口：`https://github.com/settings/developers`
- Homepage URL：你的部署地址，例如 `https://your-app.vercel.app`
- Authorization callback URL：`https://your-app.vercel.app/api/auth`

Vercel 环境变量：

```text
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_client_secret
# 可选：Vercel 通常能自动推断当前域名；自定义域名异常时再显式设置
APP_ORIGIN=https://your-app.vercel.app
```

前端不再强制需要 `VITE_GITHUB_CLIENT_ID`。登录按钮会先进入同域名下的 `/api/auth?login=github`，由服务端读取 `GITHUB_CLIENT_ID` 并跳转到 GitHub；GitHub 会使用 OAuth App 后台配置的 Authorization callback URL，所以它仍然必须精确填写为 `https://your-app.vercel.app/api/auth`。如果你看到 GitHub 的 `Invalid Redirect URI` 页面，请优先检查这个回调地址是否和实际部署域名、协议、路径完全一致。修改 Vercel 环境变量后也要重新部署一次，否则线上函数仍会使用旧配置。

如果部署在 GitHub Pages、普通静态文件服务器或没有 Serverless Function 的环境，`/api/auth` 无法运行，GitHub 云同步不会生效。此时可以继续使用本地刷题、导入/导出 JSON，或自行部署一个等价的 OAuth 后端。

## 自定义 JSON 格式

导入页支持的核心 JSON 结构如下：

```json
[
  {
    "id": "road-single-001",
    "module": "公路工程管理与实务 · 路基工程",
    "difficulty": 2,
    "type": "single",
    "question": "以下关于路基压实控制要点的说法，正确的是哪一项？",
    "options": [
      { "key": "A", "text": "压实度检测可完全替代含水量控制" },
      { "key": "B", "text": "应结合土质、含水量和压实机械综合控制" }
    ],
    "correctAnswers": ["B"],
    "answer": "## 正确答案\nB\n\n## 解析\n路基压实应结合土质、含水量、松铺厚度和压实机械综合控制。",
    "tags": ["路基", "压实"],
    "source": "自定义导入"
  }
]
```

字段说明：

- `id`：题目唯一 ID，建议保持稳定。
- `module`：题目所属模块或目录。
- `difficulty`：难度，取值为 `1 | 2 | 3`。
- `type`：题型，取值为 `single | multiple | essay`。
- `options`：选择题选项，解答题可省略。
- `correctAnswers`：选择题答案键，例如 `["A"]` 或 `["A", "C"]`。
- `answer`：答案与解析，推荐使用 Markdown。
- `questionImages`：可选，题干图片路径数组，例如 `["/question-assets/example/q001-1.webp"]`。
- `tags`：标签数组。
- `source`：来源说明，可选。

## 目录说明

```text
public/questions/construction/
```

内置建工题库 JSON。网站加载题库时优先读取这里的静态 JSON 目录。

```text
public/question-assets/construction/
```

题目配图资源。页面只会在题目详情需要时加载对应图片，避免一次性加载过多资源。

```text
src/generated/constructionBank.ts
```

内置题库目录索引与分类映射。

```text
scripts/audit_construction_json.py
scripts/repair_construction_json.py
```

JSON 题库审计与保守修复脚本，不依赖 PDF 构建。

```text
tools/pdf-pipeline/
```

可选的本地 PDF 转 JSON 离线工具。该目录仅供维护者处理自有授权资料，不建议普通用户使用，也不应提交 PDF 源文件。

```text
local-pdf-sources/
```

本机可选 PDF 源目录，已被 `.gitignore` 忽略，不应进入 GitHub 仓库。

## 技术栈

- React 19
- TypeScript 5.9
- Vite 7
- IndexedDB
- Tailwind CSS 4
- react-markdown

## 免责声明

本项目是学习和刷题工具，不是官方题库。题目、答案、解析和分类可能包含 OCR 错误、AI 清洗误差或资料来源差异。用于备考时，请结合教材、规范、官方通知和可信资料自行核对。

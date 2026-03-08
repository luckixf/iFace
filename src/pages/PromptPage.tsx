import React, { useState } from "react";
import { Badge, Button } from "@/components/ui";

const MODULE_VALUES = [
	"JS基础",
	"React",
	"性能优化",
	"网络",
	"CSS",
	"TypeScript",
	"手写题",
	"项目深挖",
];

const SCHEMA_JSON = `{
  "id": "string",          // 唯一 ID，建议格式：模块缩写-序号，如 js-001
  "module": "JS基础 | React | 性能优化 | 网络 | CSS | TypeScript | 手写题 | 项目深挖",
  "difficulty": 1 | 2 | 3, // 1=初级 2=中级 3=高级
  "question": "string",    // 题目内容
  "answer": "string",      // Markdown 格式的参考答案（支持代码块、表格、列表）
  "tags": ["string"],      // 标签数组
  "source": "string"       // 可选，来源标注，如"高频" "字节" "美团"
}`;

// ─── Preset Prompts ───────────────────────────────────────────────────────────

interface PromptPreset {
	id: string;
	icon: React.ReactNode;
	title: string;
	description: string;
	prompt: string;
}

function buildBasePrompt(
	module: string,
	count: number,
	difficulty: string,
	extra = "",
): string {
	return `你是一位资深前端面试官，精通前端技术体系。请生成 ${count} 道关于「${module}」的前端面试题，输出为 JSON 数组格式。

## 要求

### 难度分布
${difficulty}

### 质量要求
- 每道题必须是**真实面试中出现过的考点**，不要编造生僻问题
- 答案要**完整、准确、有深度**，覆盖核心知识点
- 答案使用 **Markdown 格式**，合理使用代码块（\`\`\`js ... \`\`\`）、表格、列表
- 代码示例要**可运行、注释清晰**
- 难度梯度合理：初级考基础概念，中级考原理与应用，高级考底层实现与优化

### 内容覆盖
${extra || `覆盖 ${module} 模块的核心知识点，包括基础概念、实际应用、常见陷阱和最佳实践。`}

### 标签规范
- tags 数组包含 2-5 个关键词，方便搜索
- 使用中文标签，如["原型链", "继承", "class"]

## 输出格式

严格按照以下 JSON Schema 输出，**只输出 JSON 数组，不要有任何其他文字**：

\`\`\`json
${SCHEMA_JSON}
\`\`\`

## 输出示例（仅供格式参考，请生成新内容）

\`\`\`json
[
  {
    "id": "${module
			.slice(0, 2)
			.toLowerCase()
			.replace(/[^a-z]/g, "x")}-001",
    "module": "${module}",
    "difficulty": 2,
    "question": "请解释…",
    "answer": "## 标题\\n\\n正文内容…\\n\\n\`\`\`js\\ncode here\\n\`\`\`",
    "tags": ["关键词1", "关键词2"],
    "source": "高频"
  }
]
\`\`\`

现在请生成 ${count} 道题目，只输出 JSON 数组：`;
}

// ─── Preset Icons ─────────────────────────────────────────────────────────────

const IconDatabase = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<ellipse cx="12" cy="5" rx="9" ry="3" />
		<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
		<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
	</svg>
);

const IconList = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<line x1="8" y1="6" x2="21" y2="6" />
		<line x1="8" y1="12" x2="21" y2="12" />
		<line x1="8" y1="18" x2="21" y2="18" />
		<line x1="3" y1="6" x2="3.01" y2="6" />
		<line x1="3" y1="12" x2="3.01" y2="12" />
		<line x1="3" y1="18" x2="3.01" y2="18" />
	</svg>
);

const IconBriefcase = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
		<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
	</svg>
);

const IconBuilding = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<rect x="2" y="2" width="20" height="20" rx="2" />
		<path d="M16 2v20" />
		<path d="M8 6h2" />
		<path d="M8 10h2" />
		<path d="M8 14h2" />
		<path d="M18 6h.01" />
		<path d="M18 10h.01" />
		<path d="M18 14h.01" />
	</svg>
);

const IconCode = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
		<polyline points="16 18 22 12 16 6" />
		<polyline points="8 6 2 12 8 18" />
	</svg>
);

const PRESETS: PromptPreset[] = [
	{
		id: "full",
		icon: <IconDatabase />,
		title: "全量题库生成（推荐）",
		description: "一次生成完整题库，约 500-600 道，覆盖所有模块",
		prompt: `你是一位资深前端面试官，请为前端面试刷题系统生成完整题库。

## 任务

分 8 个模块，每个模块生成 60-75 道题，总计约 500-600 道题。

## 模块列表
${MODULE_VALUES.map((m) => `- ${m}`).join("\n")}

## 难度分布（每个模块内）
- 初级（difficulty: 1）：占 30%，约 18-22 道
- 中级（difficulty: 2）：占 50%，约 30-38 道
- 高级（difficulty: 3）：占 20%，约 12-15 道

## 质量要求
1. **真实性**：所有题目必须是真实面试中出现过的考点
2. **深度**：答案要完整、准确，覆盖核心知识点、边界情况和最佳实践
3. **代码**：中高级题目必须包含可运行的代码示例，使用 Markdown 代码块
4. **多样性**：避免同类题目重复，覆盖每个模块的不同子主题
5. **高频标注**：将高频考点的 source 字段标注为"高频"，大厂面试题标注公司名

## 各模块重点覆盖方向

**JS基础（65道）**
- 变量声明、作用域、闭包、原型链、this 绑定
- 事件循环、Promise、async/await、微任务宏任务
- ES6+ 新特性（解构、展开、迭代器、生成器、Proxy）
- 类型系统、类型转换、隐式转换陷阱
- 内存管理、垃圾回收、内存泄漏

**React（65道）**
- Hooks（useState、useEffect、useRef、useMemo、useCallback、useContext）
- Fiber 架构、渲染机制、Diff 算法
- 性能优化（memo、lazy、Suspense、Virtual DOM）
- React 18 并发特性
- 状态管理（Context、Redux、Zustand 对比）
- 生命周期、错误边界、Portal

**性能优化（50道）**
- Core Web Vitals（LCP、INP、CLS）
- 渲染优化（重排重绘、合成层、will-change）
- 资源加载（preload/prefetch、懒加载、代码分割）
- 打包优化（Tree Shaking、Bundle 分析）
- 缓存策略、Service Worker

**网络（60道）**
- HTTP/1.1、HTTP/2、HTTP/3 对比
- TCP 三次握手、四次挥手
- HTTPS、TLS、证书
- 缓存（强缓存、协商缓存）
- 跨域（CORS、JSONP、代理）
- 安全（XSS、CSRF、CSP、HTTPS）
- WebSocket、SSE、长轮询
- DNS、CDN

**CSS（55道）**
- 盒模型、BFC、IFC、层叠上下文
- Flexbox、Grid 布局
- CSS 变量、动画、过渡
- 响应式设计、媒体查询
- CSS 预处理器、CSS Modules
- 选择器优先级、伪类伪元素

**TypeScript（55道）**
- 基础类型、接口、泛型
- 工具类型（Partial、Pick、Omit、Record 等）
- 类型守卫、条件类型、映射类型
- 装饰器、命名空间、模块
- 配置（tsconfig.json）
- 与 React 结合

**手写题（50道）**
- Promise、防抖、节流、深拷贝
- call/apply/bind、new、instanceof
- 数组方法（flat、reduce、map）
- 发布订阅、观察者模式
- LRU 缓存、虚拟 DOM、简版 React
- 路由、状态管理

**项目深挖（50道）**
- 工程化（Webpack、Vite、Rollup 配置与原理）
- 微前端架构
- 监控与埋点
- CI/CD、部署
- 性能监控、错误上报
- 大型项目架构设计
- 技术选型与方案对比

## ID 命名规范
- JS基础：js-001 至 js-065
- React：react-001 至 react-065
- 性能优化：perf-001 至 perf-050
- 网络：net-001 至 net-060
- CSS：css-001 至 css-055
- TypeScript：ts-001 至 ts-055
- 手写题：code-001 至 code-050
- 项目深挖：proj-001 至 proj-050

## 输出格式

**只输出一个完整的 JSON 数组，不要有任何其他文字、注释或说明。**

格式：
\`\`\`json
[
  {
    "id": "js-001",
    "module": "JS基础",
    "difficulty": 1,
    "question": "题目",
    "answer": "## 标题\\n\\n内容\\n\\n\`\`\`js\\ncode\\n\`\`\`",
    "tags": ["标签"],
    "source": "高频"
  },
  ...
]
\`\`\`

由于数量较多，建议分模块分批次生成，每次生成一个模块后立即输出完整 JSON。现在从 JS基础 模块开始：`,
	},
	{
		id: "module",
		icon: <IconList />,
		title: "单模块深度生成",
		description: "针对某一模块生成 60-80 道高质量题目",
		prompt: buildBasePrompt(
			"JS基础",
			70,
			"- 初级（difficulty: 1）：20 道，覆盖基础概念\n- 中级（difficulty: 2）：35 道，覆盖原理与应用\n- 高级（difficulty: 3）：15 道，覆盖底层实现与优化",
			`覆盖以下子主题：
- 变量声明（var/let/const）、作用域、变量提升、TDZ
- 数据类型、类型检测、类型转换（隐式与显式）
- 原型与原型链、继承（原型继承、class 继承）
- this 绑定规则（默认、隐式、显式、new、箭头函数）
- 闭包（原理、应用场景、内存泄漏）
- 事件循环（宏任务、微任务、执行栈）
- Promise（状态、链式调用、错误处理）
- async/await（语法糖、错误处理、并发）
- ES6+（解构、扩展运算符、迭代器、生成器、Symbol、Proxy、Reflect）
- 模块化（CommonJS vs ESM）
- 内存管理（垃圾回收、内存泄漏场景）
- 正则表达式常见用法`,
		),
	},
	{
		id: "project",
		icon: <IconBriefcase />,
		title: "项目专题生成",
		description: "根据你的项目技术栈，生成针对性的项目深挖题",
		prompt: `你是一位资深前端面试官。我将描述我参与的项目，请根据项目技术栈和架构，生成 30 道「项目深挖」类型的面试题。

## 我的项目描述

[在此粘贴你的项目介绍，例如：]
> 参与开发了一个大型电商平台，前端使用 React 18 + TypeScript + Vite，状态管理使用 Zustand，样式使用 Tailwind CSS。
> 核心功能：商品列表虚拟滚动、购物车实时同步、订单支付流程、后台管理系统。
> 遇到的挑战：首页白屏时间过长（后来通过 SSR 优化到 1.2s）、大量 API 并发导致的竞态条件问题。

## 生成要求

1. **紧扣项目**：所有题目必须与项目技术栈强相关，不要生成无关题目
2. **深度追问**：模拟面试官"为什么这样做""遇到什么问题""如何解决"的思路
3. **难度分布**：
   - 10 道中级题（项目常见问题与解决方案）
   - 15 道高级题（架构设计、性能优化、技术方案对比）
   - 5 道挑战题（极端场景、系统设计）
4. **答案要点**：答案提供面试时的回答要点和亮点，不需要完整展开

## 输出格式

只输出 JSON 数组：

\`\`\`json
[
  {
    "id": "proj-custom-001",
    "module": "项目深挖",
    "difficulty": 3,
    "question": "你提到首页白屏时间过长，能详细说说你是如何排查和优化的吗？",
    "answer": "## 排查过程\\n\\n1. 使用 Lighthouse 定位问题...\\n\\n## 优化方案\\n\\n...",
    "tags": ["性能优化", "SSR", "白屏"],
    "source": "项目深挖"
  }
]
\`\`\`

请根据我上面提供的项目信息生成题目：`,
	},
	{
		id: "company",
		icon: <IconBuilding />,
		title: "大厂真题还原",
		description: "还原字节、阿里、腾讯等大厂的高频面试题",
		prompt: `你是一位曾在多家大型互联网公司参与前端面试的资深工程师。请还原以下公司的真实前端面试题，生成 60 道高质量面试题。

## 覆盖公司
- 字节跳动（15道）
- 阿里巴巴/蚂蚁（12道）
- 腾讯（12道）
- 美团（10道）
- 滴滴（11道）

## 要求

1. **真实性**：题目必须是这些公司实际出现过的考点（或极高概率出现的题目）
2. **针对性**：体现各公司的考察侧重点：
   - 字节：算法思维强、注重 JS 底层原理、大量手写题
   - 阿里：注重工程化、架构设计、稳定性
   - 腾讯：注重基础扎实、TCP/IP 网络知识
   - 美团：注重业务场景、性能优化
   - 滴滴：注重移动端、跨端开发
3. **来源标注**：source 字段写公司名，如"字节"、"阿里"、"腾讯"
4. **难度分布**：以中高级为主（中级 40%，高级 60%）

## 覆盖模块
均匀分布在：JS基础、React、性能优化、网络、CSS、TypeScript、手写题、项目深挖

## ID 规范
格式：公司缩写-序号，如 byte-001、ali-001、tx-001、mt-001、dd-001

## 输出格式

只输出 JSON 数组，不要有任何其他文字：

\`\`\`json
[
  {
    "id": "byte-001",
    "module": "JS基础",
    "difficulty": 3,
    "question": "...",
    "answer": "...",
    "tags": ["..."],
    "source": "字节"
  }
]
\`\`\`

开始生成：`,
	},
	{
		id: "algorithm",
		icon: <IconCode />,
		title: "手写题专项",
		description: "生成 50 道高质量手写代码题，含详细实现",
		prompt: buildBasePrompt(
			"手写题",
			50,
			"- 初级（difficulty: 1）：10 道，基础 API 实现\n- 中级（difficulty: 2）：25 道，经典工具函数\n- 高级（difficulty: 3）：15 道，复杂数据结构与设计模式",
			`覆盖以下手写题类型：

**工具函数（15道）**
- 防抖（debounce）、节流（throttle）
- 深拷贝（deepClone，处理循环引用、特殊类型）
- 深比较（isEqual）
- 数组去重、扁平化（flat）
- 柯里化（curry）、函数组合（compose/pipe）
- 睡眠函数（sleep）、重试函数（retry）

**原生 API 实现（15道）**
- call、apply、bind
- new 操作符
- instanceof
- Object.create、Object.assign
- Promise（完整实现，含 all/race/allSettled/any）
- Array 方法（map、filter、reduce、flat、forEach）
- JSON.stringify / JSON.parse

**数据结构与算法（10道）**
- LRU 缓存
- 发布订阅（EventEmitter）
- 观察者模式
- 链表操作
- 二叉树遍历

**框架相关（10道）**
- 虚拟 DOM 和 Diff 算法（简版）
- 简版 React（支持函数组件 + useState）
- 简版 Vue 响应式（ref/reactive）
- 前端路由（hash/history 模式）
- 简版 Vuex/Redux

每道手写题的答案必须包含：
1. 完整可运行的代码实现
2. 关键逻辑注释
3. 测试用例
4. 边界情况处理说明`,
		),
	},
];

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({
	text,
	className = "",
}: {
	text: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				// fallback
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				document.body.removeChild(ta);
			}
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// ignore
		}
	};

	return (
		<button
			onClick={handleCopy}
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "6px 12px",
				borderRadius: 8,
				fontSize: 12,
				fontWeight: 500,
				border: copied
					? "1px solid rgba(16,185,129,0.3)"
					: "1px solid var(--border)",
				background: copied ? "rgba(16,185,129,0.08)" : "var(--surface)",
				color: copied ? "var(--success)" : "var(--text-2)",
				cursor: "pointer",
				transition: "all 0.18s",
				whiteSpace: "nowrap",
			}}
			className={className}
		>
			{copied ? (
				<>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
					已复制
				</>
			) : (
				<>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</svg>
					复制
				</>
			)}
		</button>
	);
}

// ─── Preset Card ──────────────────────────────────────────────────────────────

function PresetCard({
	preset,
	selected,
	onClick,
}: {
	preset: PromptPreset;
	selected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				width: "100%",
				padding: "12px 14px",
				borderRadius: 14,
				border: selected
					? "1px solid rgba(var(--primary-rgb), 0.5)"
					: "1px solid var(--border-subtle)",
				background: selected ? "var(--primary-light)" : "var(--surface)",
				textAlign: "left",
				transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
				cursor: "pointer",
				boxShadow: selected ? "none" : "var(--shadow-xs)",
			}}
			onMouseEnter={(e) => {
				if (!selected) {
					(e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
					(e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
				}
			}}
			onMouseLeave={(e) => {
				if (!selected) {
					(e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
					(e.currentTarget as HTMLElement).style.background = "var(--surface)";
				}
			}}
		>
			{/* Icon */}
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: 9,
					background: selected ? "rgba(var(--primary-rgb), 0.12)" : "var(--surface-3)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
					color: selected ? "var(--primary)" : "var(--text-3)",
					transition: "background 0.15s, color 0.15s",
				}}
			>
				{preset.icon}
			</div>

			{/* Text */}
			<div style={{ flex: 1, minWidth: 0 }}>
				<p
					style={{
						fontSize: 13,
						fontWeight: 600,
						color: selected ? "var(--primary)" : "var(--text)",
						marginBottom: 3,
						transition: "color 0.15s",
					}}
				>
					{preset.title}
				</p>
				<p
					style={{
						fontSize: 11,
						color: "var(--text-3)",
						lineHeight: 1.5,
					}}
				>
					{preset.description}
				</p>
			</div>

			{/* Selected indicator */}
			{selected && (
				<div
					style={{
						width: 18,
						height: 18,
						borderRadius: "50%",
						background: "var(--primary)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
						marginTop: 2,
					}}
				>
					<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</div>
			)}
		</button>
	);
}

// ─── Tips section ─────────────────────────────────────────────────────────────

interface TipItem {
	icon: React.ReactNode;
	title: string;
	desc: string;
}

const TIPS: TipItem[] = [
	{
		icon: (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<circle cx="12" cy="12" r="10" />
				<polyline points="12 6 12 12 16 14" />
			</svg>
		),
		title: "分批次生成效果更好",
		desc: "每次让 AI 专注一个模块，质量比一次性生成所有题目要高很多。建议每次生成 50-80 道题。",
	},
	{
		icon: (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<polyline points="1 4 1 10 7 10" />
				<path d="M3.51 15a9 9 0 1 0 .49-3.51" />
			</svg>
		),
		title: "多次生成合并使用",
		desc: "同一模块可以多次生成，每次用不同 AI 或不同角度，然后合并成更完整的题库。注意 ID 不要重复。",
	},
	{
		icon: (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</svg>
		),
		title: "可以让 AI 修改答案",
		desc: "对某道题的答案不满意，可以直接让 AI 补充、修正，然后手动更新对应 JSON 条目。",
	},
	{
		icon: (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
				<circle cx="12" cy="10" r="3" />
			</svg>
		),
		title: "标注 source 字段",
		desc: '建议让 AI 将高频题标注 source: "高频"，大厂题标注公司名，方便在题库中快速筛选。',
	},
	{
		icon: (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
				<line x1="8" y1="21" x2="16" y2="21" />
				<line x1="12" y1="17" x2="12" y2="21" />
			</svg>
		),
		title: "推荐模型",
		desc: "GPT-4o、Claude 3.5/3.7 Sonnet、Gemini 1.5 Pro 的输出质量较好，且能严格遵循 JSON 格式。",
	},
	{
		icon: (
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
		),
		title: "验证 JSON 有效性",
		desc: "粘贴前可先用 jsonlint.com 验证格式，避免导入失败。iFace 导入页也会自动检测并报告格式错误。",
	},
];

// ─── Custom prompt builder ────────────────────────────────────────────────────

function CustomBuilder({
	onGenerate,
}: {
	onGenerate: (prompt: string) => void;
}) {
	const [module, setModule] = useState("JS基础");
	const [count, setCount] = useState(60);
	const [diffPreset, setDiffPreset] = useState("standard");
	const [extraContext, setExtraContext] = useState("");

	const diffOptions = {
		standard: "初级 30% / 中级 50% / 高级 20%（标准）",
		beginner: "初级 60% / 中级 35% / 高级 5%（入门）",
		advanced: "初级 10% / 中级 40% / 高级 50%（进阶）",
		mid: "初级 0% / 中级 60% / 高级 40%（中高级）",
	};

	const diffDetail = {
		standard: `- 初级（difficulty: 1）：${Math.round(count * 0.3)} 道\n- 中级（difficulty: 2）：${Math.round(count * 0.5)} 道\n- 高级（difficulty: 3）：${Math.round(count * 0.2)} 道`,
		beginner: `- 初级（difficulty: 1）：${Math.round(count * 0.6)} 道\n- 中级（difficulty: 2）：${Math.round(count * 0.35)} 道\n- 高级（difficulty: 3）：${Math.round(count * 0.05)} 道`,
		advanced: `- 初级（difficulty: 1）：${Math.round(count * 0.1)} 道\n- 中级（difficulty: 2）：${Math.round(count * 0.4)} 道\n- 高级（difficulty: 3）：${Math.round(count * 0.5)} 道`,
		mid: `- 初级（difficulty: 1）：0 道\n- 中级（difficulty: 2）：${Math.round(count * 0.6)} 道\n- 高级（difficulty: 3）：${Math.round(count * 0.4)} 道`,
	};

	const handleGenerate = () => {
		const prompt = buildBasePrompt(
			module,
			count,
			diffDetail[diffPreset as keyof typeof diffDetail],
			extraContext,
		);
		onGenerate(prompt);
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 12,
				}}
			>
				{/* Module */}
				<div>
					<label
						style={{
							display: "block",
							fontSize: 11,
							fontWeight: 500,
							color: "var(--text-2)",
							marginBottom: 6,
						}}
					>
						模块
					</label>
					<select
						value={module}
						onChange={(e) => setModule(e.target.value)}
						style={{
							width: "100%",
							padding: "7px 10px",
							borderRadius: 10,
							fontSize: 13,
							background: "var(--surface)",
							border: "1px solid var(--border)",
							color: "var(--text)",
							outline: "none",
							cursor: "pointer",
						}}
					>
						{MODULE_VALUES.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
				</div>

				{/* Count */}
				<div>
					<label
						style={{
							display: "block",
							fontSize: 11,
							fontWeight: 500,
							color: "var(--text-2)",
							marginBottom: 6,
						}}
					>
						题目数量：
						<span style={{ color: "var(--primary)", fontWeight: 600 }}>
							{count} 道
						</span>
					</label>
					<input
						type="range"
						min={20}
						max={100}
						step={5}
						value={count}
						onChange={(e) => setCount(Number(e.target.value))}
						style={{
							width: "100%",
							accentColor: "var(--primary)",
							cursor: "pointer",
							marginTop: 4,
						}}
					/>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: 10,
							color: "var(--text-3)",
							marginTop: 2,
						}}
					>
						<span>20</span>
						<span>60</span>
						<span>100</span>
					</div>
				</div>
			</div>

			{/* Difficulty */}
			<div>
				<label
					style={{
						display: "block",
						fontSize: 11,
						fontWeight: 500,
						color: "var(--text-2)",
						marginBottom: 8,
					}}
				>
					难度分布
				</label>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: 6,
					}}
				>
					{Object.entries(diffOptions).map(([key, label]) => (
						<button
							key={key}
							onClick={() => setDiffPreset(key)}
							style={{
								padding: "7px 10px",
								borderRadius: 9,
								fontSize: 11,
								textAlign: "left",
								border: diffPreset === key
									? "1px solid rgba(var(--primary-rgb), 0.5)"
									: "1px solid var(--border)",
								background: diffPreset === key ? "var(--primary-light)" : "transparent",
								color: diffPreset === key ? "var(--primary)" : "var(--text-2)",
								fontWeight: diffPreset === key ? 500 : 400,
								cursor: "pointer",
								transition: "all 0.15s",
							}}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			{/* Extra context */}
			<div>
				<label
					style={{
						display: "block",
						fontSize: 11,
						fontWeight: 500,
						color: "var(--text-2)",
						marginBottom: 6,
					}}
				>
					补充说明（可选）
				</label>
				<textarea
					placeholder="例如：重点覆盖 React Hooks 原理，包含大量代码题；或：针对 2024 年面试热点…"
					value={extraContext}
					onChange={(e) => setExtraContext(e.target.value)}
					rows={3}
					style={{
						width: "100%",
						padding: "8px 10px",
						borderRadius: 10,
						fontSize: 12,
						background: "var(--surface-2)",
						border: "1px solid var(--border)",
						color: "var(--text)",
						resize: "none",
						outline: "none",
						fontFamily: "var(--font-sans)",
						lineHeight: 1.6,
					}}
				/>
			</div>

			<Button
				variant="primary"
				onClick={handleGenerate}
				icon={
					<svg
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				}
			>
				生成自定义 Prompt
			</Button>
		</div>
	);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PromptPage() {
	const [selectedPreset, setSelectedPreset] = useState<string>("full");
	const [customPrompt, setCustomPrompt] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");

	const currentPreset = PRESETS.find((p) => p.id === selectedPreset);
	const displayPrompt =
		activeTab === "custom" ? customPrompt : (currentPreset?.prompt ?? "");

	return (
		<div
			className="page-container animate-fade-in"
			style={{ maxWidth: 1100 }}
		>
			{/* ── Header ── */}
			<div style={{ marginBottom: 24 }}>
				<div
					style={{
						display: "flex",
						alignItems: "flex-start",
						justifyContent: "space-between",
						gap: 16,
					}}
				>
					<div>
						<h1
							style={{
								fontSize: 20,
								fontWeight: 700,
								color: "var(--text)",
								letterSpacing: "-0.02em",
								marginBottom: 6,
							}}
						>
							AI 出题 Prompt
						</h1>
						<p style={{ fontSize: 13, color: "var(--text-2)" }}>
							复制提示词，交给 AI 生成符合格式的题目，然后粘贴到「导入题目」页面
						</p>
					</div>
					<Badge variant="primary" style={{ flexShrink: 0, marginTop: 4 }}>
						推荐总量：500-600 题
					</Badge>
				</div>
			</div>

			{/* ── Two-column layout ── */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)",
					gap: 20,
					alignItems: "start",
				}}
				className="prompt-layout"
			>
				{/* ── Left: Preset selector ── */}
				<div
					className="animate-fade-in stagger-1"
					style={{ display: "flex", flexDirection: "column", gap: 12 }}
				>
					{/* Tab switcher */}
					<div
						style={{
							display: "flex",
							gap: 4,
							padding: 4,
							background: "var(--surface-2)",
							borderRadius: 12,
						}}
					>
						{(
							[
								{ key: "presets", label: "预设 Prompt" },
								{ key: "custom", label: "自定义构建" },
							] as const
						).map(({ key, label }) => (
							<button
								key={key}
								onClick={() => setActiveTab(key)}
								style={{
									flex: 1,
									padding: "6px 12px",
									borderRadius: 9,
									fontSize: 12,
									fontWeight: activeTab === key ? 500 : 400,
									color: activeTab === key ? "var(--text)" : "var(--text-2)",
									background: activeTab === key ? "var(--surface)" : "transparent",
									border: "none",
									cursor: "pointer",
									transition: "all 0.15s",
									boxShadow: activeTab === key ? "var(--shadow-sm)" : "none",
								}}
							>
								{label}
							</button>
						))}
					</div>

					{activeTab === "presets" ? (
						<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
							{PRESETS.map((preset) => (
								<PresetCard
									key={preset.id}
									preset={preset}
									selected={selectedPreset === preset.id}
									onClick={() => setSelectedPreset(preset.id)}
								/>
							))}
						</div>
					) : (
						<div className="card" style={{ padding: 16 }}>
							<CustomBuilder
								onGenerate={(prompt) => {
									setCustomPrompt(prompt);
								}}
							/>
						</div>
					)}
				</div>

				{/* ── Right: Prompt preview ── */}
				<div
					className="animate-fade-in stagger-2"
					style={{ position: "sticky", top: "calc(var(--navbar-h) + 20px)" }}
				>
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						{/* Preview header */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 8,
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<span
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "var(--text)",
									}}
								>
									{activeTab === "custom"
										? customPrompt
											? "自定义 Prompt"
											: "请在左侧配置并生成"
										: currentPreset?.title}
								</span>
								{displayPrompt && (
									<span
										style={{
											fontSize: 11,
											padding: "2px 7px",
											borderRadius: 5,
											background: "var(--surface-3)",
											color: "var(--text-3)",
											border: "1px solid var(--border-subtle)",
										}}
									>
										{displayPrompt.length} 字符
									</span>
								)}
							</div>
							{displayPrompt && <CopyButton text={displayPrompt} />}
						</div>

						{/* Prompt content */}
						{displayPrompt ? (
							<div style={{ position: "relative" }}>
								<pre
									style={{
										fontSize: 12,
										fontFamily: "var(--font-mono)",
										background: "var(--surface-2)",
										border: "1px solid var(--border-subtle)",
										borderRadius: 14,
										padding: "16px",
										overflow: "auto",
										maxHeight: "60dvh",
										color: "var(--text)",
										lineHeight: 1.7,
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
									}}
								>
									{displayPrompt}
								</pre>
								{/* Floating copy */}
								<div style={{ position: "absolute", top: 10, right: 10 }}>
									<CopyButton text={displayPrompt} />
								</div>
							</div>
						) : (
							<div
								className="card"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									padding: "64px 24px",
									textAlign: "center",
								}}
							>
								<div>
									<svg
										width="28"
										height="28"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.4"
										strokeLinecap="round"
										strokeLinejoin="round"
										style={{
											color: "var(--text-3)",
											margin: "0 auto 12px",
											opacity: 0.5,
										}}
									>
										<circle cx="12" cy="12" r="3" />
										<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
									</svg>
									<p style={{ fontSize: 13, color: "var(--text-3)" }}>
										在左侧配置参数后点击「生成自定义 Prompt」
									</p>
								</div>
							</div>
						)}

						{/* Usage guide */}
						{displayPrompt && (
							<div
								className="card animate-scale-in"
								style={{
									padding: "14px 16px",
									borderColor: "rgba(var(--primary-rgb), 0.2)",
									background: "var(--primary-light)",
									display: "flex",
									flexDirection: "column",
									gap: 10,
								}}
							>
								<p
									style={{
										fontSize: 12,
										fontWeight: 600,
										color: "var(--text)",
									}}
								>
									使用步骤
								</p>
								<ol
									style={{
										display: "flex",
										flexDirection: "column",
										gap: 8,
									}}
								>
									{[
										"点击「复制」按钮，将 Prompt 粘贴到 GPT-4o / Claude / Gemini",
										"等待 AI 生成 JSON 数组（通常需要 1-3 分钟）",
										"复制 AI 输出的 JSON，前往「导入题目」页面粘贴导入",
										"iFace 自动校验格式，有效题目直接入库，错误行单独报告",
									].map((step, i) => (
										<li
											key={i}
											style={{
												display: "flex",
												gap: 8,
												fontSize: 12,
												color: "var(--text-2)",
												listStyle: "none",
											}}
										>
											<span
												style={{
													flexShrink: 0,
													width: 16,
													height: 16,
													borderRadius: "50%",
													background: "var(--primary)",
													color: "white",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													fontSize: 9,
													fontWeight: 700,
													marginTop: 1,
												}}
											>
												{i + 1}
											</span>
											<span style={{ lineHeight: 1.6 }}>{step}</span>
										</li>
									))}
								</ol>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ── Tips ── */}
			<div
				className="animate-fade-in stagger-3"
				style={{ marginTop: 32 }}
			>
				<p
					style={{
						fontSize: 11,
						fontWeight: 600,
						color: "var(--text-3)",
						textTransform: "uppercase",
						letterSpacing: "0.08em",
						marginBottom: 12,
					}}
				>
					使用技巧
				</p>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: 10,
					}}
					className="tips-grid"
				>
					{TIPS.map((tip, i) => (
						<div
							key={i}
							className="card animate-fade-in"
							style={{
								padding: "14px 16px",
								display: "flex",
								alignItems: "flex-start",
								gap: 12,
								animationDelay: `${0.3 + i * 0.05}s`,
							}}
						>
							<div
								style={{
									width: 30,
									height: 30,
									borderRadius: 8,
									background: "var(--surface-3)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
									color: "var(--text-2)",
								}}
							>
								{tip.icon}
							</div>
							<div>
								<p
									style={{
										fontSize: 13,
										fontWeight: 600,
										color: "var(--text)",
										marginBottom: 4,
									}}
								>
									{tip.title}
								</p>
								<p
									style={{
										fontSize: 12,
										color: "var(--text-3)",
										lineHeight: 1.6,
									}}
								>
									{tip.desc}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* ── Recommended scale ── */}
			<div
				className="animate-fade-in stagger-4"
				style={{ marginTop: 20 }}
			>
				<div className="card" style={{ padding: 20 }}>
					<h2
						style={{
							fontSize: 13,
							fontWeight: 600,
							color: "var(--text)",
							marginBottom: 16,
						}}
					>
						推荐题库规模
					</h2>
					<div style={{ overflowX: "auto" }}>
						<table style={{ width: "100%", borderCollapse: "collapse" }}>
							<thead>
								<tr
									style={{
										borderBottom: "1px solid var(--border-subtle)",
									}}
								>
									{["目标", "题目数量", "生成策略", "预计用时"].map((h) => (
										<th
											key={h}
											style={{
												textAlign: "left",
												paddingBottom: 10,
												fontSize: 11,
												fontWeight: 600,
												color: "var(--text-3)",
												paddingRight: 16,
												textTransform: "uppercase",
												letterSpacing: "0.05em",
											}}
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{[
									["快速入门", "100-200 题", "全量生成 Prompt 运行一次", "15 分钟"],
									["覆盖全面", "500-600 题", "按模块分批生成，每模块 60-75 题", "1-2 小时"],
									["深度备战", "800-1000 题", "全量 + 大厂真题 + 手写题专项", "3-4 小时"],
									["超全题库", "1500+ 题", "多 AI 多轮次生成 + 去重合并", "1 天"],
								].map(([target, count, strategy, time]) => (
									<tr
										key={target}
										style={{ borderBottom: "1px solid var(--border-subtle)" }}
									>
										<td
											style={{
												padding: "10px 16px 10px 0",
												fontSize: 13,
												fontWeight: 500,
												color: "var(--text)",
											}}
										>
											{target}
										</td>
										<td style={{ padding: "10px 16px 10px 0" }}>
											<span
												style={{
													fontSize: 11,
													fontWeight: 500,
													padding: "2px 8px",
													borderRadius: 5,
													background: "var(--primary-light)",
													color: "var(--primary)",
													border: "1px solid rgba(var(--primary-rgb),0.2)",
													whiteSpace: "nowrap",
												}}
											>
												{count}
											</span>
										</td>
										<td
											style={{
												padding: "10px 16px 10px 0",
												fontSize: 12,
												color: "var(--text-2)",
											}}
										>
											{strategy}
										</td>
										<td
											style={{
												padding: "10px 0",
												fontSize: 12,
												color: "var(--text-3)",
												whiteSpace: "nowrap",
											}}
										>
											{time}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p
						style={{
							fontSize: 12,
							color: "var(--text-3)",
							marginTop: 12,
							lineHeight: 1.6,
						}}
					>
						推荐从「覆盖全面」开始，500-600 题已足够覆盖 95%
						的前端面试考点。超过 800 题后边际收益递减，建议重点放在薄弱点的深度理解。
					</p>
				</div>
			</div>

			<style>{`
				@media (max-width: 768px) {
					.prompt-layout {
						grid-template-columns: 1fr !important;
					}
					.tips-grid {
						grid-template-columns: 1fr 1fr !important;
					}
				}
				@media (max-width: 480px) {
					.tips-grid {
						grid-template-columns: 1fr !important;
					}
				}
			`}</style>
		</div>
	);
}

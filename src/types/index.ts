export type Module =
	| "JS基础"
	| "React"
	| "性能优化"
	| "网络"
	| "CSS"
	| "TypeScript"
	| "手写题"
	| "项目深挖";

export type Difficulty = 1 | 2 | 3;

export type StudyStatus = "unlearned" | "mastered" | "review";

export interface Question {
	id: string;
	module: Module;
	difficulty: Difficulty;
	question: string;
	answer: string;
	tags: string[];
	source?: string;
}

export interface StudyRecord {
	questionId: string;
	status: StudyStatus;
	lastUpdated: number; // timestamp
	reviewCount: number;
}

export type StudyRecordMap = Record<string, StudyRecord>;

export interface FilterState {
	modules: Module[];
	difficulties: Difficulty[];
	statuses: StudyStatus[];
	search: string;
}

export interface PracticeSession {
	module: Module | null;
	difficulty: Difficulty | null;
	questionIds: string[];
	currentIndex: number;
}

export const MODULE_LIST: Module[] = [
	"JS基础",
	"React",
	"性能优化",
	"网络",
	"CSS",
	"TypeScript",
	"手写题",
	"项目深挖",
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
	1: "初级",
	2: "中级",
	3: "高级",
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
	1: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
	2: "text-amber-500 bg-amber-500/10 border-amber-500/20",
	3: "text-rose-500 bg-rose-500/10 border-rose-500/20",
};

export const STATUS_LABELS: Record<StudyStatus, string> = {
	unlearned: "未学习",
	mastered: "已掌握",
	review: "待复习",
};

export const STATUS_COLORS: Record<StudyStatus, string> = {
	unlearned: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
	mastered: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
	review: "text-amber-500 bg-amber-500/10 border-amber-500/20",
};

export const MODULE_ICONS: Record<Module, string> = {
	JS基础: "⚡",
	React: "⚛️",
	性能优化: "🚀",
	网络: "🌐",
	CSS: "🎨",
	TypeScript: "🔷",
	手写题: "✍️",
	项目深挖: "🔍",
};

export const MODULE_COLORS: Record<Module, string> = {
	JS基础: "from-yellow-400 to-orange-500",
	React: "from-cyan-400 to-blue-500",
	性能优化: "from-green-400 to-emerald-500",
	网络: "from-violet-400 to-purple-500",
	CSS: "from-pink-400 to-rose-500",
	TypeScript: "from-blue-400 to-indigo-500",
	手写题: "from-amber-400 to-yellow-500",
	项目深挖: "from-teal-400 to-cyan-500",
};

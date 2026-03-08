import { validateQuestions } from "@/data/schema";
import {
	bulkPutQuestions,
	getAllQuestions,
	getLoadedModules,
	getMeta,
	META_KEYS,
	markModuleLoaded,
	setMeta,
} from "@/lib/db";
import type { Question } from "@/types";

// All built-in module JSON files under /public/questions/
export const BUILTIN_MODULE_FILES = [
	"js.json",
	"react.json",
	"css.json",
	"typescript.json",
	"network.json",
	"performance.json",
	"algorithm.json",
	"project.json",
] as const;

export type ModuleFile = (typeof BUILTIN_MODULE_FILES)[number];

interface LoadResult {
	file: string;
	loaded: number;
	skipped: number;
	errors: { index: number; message: string }[];
}

// ─── Fetch + validate + persist a single JSON file ───────────────────────────

export async function loadModuleFile(
	file: string,
	force = false,
): Promise<LoadResult> {
	// Skip if already loaded (unless forced)
	if (!force) {
		const loaded = await getLoadedModules();
		if (loaded.includes(file)) {
			return { file, loaded: 0, skipped: 0, errors: [] };
		}
	}

	const url = file.startsWith("http") ? file : `/questions/${file}`;

	let raw: unknown;
	try {
		const res = await fetch(url, { cache: force ? "reload" : "default" });
		if (!res.ok) {
			return {
				file,
				loaded: 0,
				skipped: 0,
				errors: [
					{ index: -1, message: `HTTP ${res.status}: ${res.statusText}` },
				],
			};
		}
		raw = await res.json();
	} catch (err) {
		return {
			file,
			loaded: 0,
			skipped: 0,
			errors: [{ index: -1, message: String(err) }],
		};
	}

	const { valid, errors } = validateQuestions(raw);

	if (valid.length > 0) {
		await bulkPutQuestions(valid as Question[]);
		if (!force) {
			await markModuleLoaded(file);
		}
	}

	return {
		file,
		loaded: valid.length,
		skipped: Array.isArray(raw) ? (raw as unknown[]).length - valid.length : 0,
		errors,
	};
}

// ─── Load all built-in modules (skips already-loaded ones) ───────────────────

export async function loadAllBuiltinModules(
	onProgress?: (file: string, index: number, total: number) => void,
): Promise<LoadResult[]> {
	const results: LoadResult[] = [];
	const total = BUILTIN_MODULE_FILES.length;

	for (let i = 0; i < BUILTIN_MODULE_FILES.length; i++) {
		const file = BUILTIN_MODULE_FILES[i];
		onProgress?.(file, i, total);
		const result = await loadModuleFile(file);
		results.push(result);
	}

	return results;
}

// ─── Load all modules in parallel (faster, use carefully) ────────────────────

export async function loadAllBuiltinModulesParallel(): Promise<LoadResult[]> {
	return Promise.all(BUILTIN_MODULE_FILES.map((f) => loadModuleFile(f)));
}

// ─── Import from raw JSON string or parsed object (user custom import) ────────

export interface CustomImportResult {
	source: string;
	loaded: number;
	errors: { index: number; message: string }[];
	warnings: string[];
}

export async function importCustomQuestions(
	data: unknown,
	sourceName: string,
): Promise<CustomImportResult> {
	const warnings: string[] = [];

	const { valid, errors } = validateQuestions(data);

	if (valid.length === 0) {
		return { source: sourceName, loaded: 0, errors, warnings };
	}

	// Stamp every question with the custom source name for tracking
	const stamped: Question[] = valid.map((q) => ({
		...(q as Question),
		source: sourceName,
		// Prefix id to avoid collision with built-in questions
		id: q.id.startsWith(`custom_${sourceName}_`)
			? q.id
			: `custom_${sourceName}_${q.id}`,
	}));

	// Warn about any id collisions (questions that will overwrite existing)
	const existingAll = await getAllQuestions();
	const existingIds = new Set(existingAll.map((q) => q.id));
	for (const q of stamped) {
		if (existingIds.has(q.id)) {
			warnings.push(`题目 ID "${q.id}" 已存在，将被覆盖`);
		}
	}

	await bulkPutQuestions(stamped);

	return { source: sourceName, loaded: stamped.length, errors, warnings };
}

// ─── Parse JSON string safely ─────────────────────────────────────────────────

export function parseJSONSafe(
	raw: string,
): { ok: true; data: unknown } | { ok: false; error: string } {
	try {
		return { ok: true, data: JSON.parse(raw) };
	} catch (err) {
		return { ok: false, error: String(err) };
	}
}

// ─── Check if a file is a JSON file by name ───────────────────────────────────

export function isJSONFile(file: File): boolean {
	return (
		file.type === "application/json" ||
		file.name.toLowerCase().endsWith(".json")
	);
}

// ─── Daily recommendations cache ─────────────────────────────────────────────

interface DailyCache {
	date: string;
	ids: string[];
}

function todayString(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function getDailyRecommendations(
	allIds: string[],
	recordMap: Record<string, { status: string; lastUpdated: number }>,
	count = 10,
): Promise<string[]> {
	// Return from cache if same day
	const cached = await getMeta<DailyCache>(META_KEYS.DAILY_RECS);
	if (cached && cached.date === todayString()) {
		// Filter out ids that no longer exist
		const valid = cached.ids.filter((id) => allIds.includes(id));
		if (valid.length > 0) return valid;
	}

	// Priority 1: review questions sorted by oldest lastUpdated
	const reviewIds = allIds
		.filter((id) => recordMap[id]?.status === "review")
		.sort(
			(a, b) =>
				(recordMap[a]?.lastUpdated ?? 0) - (recordMap[b]?.lastUpdated ?? 0),
		);

	// Priority 2: unlearned questions
	const unlearnedIds = allIds.filter(
		(id) => !recordMap[id] || recordMap[id].status === "unlearned",
	);

	const result: string[] = [];
	const seen = new Set<string>();

	for (const id of [...reviewIds, ...unlearnedIds]) {
		if (result.length >= count) break;
		if (!seen.has(id)) {
			result.push(id);
			seen.add(id);
		}
	}

	await setMeta(META_KEYS.DAILY_RECS, { date: todayString(), ids: result });
	return result;
}

// ─── Invalidate daily cache (call when user marks questions) ─────────────────

export async function invalidateDailyCache(): Promise<void> {
	await setMeta(META_KEYS.DAILY_RECS, null);
}

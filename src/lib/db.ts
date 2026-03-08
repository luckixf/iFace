import { type IDBPDatabase, openDB } from "idb";
import type { Question, StudyRecord } from "@/types";

const DB_NAME = "iface_db";
const DB_VERSION = 1;

export const STORES = {
	QUESTIONS: "questions",
	STUDY_RECORDS: "study_records",
	META: "meta",
} as const;

export interface MetaEntry {
	key: string;
	value: unknown;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				// Questions store
				if (!db.objectStoreNames.contains(STORES.QUESTIONS)) {
					const qs = db.createObjectStore(STORES.QUESTIONS, { keyPath: "id" });
					qs.createIndex("module", "module", { unique: false });
					qs.createIndex("difficulty", "difficulty", { unique: false });
					qs.createIndex("source", "source", { unique: false });
				}

				// Study records store
				if (!db.objectStoreNames.contains(STORES.STUDY_RECORDS)) {
					const rs = db.createObjectStore(STORES.STUDY_RECORDS, {
						keyPath: "questionId",
					});
					rs.createIndex("status", "status", { unique: false });
					rs.createIndex("lastUpdated", "lastUpdated", { unique: false });
				}

				// Meta store (for tracking loaded modules, version, etc.)
				if (!db.objectStoreNames.contains(STORES.META)) {
					db.createObjectStore(STORES.META, { keyPath: "key" });
				}
			},
		});
	}
	return dbPromise;
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function bulkPutQuestions(questions: Question[]): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(STORES.QUESTIONS, "readwrite");
	await Promise.all([...questions.map((q) => tx.store.put(q)), tx.done]);
}

export async function getAllQuestions(): Promise<Question[]> {
	const db = await getDB();
	return db.getAll(STORES.QUESTIONS);
}

export async function getQuestionById(
	id: string,
): Promise<Question | undefined> {
	const db = await getDB();
	return db.get(STORES.QUESTIONS, id);
}

export async function getQuestionsByModule(
	module: string,
): Promise<Question[]> {
	const db = await getDB();
	return db.getAllFromIndex(STORES.QUESTIONS, "module", module);
}

export async function getQuestionCount(): Promise<number> {
	const db = await getDB();
	return db.count(STORES.QUESTIONS);
}

export async function deleteQuestionsBySource(source: string): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(STORES.QUESTIONS, "readwrite");
	const index = tx.store.index("source");
	let cursor = await index.openCursor(source);
	while (cursor) {
		await cursor.delete();
		cursor = await cursor.continue();
	}
	await tx.done;
}

export async function deleteQuestionById(id: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORES.QUESTIONS, id);
}

// ─── Study Records ────────────────────────────────────────────────────────────

export async function getAllStudyRecords(): Promise<StudyRecord[]> {
	const db = await getDB();
	return db.getAll(STORES.STUDY_RECORDS);
}

export async function putStudyRecord(record: StudyRecord): Promise<void> {
	const db = await getDB();
	await db.put(STORES.STUDY_RECORDS, record);
}

export async function bulkPutStudyRecords(
	records: StudyRecord[],
): Promise<void> {
	const db = await getDB();
	const tx = db.transaction(STORES.STUDY_RECORDS, "readwrite");
	await Promise.all([...records.map((r) => tx.store.put(r)), tx.done]);
}

export async function getStudyRecord(
	questionId: string,
): Promise<StudyRecord | undefined> {
	const db = await getDB();
	return db.get(STORES.STUDY_RECORDS, questionId);
}

export async function deleteStudyRecord(questionId: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORES.STUDY_RECORDS, questionId);
}

export async function clearAllStudyRecords(): Promise<void> {
	const db = await getDB();
	await db.clear(STORES.STUDY_RECORDS);
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

export async function getMeta<T>(key: string): Promise<T | undefined> {
	const db = await getDB();
	const entry = await db.get(STORES.META, key);
	return entry?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
	const db = await getDB();
	await db.put(STORES.META, { key, value });
}

export async function deleteMeta(key: string): Promise<void> {
	const db = await getDB();
	await db.delete(STORES.META, key);
}

// ─── Meta Keys ────────────────────────────────────────────────────────────────

export const META_KEYS = {
	LOADED_MODULES: "loaded_modules", // string[] — which JSON modules are loaded
	CUSTOM_SOURCES: "custom_sources", // string[] — user-imported source names
	DAILY_RECS: "daily_recommendations", // { date, ids }
	SCHEMA_VERSION: "schema_version",
} as const;

// ─── Module loader tracking ───────────────────────────────────────────────────

export async function getLoadedModules(): Promise<string[]> {
	return (await getMeta<string[]>(META_KEYS.LOADED_MODULES)) ?? [];
}

export async function markModuleLoaded(moduleFile: string): Promise<void> {
	const current = await getLoadedModules();
	if (!current.includes(moduleFile)) {
		await setMeta(META_KEYS.LOADED_MODULES, [...current, moduleFile]);
	}
}

export async function getCustomSources(): Promise<string[]> {
	return (await getMeta<string[]>(META_KEYS.CUSTOM_SOURCES)) ?? [];
}

export async function addCustomSource(source: string): Promise<void> {
	const current = await getCustomSources();
	if (!current.includes(source)) {
		await setMeta(META_KEYS.CUSTOM_SOURCES, [...current, source]);
	}
}

export async function removeCustomSource(source: string): Promise<void> {
	const current = await getCustomSources();
	await setMeta(
		META_KEYS.CUSTOM_SOURCES,
		current.filter((s) => s !== source),
	);
}

// ─── Export all data (for backup) ────────────────────────────────────────────

export async function exportAllData(): Promise<{
	questions: Question[];
	studyRecords: StudyRecord[];
}> {
	const [questions, studyRecords] = await Promise.all([
		getAllQuestions(),
		getAllStudyRecords(),
	]);
	return { questions, studyRecords };
}

// ─── Reset DB ─────────────────────────────────────────────────────────────────

export async function resetDatabase(): Promise<void> {
	const db = await getDB();
	await Promise.all([
		db.clear(STORES.QUESTIONS),
		db.clear(STORES.STUDY_RECORDS),
		db.clear(STORES.META),
	]);
	dbPromise = null;
}

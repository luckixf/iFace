import { useCallback, useEffect, useReducer, useRef } from "react";
import {
	clearAllStudyRecords,
	deleteStudyRecord,
	getAllStudyRecords,
	putStudyRecord,
} from "@/lib/db";
import { invalidateDailyCache } from "@/lib/questionLoader";
import type { StudyRecord, StudyRecordMap, StudyStatus } from "@/types";

// ─── Theme ────────────────────────────────────────────────────────────────────

const THEME_KEY = "iface_theme";

function loadTheme(): "light" | "dark" {
	try {
		const stored = localStorage.getItem(THEME_KEY);
		if (stored === "light" || stored === "dark") return stored;
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	} catch {
		return "light";
	}
}

function saveTheme(theme: "light" | "dark"): void {
	try {
		localStorage.setItem(THEME_KEY, theme);
	} catch {}
}

function applyThemeToDom(theme: "light" | "dark"): void {
	if (theme === "dark") {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}
}

// ─── State ────────────────────────────────────────────────────────────────────

interface StoreState {
	records: StudyRecordMap;
	theme: "light" | "dark";
	initialized: boolean;
}

type Action =
	| { type: "INIT"; records: StudyRecordMap; theme: "light" | "dark" }
	| { type: "SET_RECORD"; record: StudyRecord }
	| { type: "DELETE_RECORD"; questionId: string }
	| { type: "RESET_RECORDS" }
	| { type: "SET_THEME"; theme: "light" | "dark" };

function reducer(state: StoreState, action: Action): StoreState {
	switch (action.type) {
		case "INIT":
			return {
				...state,
				records: action.records,
				theme: action.theme,
				initialized: true,
			};
		case "SET_RECORD":
			return {
				...state,
				records: {
					...state.records,
					[action.record.questionId]: action.record,
				},
			};
		case "DELETE_RECORD": {
			const next = { ...state.records };
			delete next[action.questionId];
			return { ...state, records: next };
		}
		case "RESET_RECORDS":
			return { ...state, records: {} };
		case "SET_THEME":
			return { ...state, theme: action.theme };
		default:
			return state;
	}
}

// ─── Singleton broadcast channel (cross-tab sync) ────────────────────────────

let channel: BroadcastChannel | null = null;
try {
	channel = new BroadcastChannel("iface_store");
} catch {
	// BroadcastChannel not supported (e.g. Safari < 15.4)
}

// ─── Global listener registry (multiple hook instances on same page) ──────────

const _listeners = new Set<(action: Action) => void>();

function broadcast(action: Action) {
	for (const fn of _listeners) fn(action);
	try {
		channel?.postMessage(action);
	} catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudyStore() {
	const [state, dispatch] = useReducer(reducer, {
		records: {},
		theme: loadTheme(),
		initialized: false,
	});

	// Keep a stable ref so callbacks don't go stale
	const stateRef = useRef(state);
	stateRef.current = state;

	// ── Initialize from IndexedDB ──
	useEffect(() => {
		const theme = loadTheme();
		applyThemeToDom(theme);

		getAllStudyRecords().then((records) => {
			const map: StudyRecordMap = {};
			for (const r of records) map[r.questionId] = r;
			dispatch({ type: "INIT", records: map, theme });
		});
	}, []);

	// ── Register as a global listener (sync across hook instances on same page) ──
	useEffect(() => {
		const listener = (action: Action) => dispatch(action);
		_listeners.add(listener);
		return () => {
			_listeners.delete(listener);
		};
	}, []);

	// ── Cross-tab sync via BroadcastChannel ──
	useEffect(() => {
		if (!channel) return;
		const handler = (e: MessageEvent<Action>) => dispatch(e.data);
		channel.addEventListener("message", handler);
		return () => channel?.removeEventListener("message", handler);
	}, []);

	// ─── Actions ────────────────────────────────────────────────────────────────

	const setStatus = useCallback(
		async (questionId: string, status: StudyStatus) => {
			const existing = stateRef.current.records[questionId];
			const record: StudyRecord = {
				questionId,
				status,
				lastUpdated: Date.now(),
				reviewCount: existing
					? status === "review"
						? existing.reviewCount + 1
						: existing.reviewCount
					: status === "review"
						? 1
						: 0,
			};
			// Optimistic update first
			const action: Action = { type: "SET_RECORD", record };
			broadcast(action);
			// Persist
			await putStudyRecord(record);
			await invalidateDailyCache();
		},
		[],
	);

	const clearRecord = useCallback(async (questionId: string) => {
		const action: Action = { type: "DELETE_RECORD", questionId };
		broadcast(action);
		await deleteStudyRecord(questionId);
	}, []);

	const resetAll = useCallback(async () => {
		const action: Action = { type: "RESET_RECORDS" };
		broadcast(action);
		await clearAllStudyRecords();
		await invalidateDailyCache();
	}, []);

	const setTheme = useCallback((theme: "light" | "dark") => {
		saveTheme(theme);
		applyThemeToDom(theme);
		const action: Action = { type: "SET_THEME", theme };
		broadcast(action);
	}, []);

	const toggleTheme = useCallback(() => {
		const next = stateRef.current.theme === "light" ? "dark" : "light";
		saveTheme(next);
		applyThemeToDom(next);
		const action: Action = { type: "SET_THEME", theme: next };
		broadcast(action);
	}, []);

	// ─── Queries (pure, derived from state) ─────────────────────────────────────

	const getStatus = useCallback(
		(questionId: string): StudyStatus =>
			stateRef.current.records[questionId]?.status ?? "unlearned",
		[],
	);

	const getRecord = useCallback(
		(questionId: string): StudyRecord | undefined =>
			stateRef.current.records[questionId],
		[],
	);

	const getStatusCounts = useCallback((questionIds?: string[]) => {
		const counts = { unlearned: 0, mastered: 0, review: 0 };
		const ids = questionIds ?? Object.keys(stateRef.current.records);

		if (questionIds) {
			for (const id of ids) {
				const status = stateRef.current.records[id]?.status ?? "unlearned";
				counts[status]++;
			}
		} else {
			for (const r of Object.values(stateRef.current.records)) {
				counts[r.status]++;
			}
		}
		return counts;
	}, []);

	const getWeakQuestions = useCallback((): StudyRecord[] => {
		return Object.values(stateRef.current.records)
			.filter((r) => r.status === "review")
			.sort((a, b) => a.lastUpdated - b.lastUpdated);
	}, []);

	const getEstimatedDays = useCallback(
		(totalQuestions: number, dailyCount = 10): number => {
			const mastered = Object.values(stateRef.current.records).filter(
				(r) => r.status === "mastered",
			).length;
			const remaining = totalQuestions - mastered;
			return remaining <= 0 ? 0 : Math.ceil(remaining / dailyCount);
		},
		[],
	);

	return {
		records: state.records,
		theme: state.theme,
		initialized: state.initialized,

		// Actions
		setStatus,
		clearRecord,
		resetAll,
		setTheme,
		toggleTheme,

		// Queries
		getStatus,
		getRecord,
		getStatusCounts,
		getWeakQuestions,
		getEstimatedDays,
	};
}

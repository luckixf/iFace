/**
 * gistSync.ts
 *
 * Sync iFace study progress and custom question banks to/from a private
 * GitHub Gist named "iface-backup.json".
 *
 * Data shape stored in the Gist:
 * {
 *   version: 1,
 *   exportedAt: "<ISO timestamp>",
 *   studyRecords: StudyRecord[],
 *   customQuestions: Question[],   // only questions with a source field
 *   categoryMap: CategoryMap,
 *   customSources: string[],
 * }
 */

import type { Question, StudyRecord } from "@/types";
import type { CategoryMap } from "@/lib/db";

// ─── Constants ────────────────────────────────────────────────────────────────

const GIST_FILENAME = "iface-backup.json";
const GIST_DESCRIPTION = "iFace study progress backup (auto-generated)";
const BACKUP_VERSION = 1;

const GH_API = "https://api.github.com";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GistBackup {
  version: number;
  exportedAt: string;
  studyRecords: StudyRecord[];
  /** Only user-imported (custom) questions; built-in ones are re-fetched locally */
  customQuestions: Question[];
  categoryMap: CategoryMap;
  customSources: string[];
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  /** ISO timestamp of the backup that was just written/read */
  exportedAt?: string;
  /** Number of study records in the backup */
  recordCount?: number;
  /** Number of custom questions in the backup */
  questionCount?: number;
}

interface GistFile {
  filename: string;
  content: string;
  truncated?: boolean;
  raw_url?: string;
}

interface GistResponse {
  id: string;
  description: string;
  files: Record<string, GistFile | null>;
  updated_at: string;
  html_url: string;
}

// ─── GitHub API helpers ───────────────────────────────────────────────────────

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch<T>(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      ...ghHeaders(token),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${res.statusText}: ${body}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Gist lookup ──────────────────────────────────────────────────────────────

/**
 * Find the iFace backup Gist ID by listing the authenticated user's gists
 * and looking for one that contains our sentinel filename.
 * Returns null if not found.
 */
export async function findBackupGistId(token: string): Promise<string | null> {
  // Fetch the first few pages (each page = 30 gists) until we find it or run out
  for (let page = 1; page <= 5; page++) {
    const gists = await ghFetch<GistResponse[]>(
      token,
      `/gists?per_page=30&page=${page}`,
    );

    if (!Array.isArray(gists) || gists.length === 0) break;

    for (const gist of gists) {
      if (gist.files && GIST_FILENAME in gist.files) {
        return gist.id;
      }
    }

    // If fewer than 30 results we've reached the last page
    if (gists.length < 30) break;
  }

  return null;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Load the backup from the user's private Gist.
 * Returns null if no backup Gist exists yet.
 */
export async function loadFromGist(
  token: string,
): Promise<GistBackup | null> {
  const gistId = await findBackupGistId(token);
  if (!gistId) return null;

  const gist = await ghFetch<GistResponse>(token, `/gists/${gistId}`);

  const file = gist.files[GIST_FILENAME];
  if (!file) return null;

  // If content is truncated, fetch from raw_url
  let rawContent = file.content;
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!rawRes.ok) {
      throw new Error(`Failed to fetch raw Gist content: ${rawRes.status}`);
    }
    rawContent = await rawRes.text();
  }

  const parsed = JSON.parse(rawContent) as GistBackup;

  // Basic version check — ignore future incompatible backups
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup version ${parsed.version} is not supported (expected ${BACKUP_VERSION})`,
    );
  }

  return parsed;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Save the backup to the user's private Gist.
 * Creates a new Gist on first use; patches the existing one on subsequent saves.
 */
export async function saveToGist(
  token: string,
  backup: Omit<GistBackup, "version" | "exportedAt">,
): Promise<SyncResult> {
  try {
    const payload: GistBackup = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      ...backup,
    };

    const content = JSON.stringify(payload, null, 2);

    const gistId = await findBackupGistId(token);

    if (gistId) {
      // PATCH existing gist
      await ghFetch<GistResponse>(token, `/gists/${gistId}`, {
        method: "PATCH",
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          files: {
            [GIST_FILENAME]: { content },
          },
        }),
      });
    } else {
      // POST new gist
      await ghFetch<GistResponse>(token, "/gists", {
        method: "POST",
        body: JSON.stringify({
          description: GIST_DESCRIPTION,
          public: false,
          files: {
            [GIST_FILENAME]: { content },
          },
        }),
      });
    }

    return {
      ok: true,
      exportedAt: payload.exportedAt,
      recordCount: payload.studyRecords.length,
      questionCount: payload.customQuestions.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete the backup Gist entirely.
 * Used when the user wants to revoke all cloud data.
 */
export async function deleteBackupGist(token: string): Promise<SyncResult> {
  try {
    const gistId = await findBackupGistId(token);
    if (!gistId) return { ok: true }; // nothing to delete

    await ghFetch<void>(token, `/gists/${gistId}`, { method: "DELETE" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Convenience wrapper used by UI ──────────────────────────────────────────

/**
 * Collect all local data and push to Gist.
 * Import the DB functions lazily to avoid circular deps.
 */
export async function pushToGist(token: string): Promise<SyncResult> {
  try {
    const { getAllStudyRecords, getAllQuestions, getCustomSources, getCategoryMap } =
      await import("@/lib/db");

    const [studyRecords, allQuestions, customSources, categoryMap] =
      await Promise.all([
        getAllStudyRecords(),
        getAllQuestions(),
        getCustomSources(),
        getCategoryMap(),
      ]);

    // Only backup user-imported questions (those with a source field set)
    const customQuestions = allQuestions.filter((q) => !!q.source);

    return saveToGist(token, {
      studyRecords,
      customQuestions,
      categoryMap,
      customSources,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pull backup from Gist and merge into local DB.
 * Study records are always overwritten (latest wins).
 * Custom questions are upserted (new ones added, existing ones updated).
 * Returns null if no backup exists yet.
 */
export async function pullFromGist(token: string): Promise<SyncResult | null> {
  try {
    const backup = await loadFromGist(token);
    if (!backup) return null;

    const {
      bulkPutStudyRecords,
      bulkPutQuestions,
      setMeta,
      META_KEYS,
      saveCategoryMap,
    } = await import("@/lib/db");

    const ops: Promise<unknown>[] = [
      bulkPutStudyRecords(backup.studyRecords),
    ];

    if (backup.customQuestions.length > 0) {
      ops.push(bulkPutQuestions(backup.customQuestions));
    }

    if (backup.customSources?.length) {
      ops.push(setMeta(META_KEYS.CUSTOM_SOURCES, backup.customSources));
    }

    if (backup.categoryMap && Object.keys(backup.categoryMap).length > 0) {
      ops.push(saveCategoryMap(backup.categoryMap));
    }

    await Promise.all(ops);

    return {
      ok: true,
      exportedAt: backup.exportedAt,
      recordCount: backup.studyRecords.length,
      questionCount: backup.customQuestions.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

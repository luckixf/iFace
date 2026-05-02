#!/usr/bin/env python3
"""Run stricter content checks on the generated construction question JSON."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
QUESTION_ROOT = ROOT / "public" / "questions" / "construction"
REPORT_ROOT = ROOT / "reports"

CORRECT_ANSWER = "\u6b63\u786e\u7b54\u6848"
ANALYSIS = "\u89e3\u6790"
PLACEHOLDER = "\u6682\u65e0"

QUESTION_BLANK_RE = r"(?:\(\s*\)|\uff08\s*\uff09)"
VISUAL_CUE_RE = re.compile(
    r"(?:"
    r"\u5982\u4e0b\u56fe|\u4e0b\u56fe|\u5982\u56fe\u6240\u793a|\u56fe\s*[0-9\uff10-\uff19]"
    r"|\u5982\u4e0b\u8868|\u89c1\u4e0b\u8868|\u4e0b\u8868\s*[0-9\uff10-\uff19]|\u8868\s*[0-9\uff10-\uff19]"
    r")"
)
ANSWER_SPILL_RE = re.compile(
    rf"(?m)\n\s*\d{{1,3}}[\.\uff0e]\s*[^\n]{{0,90}}{QUESTION_BLANK_RE}"
)
OPTION_ANSWER_LEAK_RE = re.compile(
    r"(?:"
    r"\u9009\u9879[ABCDE].{0,8}\u6b63\u786e|\u9009\u9879[ABCDE].{0,8}\u9519\u8bef"
    r"|\u6545\u9009|\u672c\u9898\u5e94\u9009|\u7efc\u4e0a.{0,20}\u9009"
    r"|\u7b54\u6848[\u4e3a\u662f]|\u6b63\u786e\u7b54\u6848"
    r")"
)


@dataclass
class Issue:
    severity: str
    code: str
    question_id: str
    file: str
    detail: str


def load_question_files() -> list[tuple[Path, list[dict[str, Any]]]]:
    files: list[tuple[Path, list[dict[str, Any]]]] = []
    for path in sorted(QUESTION_ROOT.rglob("*.json")):
        if path.name == "catalog.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            files.append((path, payload))
    return files


def option_keys(question: dict[str, Any]) -> list[str]:
    options = question.get("options")
    if not isinstance(options, list):
        return []
    return [str(option.get("key", "")) for option in options if isinstance(option, dict)]


def add_issue(
    issues: list[Issue],
    severity: str,
    code: str,
    question: dict[str, Any] | None,
    file: str,
    detail: str,
) -> None:
    issues.append(
        Issue(
            severity=severity,
            code=code,
            question_id=str(question.get("id", "")) if question else "",
            file=file,
            detail=detail,
        )
    )


def validate_questions(files: list[tuple[Path, list[dict[str, Any]]]]) -> list[Issue]:
    issues: list[Issue] = []
    seen_ids: dict[str, str] = {}

    for path, questions in files:
        rel_file = str(path.relative_to(QUESTION_ROOT)).replace("\\", "/")
        for question in questions:
            qid = str(question.get("id", ""))
            qtype = str(question.get("type", ""))
            stem = str(question.get("question", ""))
            answer = str(question.get("answer", ""))
            keys = option_keys(question)

            if not qid:
                add_issue(issues, "error", "missing_question_id", question, rel_file, "question has no id")
            elif qid in seen_ids:
                add_issue(issues, "error", "duplicate_question_id", question, rel_file, seen_ids[qid])
            else:
                seen_ids[qid] = rel_file

            if not stem.strip():
                add_issue(issues, "error", "empty_question_stem", question, rel_file, "question stem is empty")
            if PLACEHOLDER in stem or PLACEHOLDER in answer:
                add_issue(issues, "error", "placeholder_question", question, rel_file, "placeholder text remains")
            if qtype in {"single", "multiple"} and not keys:
                add_issue(issues, "error", "choice_without_options", question, rel_file, "choice question has no options")
            if len(keys) != len(set(keys)):
                add_issue(issues, "error", "duplicate_option_keys", question, rel_file, ",".join(keys))

            correct_answers = [str(item) for item in question.get("correctAnswers") or []]
            if qtype in {"single", "multiple"}:
                missing = [letter for letter in correct_answers if letter not in keys]
                if missing:
                    add_issue(issues, "error", "answer_not_in_options", question, rel_file, ",".join(missing))
                if f"## {ANALYSIS}" not in answer:
                    add_issue(issues, "warn", "choice_missing_analysis_section", question, rel_file, answer[:120])
                if answer.strip().endswith((":", "\uff1a")) and not question.get("questionImages"):
                    add_issue(issues, "review", "choice_analysis_ends_with_colon", question, rel_file, answer[-160:])

            if qtype == "single" and len(correct_answers) != 1:
                add_issue(issues, "error", "single_answer_count", question, rel_file, ",".join(correct_answers))
            if qtype == "multiple" and len(correct_answers) < 2:
                add_issue(issues, "warn", "multiple_answer_count", question, rel_file, ",".join(correct_answers))

            if VISUAL_CUE_RE.search(stem) and not question.get("questionImages"):
                add_issue(issues, "error", "visual_cue_without_image", question, rel_file, stem[:160])

            if ANSWER_SPILL_RE.search(answer):
                add_issue(issues, "review", "answer_contains_next_question_like_text", question, rel_file, answer[-240:])

            for option in question.get("options") or []:
                if isinstance(option, dict) and OPTION_ANSWER_LEAK_RE.search(str(option.get("text", ""))):
                    add_issue(
                        issues,
                        "error",
                        "option_contains_answer_language",
                        question,
                        rel_file,
                        f"{option.get('key')}: {option.get('text')}",
                    )

    return issues


def validate_catalog(files: list[tuple[Path, list[dict[str, Any]]]], issues: list[Issue]) -> None:
    catalog_path = QUESTION_ROOT / "catalog.json"
    if not catalog_path.exists():
        add_issue(issues, "error", "missing_catalog", None, "catalog.json", "catalog file is missing")
        return

    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    question_ids = {str(question.get("id", "")) for _, questions in files for question in questions}
    catalog_ids = [str(item.get("id", "")) for item in catalog if isinstance(item, dict)]
    catalog_id_set = set(catalog_ids)

    for duplicate_id, count in Counter(catalog_ids).items():
        if duplicate_id and count > 1:
            issues.append(Issue("error", "duplicate_catalog_id", duplicate_id, "catalog.json", str(count)))
    for missing in sorted(question_ids - catalog_id_set):
        issues.append(Issue("error", "question_missing_from_catalog", missing, "catalog.json", ""))
    for extra in sorted(catalog_id_set - question_ids):
        issues.append(Issue("error", "catalog_points_to_missing_question", extra, "catalog.json", ""))


def write_reports(summary: dict[str, Any], issues: list[Issue]) -> None:
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": summary,
        "issues": [asdict(issue) for issue in issues],
    }
    (REPORT_ROOT / "full_question_validation.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# Full Question Validation",
        "",
        f"- Questions: {summary['questions']}",
        f"- Question files: {summary['question_files']}",
        f"- Catalog entries: {summary['catalog_entries']}",
        f"- Issues: {summary['issues']}",
        f"- By severity: {summary['by_severity']}",
        f"- By code: {summary['by_code']}",
    ]
    if issues:
        lines.extend(["", "## Issues"])
        for issue in issues[:300]:
            lines.append(
                f"- `{issue.severity}` `{issue.code}` `{issue.question_id}` "
                f"`{issue.file}` - {issue.detail}"
            )
    (REPORT_ROOT / "full_question_validation.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def validate() -> tuple[list[Issue], dict[str, Any]]:
    files = load_question_files()
    issues = validate_questions(files)
    validate_catalog(files, issues)

    catalog_path = QUESTION_ROOT / "catalog.json"
    catalog_entries = 0
    if catalog_path.exists():
        catalog_entries = len(json.loads(catalog_path.read_text(encoding="utf-8")))

    summary = {
        "questions": sum(len(questions) for _, questions in files),
        "question_files": len(files),
        "catalog_entries": catalog_entries,
        "issues": len(issues),
        "by_severity": dict(Counter(issue.severity for issue in issues)),
        "by_code": dict(Counter(issue.code for issue in issues)),
    }
    return issues, summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args()

    issues, summary = validate()
    write_reports(summary, issues)

    print(f"questions={summary['questions']}")
    print(f"question_files={summary['question_files']}")
    print(f"catalog_entries={summary['catalog_entries']}")
    print(f"issues={summary['issues']}")
    print(f"by_severity={summary['by_severity']}")
    print(f"by_code={summary['by_code']}")
    print("report_json=reports/full_question_validation.json")
    print("report_md=reports/full_question_validation.md")

    has_error = any(issue.severity == "error" for issue in issues)
    return 1 if args.fail_on_error and has_error else 0


if __name__ == "__main__":
    raise SystemExit(main())

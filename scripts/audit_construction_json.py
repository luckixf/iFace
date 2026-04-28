#!/usr/bin/env python3
"""
Audit generated construction question JSON without rebuilding PDFs.

The audit is intentionally conservative: it does not try to rewrite questions.
It flags structural errors, answer/option inconsistencies, image reference
problems, likely OCR artifacts, and likely parser spillover where an answer or
analysis paragraph was imported into the next question stem.
"""

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
PUBLIC_ROOT = ROOT / "public"
REPORT_ROOT = ROOT / "reports"

CORRECT_ANSWER = "\u6b63\u786e\u7b54\u6848"
REFERENCE_ANSWER = "\u53c2\u8003\u7b54\u6848"
ANALYSIS = "\u89e3\u6790"
ANSWER_ANALYSIS = "\u7b54\u6848\u89e3\u6790"
OPTION = "\u9009\u9879"
RIGHT = "\u6b63\u786e"
WRONG = "\u9519\u8bef"
MATCH = "\u7b26\u5408"
NOT_MATCH = "\u4e0d\u7b26\u5408"
THEREFORE_CHOOSE = "\u6545\u9009"
SO_CHOOSE = "\u56e0\u6b64\u9009"
SHOULD_CHOOSE = "\u5e94\u9009"
NOT_CHOOSE = "\u4e0d\u9009"
STEEL_PILE_WRONG = "\u94a2\u677f\u7ca7"
PILE_WRONG = "\u7ca7"
WATERMARK_WORDS = [
    "\u4e13\u4e1a\u7f51\u6821",
    "\u7f51\u6821\u8bfe\u7a0b",
    "\u9898\u5e93\u8f6f\u4ef6",
    "\u5927\u7acb\u6559\u80b2",
    "\u804c\u4e1a\u8003\u8bd5\u5b66\u4e60\u5e73\u53f0",
]


@dataclass
class Issue:
    severity: str
    code: str
    question_id: str
    file: str
    index: int
    question_type: str
    module: str
    detail: str
    question_preview: str


def clean_preview(text: Any, limit: int = 220) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()[:limit]


def add_issue(issues: list[Issue], question: dict[str, Any], severity: str, code: str, detail: str) -> None:
    issues.append(
        Issue(
            severity=severity,
            code=code,
            question_id=str(question.get("id", "<missing>")),
            file=str(question.get("_file", "")),
            index=int(question.get("_index", -1)),
            question_type=str(question.get("type", "")),
            module=str(question.get("module", "")),
            detail=detail,
            question_preview=clean_preview(question.get("question", "")),
        )
    )


def extract_answer_letters(answer: str) -> list[str]:
    heading = f"(?:{CORRECT_ANSWER}|{REFERENCE_ANSWER})"
    match = re.search(
        rf"{heading}[ \t]*\n[ \t]*([A-E](?:[ \t/,\u3001\uff0c]*[A-E])*)[ \t]*(?:\n|$)",
        answer,
    )
    if not match:
        return []
    return re.findall(r"[A-E]", match.group(1))


def load_questions() -> tuple[list[dict[str, Any]], list[str]]:
    questions: list[dict[str, Any]] = []
    file_errors: list[str] = []

    for path in sorted(QUESTION_ROOT.rglob("*.json")):
        if path.name == "catalog.json":
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - diagnostic script
            file_errors.append(f"{path}: {exc!r}")
            continue

        if not isinstance(payload, list):
            file_errors.append(f"{path}: top-level value is not an array")
            continue

        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                file_errors.append(f"{path}: item {index} is not an object")
                continue
            question = dict(item)
            question["_file"] = str(path.relative_to(ROOT)).replace("\\", "/")
            question["_index"] = index
            questions.append(question)

    return questions, file_errors


def audit_questions(questions: list[dict[str, Any]], file_errors: list[str]) -> list[Issue]:
    issues: list[Issue] = []
    id_counts = Counter(question.get("id") for question in questions)

    for question in questions:
        qid = question.get("id")
        if not isinstance(qid, str) or not qid.strip():
            add_issue(issues, question, "error", "missing_id", "id missing or empty")
        elif id_counts[qid] > 1:
            add_issue(issues, question, "error", "duplicate_id", f"{id_counts[qid]} occurrences")

    for question in questions:
        qtype = question.get("type")
        stem = str(question.get("question", ""))
        answer = str(question.get("answer", ""))
        options = question.get("options") or []
        correct_answers = question.get("correctAnswers") or []
        option_texts = [str(option.get("text", "")) for option in options if isinstance(option, dict)]
        all_text = "\n".join([stem, answer, *option_texts])

        for field in ["id", "module", "question", "answer"]:
            value = question.get(field)
            if not isinstance(value, str) or not value.strip():
                add_issue(issues, question, "error", "missing_required_text", field)

        if qtype not in {"single", "multiple", "essay"}:
            add_issue(issues, question, "error", "invalid_type", str(qtype))
        if question.get("difficulty") not in {1, 2, 3}:
            add_issue(issues, question, "error", "invalid_difficulty", str(question.get("difficulty")))

        if qtype in {"single", "multiple"}:
            audit_choice_question(issues, question, options, correct_answers, answer)
        else:
            if options:
                add_issue(issues, question, "warn", "essay_has_options", f"options={len(options)}")
            if correct_answers:
                add_issue(issues, question, "warn", "essay_has_correctAnswers", repr(correct_answers))

        audit_stem_contamination(issues, question, stem, qtype)
        audit_ocr_artifacts(issues, question, all_text)
        audit_images(issues, question)

        if len(answer) < 12 and (qtype == "essay" or not extract_answer_letters(answer)):
            add_issue(issues, question, "warn", "answer_too_short", f"len={len(answer)}")

        for option in options if isinstance(options, list) else []:
            if not isinstance(option, dict):
                continue
            text = str(option.get("text", ""))
            if re.search(
                rf"(?:{CORRECT_ANSWER}|{REFERENCE_ANSWER}|{ANALYSIS}|{THEREFORE_CHOOSE}|{SO_CHOOSE}|{SHOULD_CHOOSE}\s*[A-E]|{NOT_CHOOSE}|{OPTION}(?:{RIGHT}|{WRONG}))",
                text,
            ):
                add_issue(
                    issues,
                    question,
                    "warn",
                    "option_text_contains_answer_language",
                    f"{option.get('key')}: {clean_preview(text, 160)}",
                )
            if len(text) > 420:
                add_issue(issues, question, "warn", "option_text_very_long", f"{option.get('key')}: len={len(text)}")

    catalog_path = QUESTION_ROOT / "catalog.json"
    if catalog_path.exists():
        try:
            catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
            catalog_ids = [item.get("id") for item in catalog if isinstance(item, dict)]
            question_ids = {question.get("id") for question in questions}
            catalog_id_set = set(catalog_ids)
            for missing_id in sorted(question_ids - catalog_id_set):
                issues.append(
                    Issue(
                        severity="error",
                        code="catalog_missing_question",
                        question_id=str(missing_id),
                        file="public/questions/construction/catalog.json",
                        index=-1,
                        question_type="",
                        module="",
                        detail="question id not present in catalog",
                        question_preview="",
                    )
                )
            for extra_id in sorted(catalog_id_set - question_ids):
                issues.append(
                    Issue(
                        severity="error",
                        code="catalog_extra_question",
                        question_id=str(extra_id),
                        file="public/questions/construction/catalog.json",
                        index=-1,
                        question_type="",
                        module="",
                        detail="catalog id has no backing JSON question",
                        question_preview="",
                    )
                )
            catalog_duplicates = [qid for qid, count in Counter(catalog_ids).items() if count > 1]
            for duplicate_id in catalog_duplicates:
                issues.append(
                    Issue(
                        severity="error",
                        code="catalog_duplicate_id",
                        question_id=str(duplicate_id),
                        file="public/questions/construction/catalog.json",
                        index=-1,
                        question_type="",
                        module="",
                        detail="duplicate id in catalog",
                        question_preview="",
                    )
                )
        except Exception as exc:  # pragma: no cover - diagnostic script
            issues.append(
                Issue(
                    severity="error",
                    code="catalog_parse_error",
                    question_id="",
                    file="public/questions/construction/catalog.json",
                    index=-1,
                    question_type="",
                    module="",
                    detail=repr(exc),
                    question_preview="",
                )
            )
    else:
        issues.append(
            Issue(
                severity="error",
                code="catalog_missing",
                question_id="",
                file="public/questions/construction/catalog.json",
                index=-1,
                question_type="",
                module="",
                detail="catalog.json missing",
                question_preview="",
            )
        )

    for error in file_errors:
        issues.append(
            Issue(
                severity="error",
                code="json_file_error",
                question_id="",
                file="",
                index=-1,
                question_type="",
                module="",
                detail=error,
                question_preview="",
            )
        )

    return issues


def audit_choice_question(
    issues: list[Issue],
    question: dict[str, Any],
    options: Any,
    correct_answers: Any,
    answer: str,
) -> None:
    qtype = question.get("type")

    if not isinstance(options, list) or len(options) < 2:
        add_issue(
            issues,
            question,
            "error",
            "choice_missing_options",
            f"options={len(options) if isinstance(options, list) else 'not_list'}",
        )
        options = []

    option_keys: list[Any] = []
    for option in options:
        if not isinstance(option, dict):
            add_issue(issues, question, "error", "option_not_object", repr(option)[:80])
            continue
        option_keys.append(option.get("key"))
        if not isinstance(option.get("text"), str) or not option.get("text", "").strip():
            add_issue(issues, question, "error", "empty_option_text", str(option.get("key")))

    if len(option_keys) != len(set(option_keys)):
        add_issue(issues, question, "error", "duplicate_option_key", repr(option_keys))

    if not isinstance(correct_answers, list) or len(correct_answers) == 0:
        add_issue(issues, question, "error", "choice_missing_correctAnswers", repr(correct_answers))
        correct_answers = []

    allowed = {key for key in option_keys if isinstance(key, str)}
    bad_answers = [answer_key for answer_key in correct_answers if answer_key not in allowed]
    if bad_answers:
        add_issue(
            issues,
            question,
            "error",
            "correct_answer_not_in_options",
            f"bad={bad_answers}, options={option_keys}",
        )

    if qtype == "single" and len(correct_answers) != 1:
        add_issue(issues, question, "error", "single_answer_count", repr(correct_answers))
    if qtype == "multiple" and len(correct_answers) < 2:
        add_issue(issues, question, "warn", "multiple_answer_count_lt2", repr(correct_answers))

    markdown_letters = extract_answer_letters(answer)
    if not markdown_letters:
        add_issue(issues, question, "error", "answer_markdown_missing_key", clean_preview(answer, 160))
    elif sorted(markdown_letters) != sorted(correct_answers):
        add_issue(
            issues,
            question,
            "error",
            "answer_key_mismatch",
            f"markdown={markdown_letters}, correctAnswers={correct_answers}",
        )


def audit_stem_contamination(
    issues: list[Issue],
    question: dict[str, Any],
    stem: str,
    qtype: Any,
) -> None:
    patterns: list[tuple[str, str, str]] = [
        (
            "stem_has_answer_heading",
            rf"##\s*(?:{CORRECT_ANSWER}|{REFERENCE_ANSWER}|{ANALYSIS})|(?:{CORRECT_ANSWER}|{REFERENCE_ANSWER})\s*[:\uff1a]",
            "error",
        ),
        ("stem_has_analysis_marker", rf"(?:^|\n)\s*(?:{ANALYSIS}|{ANSWER_ANALYSIS})\s*[:\uff1a]", "warn"),
        (
            "stem_starts_with_option_analysis",
            rf"^\s*[A-E]\s*{OPTION}(?:{RIGHT}|{WRONG}|{MATCH}|{NOT_MATCH})",
            "error",
        ),
        (
            "stem_contains_option_analysis",
            rf"[A-E]\s*{OPTION}(?:{RIGHT}|{WRONG}|{MATCH}|{NOT_MATCH})",
            "warn",
        ),
        ("stem_has_answer_language", rf"{THEREFORE_CHOOSE}|{SO_CHOOSE}|{SHOULD_CHOOSE}\s*[A-E]|{NOT_CHOOSE}", "warn"),
    ]

    if qtype != "essay":
        patterns.append(
            (
                "stem_has_previous_number_spill",
                r"\n\s*\d{1,3}\s*[.\u3001\uff0e]\s*[^\n]{0,80}(?:\(|\uff08\s*\)|\uff08\s*\uff09)",
                "warn",
            )
        )

    for code, pattern, severity in patterns:
        match = re.search(pattern, stem)
        if match:
            add_issue(issues, question, severity, code, clean_preview(match.group(0), 160))

    if qtype in {"single", "multiple"} and len(stem) > 900:
        add_issue(issues, question, "warn", "choice_stem_very_long", f"len={len(stem)}")
    if qtype == "essay" and len(stem) < 40:
        add_issue(issues, question, "warn", "essay_stem_too_short", f"len={len(stem)}")


def audit_ocr_artifacts(issues: list[Issue], question: dict[str, Any], text: str) -> None:
    if "\ufffd" in text or "\u951f" in text:
        add_issue(issues, question, "warn", "replacement_or_mojibake_char", "replacement/mojibake character")
    if STEEL_PILE_WRONG in text or PILE_WRONG in text:
        add_issue(issues, question, "warn", "known_ocr_pile", "possible pile OCR typo")
    if re.search(r"K\d+\+[0-9OoQIlSZs]{2,}[A-Za-z](?![A-Za-z])", text):
        add_issue(issues, question, "warn", "suspicious_mileage_ocr", "mileage suffix contains a letter")
    if any(word in text for word in WATERMARK_WORDS):
        add_issue(issues, question, "warn", "watermark_residue", "watermark keyword remains")
    if re.search(r"[Xx]{3,}|_{4,}", text) or "\u2026\u2026\u2026" in text:
        add_issue(issues, question, "warn", "placeholder_xxx", "placeholder-like text")
    if "??" in text:
        add_issue(issues, question, "warn", "many_ascii_question_marks", "consecutive question marks")


def audit_images(issues: list[Issue], question: dict[str, Any]) -> None:
    images = question.get("questionImages") or []
    if not isinstance(images, list):
        add_issue(issues, question, "error", "questionImages_not_list", repr(images)[:120])
        return

    for image in images:
        relative = str(image).lstrip("/")
        if not (PUBLIC_ROOT / relative).exists():
            add_issue(issues, question, "error", "missing_question_image_file", str(image))


def write_reports(questions: list[dict[str, Any]], issues: list[Issue]) -> None:
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    issue_dicts = [asdict(issue) for issue in issues]
    summary = {
        "question_count": len(questions),
        "issue_count": len(issues),
        "issues_by_severity": dict(Counter(issue.severity for issue in issues)),
        "issues_by_code": dict(Counter(issue.code for issue in issues)),
    }

    (REPORT_ROOT / "construction_bank_audit.json").write_text(
        json.dumps({"summary": summary, "issues": issue_dicts}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    high_risk = [issue for issue in issues if issue.severity == "error"]
    warnings = [issue for issue in issues if issue.severity == "warn"]
    lines = [
        "# Construction Bank JSON Audit",
        "",
        f"- Questions scanned: {len(questions)}",
        f"- Issues found: {len(issues)}",
        f"- Errors: {len(high_risk)}",
        f"- Warnings: {len(warnings)}",
        "",
        "## Issue Codes",
        "",
    ]
    for code, count in Counter(issue.code for issue in issues).most_common():
        lines.append(f"- `{code}`: {count}")

    lines.extend(["", "## High Risk Samples", ""])
    for issue in high_risk[:80]:
        lines.append(f"- `{issue.question_id}` `{issue.code}` {issue.detail}")
        lines.append(f"  File: `{issue.file}`")
        lines.append(f"  Preview: {issue.question_preview}")

    lines.extend(["", "## Warning Samples", ""])
    for issue in warnings[:80]:
        lines.append(f"- `{issue.question_id}` `{issue.code}` {issue.detail}")
        lines.append(f"  File: `{issue.file}`")
        lines.append(f"  Preview: {issue.question_preview}")

    (REPORT_ROOT / "construction_bank_audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args()

    questions, file_errors = load_questions()
    issues = audit_questions(questions, file_errors)
    write_reports(questions, issues)

    by_severity = Counter(issue.severity for issue in issues)
    by_code = Counter(issue.code for issue in issues)
    print(f"questions={len(questions)}")
    print(f"issues={len(issues)}")
    print(f"errors={by_severity.get('error', 0)}")
    print(f"warnings={by_severity.get('warn', 0)}")
    print("top_codes=" + ",".join(f"{code}:{count}" for code, count in by_code.most_common(10)))
    print("report_json=reports/construction_bank_audit.json")
    print("report_md=reports/construction_bank_audit.md")

    if args.fail_on_error and by_severity.get("error", 0) > 0:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

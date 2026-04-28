#!/usr/bin/env python3
"""
Conservatively repair generated construction question JSON.

This script intentionally works on the existing JSON only. It does not rebuild
from PDF. Repairs are limited to high-confidence parser/OCR artifacts:

- previous/next question spillover in stems or answers,
- duplicate option keys caused by parser over-capture,
- blank image-option labels when an image is present,
- answer/type mismatches that can be inferred from the current explanation,
- known hard cases reviewed by the model in this cleanup pass.
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
ASSET_ROOT = ROOT / "public" / "question-assets"
REPORT_ROOT = ROOT / "reports"

CORRECT_ANSWER = "\u6b63\u786e\u7b54\u6848"
REFERENCE_ANSWER = "\u53c2\u8003\u7b54\u6848"
ANALYSIS = "\u89e3\u6790"
OPTION = "\u9009\u9879"
RIGHT = "\u6b63\u786e"
WRONG = "\u9519\u8bef"
MATCH = "\u7b26\u5408"
SHOULD = "\u5e94\u9009"
SO = "\u6545\u9009"
THEREFORE = "\u56e0\u6b64\u9009"
SEE_FIGURE_OPTION = "\u89c1\u9898\u56fe\u9009\u9879"

QUESTION_BLANK_RE = r"(?:\(\s*\)|\uff08\s*\uff09)"
ANSWER_HEADING_RE = re.compile(
    rf"(##\s*(?:{CORRECT_ANSWER}|{REFERENCE_ANSWER})\s*\n)([^\n]*)",
)

# Cases below were reviewed from the flagged high-risk list. They are used only
# where structural repair alone cannot safely infer the current question answer.
MANUAL_ANSWER_OVERRIDES: dict[str, tuple[str, list[str], str]] = {
    "highway-chapters-2-3-71c0d7e9-q017": (
        "multiple",
        ["B", "C", "D", "E"],
        "stem asks for several backing-rod properties and answer contains BCDE",
    ),
    "highway-mock-exams-2026-4cbdee82-q011": (
        "single",
        ["A"],
        "current stem asks for the core party in the highway contract system; duplicate options/answer belonged to the next safety question",
    ),
    "management-mock-exams-2026-05eabdb4-q009": (
        "single",
        ["B"],
        "analysis states the long-term guiding quality-system document is the quality manual",
    ),
    "management-mock-exams-2026-2daf0bc6-q037": (
        "single",
        ["D"],
        "delay affecting total duration by 3 days with total float 7 days means actual delay is 10 days",
    ),
    "management-past-exams-2025-5-11-4b92100c-q070": (
        "multiple",
        ["D", "E"],
        "analysis identifies cost control rate, cost variance and profit rate as financial performance metrics",
    ),
    "regulations-chapters-1-1-378820fc-q026": (
        "single",
        ["B"],
        "only the department-rule/local-government-rule equal-effectiveness statement is correct",
    ),
    "regulations-chapters-1-3-81546d61-q028": (
        "single",
        ["D"],
        "stem asks for the incorrect copyright protection-period statement; analysis marks D as incorrect",
    ),
    "regulations-chapters-1-7-9fb4e13f-q011": (
        "single",
        ["C"],
        "current options ask for an additional punishment; confiscation of property is the matching option",
    ),
    "regulations-chapters-2-3-9451d216-q044": (
        "single",
        ["C"],
        "analysis says changing employer requires change registration",
    ),
    "regulations-chapters-8-2-7f0e443b-q013": (
        "single",
        ["D"],
        "only changing natural states can be handled through protection plans/approval in the current option set",
    ),
    "regulations-mock-exams-2026-49448b2d-q060": (
        "single",
        ["A"],
        "complaint deadline is 10 days; B/C/D belonged to the next criminal-punishment question",
    ),
    "regulations-mock-exams-2026-c2287877-q031": (
        "single",
        ["C"],
        "stem asks which item is not a major construction IP right; claim right is not IP",
    ),
}

REMOVE_QUESTION_IDS = {
    # These entries are parser fragments or image-choice questions without a
    # recoverable image/options payload in the current JSON/assets.
    "highway-chapters-14-2-6122847a-q005",
    "highway-chapters-7-2-ee50e8ca-q014",
    "management-mock-exams-2026-16dbe10e-q038",
    "regulations-chapters-7-1-0c4f34a3-q038",
}

MANUAL_STEM_MARKER_TRIM_IDS = {
    "management-chapters-4-1-523c83d1-q059",
    "management-chapters-4-1-523c83d1-q062",
    "management-mock-exams-2026-05eabdb4-q014",
    "management-mock-exams-2026-05eabdb4-q017",
    "management-past-exams-2025-5-10-bfd83d29-q066",
    "regulations-chapters-1-2-659104c2-q099",
    "regulations-mock-exams-2026-e1b952e8-q026",
    "regulations-mock-exams-2026-e1b952e8-q075",
    "regulations-mock-exams-2026-e4ab4cd2-q064",
}

MANUAL_OPTION_TEXT_OVERRIDES: dict[str, dict[str, str]] = {
    "management-past-exams-2025-5-10-bfd83d29-q041": {
        "D": "\u51c6\u5907\u4e0e\u7ed3\u675f\u5de5\u4f5c\u65f6\u95f4",
    },
}


@dataclass
class Repair:
    code: str
    question_id: str
    file: str
    detail: str


def qnum_from_id(question_id: str) -> int | None:
    match = re.search(r"-q(\d+)$", question_id)
    return int(match.group(1)) if match else None


def clean_space(text: str) -> str:
    lines = [line.rstrip() for line in str(text or "").replace("\r\n", "\n").split("\n")]
    return "\n".join(lines).strip()


def option_keys(options: Any) -> list[str]:
    if not isinstance(options, list):
        return []
    return [str(option.get("key")) for option in options if isinstance(option, dict)]


def answer_letters_from_heading(answer: str) -> list[str]:
    match = ANSWER_HEADING_RE.search(answer)
    if not match:
        return []
    return re.findall(r"[A-E]", match.group(2))


def normalize_letters(raw: str) -> list[str]:
    return sorted(set(re.findall(r"[A-E]", raw)), key="ABCDE".index)


def replace_answer_heading(answer: str, letters: list[str]) -> str:
    value = "".join(letters)
    if ANSWER_HEADING_RE.search(answer):
        return ANSWER_HEADING_RE.sub(rf"\g<1>{value}", answer, count=1)
    return f"## {CORRECT_ANSWER}\n{value}\n\n## {ANALYSIS}\n{answer.strip()}"


def infer_letters_from_answer(answer: str, allowed: set[str]) -> list[str]:
    """Infer current answer letters from explanation text when it is explicit."""
    candidates: list[list[str]] = []
    text = answer.replace(" ", "")

    direct_patterns = [
        r"(?:\u6b63\u786e\u9009\u9879\u4e3a|\u6b63\u786e\u7b54\u6848\u4e3a|\u7b54\u6848\u4e3a|\u7b54\u6848\u662f)([A-E\u3001\uff0c,]{1,9})",
        rf"(?:{SO}|{THEREFORE}|{SHOULD})(?:\u9879)?([A-E\u3001\uff0c,]{{1,9}})",
        r"(?:\u672c\u9898\u5e94\u9009|\u672c\u9898\u9009|\u7efc\u4e0a[^\n\uff0c\u3002\uff1b]{{0,20}}\u9009)([A-E\u3001\uff0c,]{1,9})",
    ]

    for pattern in direct_patterns:
        for match in re.finditer(pattern, text):
            letters = normalize_letters(match.group(1))
            if letters and all(letter in allowed for letter in letters):
                candidates.append(letters)

    if candidates:
        # Prefer the last explicit "therefore/answer" style conclusion. If no
        # conclusion exists, repeated "X option correct" usually agrees.
        return candidates[-1]

    return []


def stem_asks_multiple(stem: str) -> bool:
    compact = stem.replace(" ", "")
    return bool(
        re.search(
            r"(\u6b63\u786e\u7684\u6709|\u9519\u8bef\u7684\u6709|\u4e0d\u6b63\u786e\u7684\u6709|\u4e0b\u5217.*\u6709|"
            r"\u5305\u62ec|\u5c5e\u4e8e.*\u7684\u6709|\u54ea\u4e9b|\u5404\u9879)",
            compact,
        )
    )


def trim_stem_spill(question: dict[str, Any], file: str, repairs: list[Repair]) -> None:
    qid = str(question.get("id", ""))
    qnum = qnum_from_id(qid)
    if qnum is None:
        return

    stem = str(question.get("question", ""))
    pattern = re.compile(rf"(?m)(?:^|\n)\s*0*{qnum}\s*[\.\u3001\uff0e]\s*")
    matches = list(pattern.finditer(stem))
    if not matches:
        return

    match = matches[-1]
    prefix = stem[: match.start()]
    if match.start() == 0:
        return
    if len(prefix) < 20 and not re.search(rf"{OPTION}(?:{RIGHT}|{WRONG})|{SO}|{SHOULD}", prefix):
        return

    new_stem = clean_space(stem[match.end() :])
    if new_stem and new_stem != stem:
        question["question"] = new_stem
        repairs.append(Repair("trim_stem_spill", qid, file, f"trimmed prefix before question {qnum}"))


def manual_trim_stem_to_question_marker(
    question: dict[str, Any],
    file: str,
    repairs: list[Repair],
) -> None:
    qid = str(question.get("id", ""))
    if qid not in MANUAL_STEM_MARKER_TRIM_IDS:
        return

    stem = str(question.get("question", ""))
    pattern = re.compile(
        rf"(?m)(?:^|\n)\s*\d{{1,3}}\s*[\.\u3001\uff0e]\s*[^\n]{{0,180}}{QUESTION_BLANK_RE}"
    )
    matches = list(pattern.finditer(stem))
    if not matches:
        return

    match = matches[-1]
    marker_end = re.match(r"(?:\n)?\s*\d{1,3}\s*[\.\u3001\uff0e]\s*", stem[match.start() :])
    if not marker_end:
        return

    start = match.start() + marker_end.end()
    new_stem = clean_space(stem[start:])
    if new_stem and new_stem != stem:
        question["question"] = new_stem
        repairs.append(Repair("manual_trim_stem_marker", qid, file, "trimmed reviewed previous-answer fragment"))


def trim_answer_spill(question: dict[str, Any], file: str, repairs: list[Repair]) -> None:
    qid = str(question.get("id", ""))
    qnum = qnum_from_id(qid)
    if qnum is None:
        return

    answer = str(question.get("answer", ""))
    next_num = qnum + 1
    pattern = re.compile(
        rf"(?m)\n\s*0*{next_num}\s*[\.\u3001\uff0e]\s*[^\n]{{0,160}}{QUESTION_BLANK_RE}"
    )
    match = pattern.search(answer)
    if not match:
        return

    new_answer = clean_space(answer[: match.start()])
    if new_answer and new_answer != answer:
        question["answer"] = new_answer
        repairs.append(Repair("trim_answer_spill", qid, file, f"trimmed answer before question {next_num}"))


def asset_paths_for_question(file: str, qid: str) -> list[str]:
    qnum = qnum_from_id(qid)
    if qnum is None:
        return []
    stem = Path(file).with_suffix("")
    asset_dir = ASSET_ROOT / stem
    if not asset_dir.exists():
        return []
    prefix = f"q{qnum:03d}-"
    return [
        "/" + str(path.relative_to(ROOT / "public")).replace("\\", "/")
        for path in sorted(asset_dir.glob(f"{prefix}*.webp"))
    ]


def dedupe_and_fill_options(question: dict[str, Any], file: str, repairs: list[Repair]) -> None:
    qid = str(question.get("id", ""))
    options = question.get("options")
    if not isinstance(options, list):
        return

    seen: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    duplicates = 0
    for option in options:
        if not isinstance(option, dict):
            continue
        key = str(option.get("key", "")).strip()
        text = str(option.get("text", "")).strip()
        if not key:
            continue
        normalized = {"key": key, "text": text}
        if key not in seen:
            seen[key] = normalized
            order.append(key)
            continue
        duplicates += 1
        if not seen[key].get("text") and text:
            seen[key] = normalized

    new_options = [seen[key] for key in order]
    if duplicates:
        question["options"] = new_options
        repairs.append(
            Repair("dedupe_options", qid, file, f"removed {duplicates} duplicate option entries")
        )

    if not new_options:
        return

    blank_keys = [option["key"] for option in new_options if not str(option.get("text", "")).strip()]
    if not blank_keys:
        return

    images = question.get("questionImages")
    if not isinstance(images, list) or not images:
        images = asset_paths_for_question(file, qid)
        if images:
            question["questionImages"] = images

    if images:
        for option in new_options:
            if not str(option.get("text", "")).strip():
                option["text"] = f"{SEE_FIGURE_OPTION}{option['key']}"
        question["options"] = new_options
        repairs.append(
            Repair("fill_blank_image_options", qid, file, f"filled blank labels for {blank_keys}")
        )


def apply_manual_option_text_overrides(
    question: dict[str, Any],
    file: str,
    repairs: list[Repair],
) -> None:
    qid = str(question.get("id", ""))
    overrides = MANUAL_OPTION_TEXT_OVERRIDES.get(qid)
    options = question.get("options")
    if not overrides or not isinstance(options, list):
        return

    changed: list[str] = []
    for option in options:
        if not isinstance(option, dict):
            continue
        key = str(option.get("key", ""))
        if key in overrides and option.get("text") != overrides[key]:
            option["text"] = overrides[key]
            changed.append(key)

    if changed:
        repairs.append(Repair("manual_option_text_override", qid, file, ",".join(changed)))


def repair_answer_and_type(
    question: dict[str, Any],
    file: str,
    repairs: list[Repair],
    allow_inference: bool,
) -> None:
    qid = str(question.get("id", ""))
    qtype = str(question.get("type", ""))
    options = question.get("options")
    allowed = set(option_keys(options))
    if not allowed:
        return

    override = MANUAL_ANSWER_OVERRIDES.get(qid)
    if override:
        new_type, letters, reason = override
        old_type = question.get("type")
        old_answers = question.get("correctAnswers") or []
        old_answer = str(question.get("answer", ""))
        new_answer = replace_answer_heading(old_answer, letters)
        question["type"] = new_type
        question["correctAnswers"] = letters
        question["answer"] = new_answer
        if old_type != new_type or sorted(old_answers) != sorted(letters) or old_answer != new_answer:
            repairs.append(Repair("manual_answer_override", qid, file, reason))
        return

    answer = str(question.get("answer", ""))
    heading_letters = answer_letters_from_heading(answer)
    inferred = infer_letters_from_answer(answer, allowed) if allow_inference and qtype == "single" else []

    if inferred and sorted(inferred) != sorted(heading_letters):
        question["correctAnswers"] = inferred
        question["answer"] = replace_answer_heading(answer, inferred)
        repairs.append(
            Repair(
                "inferred_answer_from_analysis",
                qid,
                file,
                f"{heading_letters or question.get('correctAnswers')} -> {inferred}",
            )
        )
    elif heading_letters and sorted(heading_letters) != sorted(question.get("correctAnswers") or []):
        question["correctAnswers"] = heading_letters
        repairs.append(
            Repair("sync_correct_answers", qid, file, f"synced to answer heading {heading_letters}")
        )

    letters = question.get("correctAnswers") or []
    if qtype == "single" and isinstance(letters, list) and len(letters) > 1:
        if stem_asks_multiple(str(question.get("question", ""))):
            question["type"] = "multiple"
            repairs.append(Repair("single_to_multiple", qid, file, f"answers={letters}"))


def normalize_known_ocr_text(question: dict[str, Any], file: str, repairs: list[Repair]) -> None:
    qid = str(question.get("id", ""))
    changed_fields: list[str] = []
    replacements = {
        "\u94a2\u677f\u7ca7": "\u94a2\u677f\u6869",  # steel sheet pile
        "\u677f\u7ca7": "\u677f\u6869",
        "K6+09S": "K6+095",
        "K6+09s": "K6+095",
    }

    def fix_text(value: Any) -> Any:
        if not isinstance(value, str):
            return value
        new_value = value
        for old, new in replacements.items():
            new_value = new_value.replace(old, new)
        return new_value

    for field in ["question", "answer", "module", "source"]:
        old = question.get(field)
        new = fix_text(old)
        if new != old:
            question[field] = new
            changed_fields.append(field)

    options = question.get("options")
    if isinstance(options, list):
        for option in options:
            if not isinstance(option, dict):
                continue
            old = option.get("text")
            new = fix_text(old)
            if new != old:
                option["text"] = new
                changed_fields.append("options")

    if changed_fields:
        repairs.append(Repair("known_ocr_normalization", qid, file, ",".join(sorted(set(changed_fields)))))


def load_question_files() -> list[tuple[Path, list[dict[str, Any]]]]:
    files: list[tuple[Path, list[dict[str, Any]]]] = []
    for path in sorted(QUESTION_ROOT.rglob("*.json")):
        if path.name == "catalog.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            files.append((path, payload))
    return files


def rebuild_catalog(files: list[tuple[Path, list[dict[str, Any]]]]) -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []
    seen: set[str] = set()
    for path, questions in files:
        file = str(path.relative_to(QUESTION_ROOT)).replace("\\", "/")
        for question in questions:
            qid = str(question.get("id", ""))
            if not qid or qid in seen:
                continue
            seen.add(qid)
            entry = {
                "id": qid,
                "module": question.get("module", ""),
                "difficulty": question.get("difficulty", 1),
                "type": question.get("type", "essay"),
                "question": question.get("question", ""),
                "tags": question.get("tags", []),
                "file": f"construction/{file}",
            }
            if isinstance(question.get("source"), str):
                entry["source"] = question["source"]
            catalog.append(entry)
    return catalog


def write_json(path: Path, payload: Any, dry_run: bool) -> None:
    if dry_run:
        return
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def repair(dry_run: bool) -> list[Repair]:
    files = load_question_files()
    repairs: list[Repair] = []

    for path, questions in files:
        rel_file = str(path.relative_to(QUESTION_ROOT)).replace("\\", "/")
        kept: list[dict[str, Any]] = []
        for question in questions:
            qid = str(question.get("id", ""))
            if qid in REMOVE_QUESTION_IDS:
                repairs.append(Repair("remove_unrecoverable_question", qid, rel_file, "missing reliable options/images/answer"))
                continue

            before_structural = len(repairs)
            trim_stem_spill(question, rel_file, repairs)
            manual_trim_stem_to_question_marker(question, rel_file, repairs)
            trim_answer_spill(question, rel_file, repairs)
            dedupe_and_fill_options(question, rel_file, repairs)
            apply_manual_option_text_overrides(question, rel_file, repairs)
            allow_inference = any(
                repair.question_id == qid
                and repair.code in {"trim_answer_spill", "dedupe_options", "trim_stem_spill"}
                for repair in repairs[before_structural:]
            )
            normalize_known_ocr_text(question, rel_file, repairs)
            repair_answer_and_type(question, rel_file, repairs, allow_inference=allow_inference)
            kept.append(question)

        if len(kept) != len(questions):
            questions[:] = kept
        write_json(path, questions, dry_run)

    catalog = rebuild_catalog(files)
    write_json(QUESTION_ROOT / "catalog.json", catalog, dry_run)
    if not dry_run:
        REPORT_ROOT.mkdir(parents=True, exist_ok=True)
        report = {
            "summary": {
                "repair_count": len(repairs),
                "repairs_by_code": dict(Counter(repair.code for repair in repairs)),
            },
            "repairs": [asdict(repair) for repair in repairs],
        }
        (REPORT_ROOT / "construction_bank_repairs.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return repairs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repairs = repair(args.dry_run)
    by_code = Counter(repair.code for repair in repairs)
    print(f"dry_run={args.dry_run}")
    print(f"repairs={len(repairs)}")
    print("by_code=" + ",".join(f"{code}:{count}" for code, count in by_code.most_common()))
    if not args.dry_run:
        print("report_json=reports/construction_bank_repairs.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

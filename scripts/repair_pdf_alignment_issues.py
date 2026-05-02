#!/usr/bin/env python3
"""Repair the remaining reviewed PDF-alignment issues in the JSON bank.

This is not a general PDF parser. It is a targeted acceptance-repair pass for
the current construction question bank after `audit_pdf_alignment.py` has found
source-backed issues.
"""

from __future__ import annotations

import argparse
import io
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import fitz
from PIL import Image

from audit_pdf_alignment import (
    find_next_source_question_start,
    find_source_question_start,
    pdf_for_question_file,
    question_start_match,
    source_answer_letters,
    span_text,
    strip_source_noise,
)
from repair_construction_json import rebuild_catalog


ROOT = Path(__file__).resolve().parent.parent
QUESTION_ROOT = ROOT / "public" / "questions" / "construction"
ASSET_ROOT = ROOT / "public" / "question-assets" / "construction"
REPORT_ROOT = ROOT / "reports"

CORRECT_ANSWER = "\u6b63\u786e\u7b54\u6848"
ANALYSIS = "\u89e3\u6790"
SOURCE_HAS_NO_ANALYSIS = "\u539f PDF \u672a\u63d0\u4f9b\u89e3\u6790\u3002"

OPTION_RE = re.compile(r"^([A-E])\s*[\.\uff0e]\s*(.*)$")
ANSWER_MARKER_RE = re.compile(r"^(?:\u53c2\u8003\u7b54\u6848|\u7b54\u6848)\s*[:\uff1a]")
ANALYSIS_MARKER_RE = re.compile(r"^\u3010\u89e3\u6790\u3011\s*(.*)$")


ALIGN_FROM_PDF_IDS = {
    "highway-mock-exams-2026-a404f460-q009",
    "highway-mock-exams-2026-dbc526e1-q013",
    "management-chapters-2-1-e3d9a3f4-q077",
    "management-mock-exams-2026-04220a54-q079",
    "management-mock-exams-2026-64250141-q058",
    "management-mock-exams-2026-a22093c8-q028",
    "management-mock-exams-2026-ab45bab0-q001",
    "management-mock-exams-2026-ca9a7408-q076",
    "regulations-chapters-1-2-659104c2-q058",
    "regulations-chapters-1-7-9fb4e13f-q002",
    "regulations-chapters-1-7-9fb4e13f-q008",
    "regulations-chapters-1-7-9fb4e13f-q011",
    "regulations-chapters-2-3-9451d216-q035",
    "regulations-chapters-2-3-9451d216-q072",
    "regulations-chapters-2-3-9451d216-q077",
    "regulations-chapters-3-2-b940a622-q020",
    "regulations-chapters-3-2-b940a622-q029",
    "regulations-chapters-3-2-b940a622-q039",
    "regulations-chapters-3-2-b940a622-q046",
    "regulations-chapters-3-2-b940a622-q048",
    "regulations-chapters-5-1-3ddc32f2-q044",
    "regulations-chapters-5-2-761873d5-q020",
    "regulations-chapters-8-2-7f0e443b-q013",
    "regulations-mock-exams-2026-176d33ce-q045",
    "regulations-mock-exams-2026-49448b2d-q060",
    "regulations-mock-exams-2026-6b13bdaf-q006",
    "regulations-mock-exams-2026-6b13bdaf-q071",
    "regulations-mock-exams-2026-c2287877-q010",
    "regulations-mock-exams-2026-c2287877-q031",
    "regulations-mock-exams-2026-e1b952e8-q021",
    "regulations-mock-exams-2026-e1b952e8-q036",
    "regulations-mock-exams-2026-e2256abb-q004",
    "regulations-mock-exams-2026-e4ab4cd2-q043",
}

MANUAL_OVERRIDES: dict[str, dict[str, Any]] = {
    "highway-mock-exams-2026-4cbdee82-q011": {
        "type": "single",
        "correctAnswers": ["A"],
        "answer": (
            f"## {CORRECT_ANSWER}\nA\n\n"
            f"## {ANALYSIS}\n"
            "\u516c\u8def\u5de5\u7a0b\u5408\u540c\u4f53\u7cfb\u4e2d\uff0c"
            "\u4e1a\u4e3b\u65b9\u5904\u4e8e\u201c\u6838\u5fc3\u4f4d\u7f6e\u201d\u3002"
        ),
    },
    "management-chapters-2-1-e3d9a3f4-q077": {
        "answer": (
            f"## {CORRECT_ANSWER}\nACDE\n\n"
            f"## {ANALYSIS}\n"
            "\u8bc4\u6807\u62a5\u544a\u5e94\u5982\u5b9e\u8bb0\u8f7d\u4ee5\u4e0b\u5185\u5bb9\uff1a\n"
            "A.\u57fa\u672c\u60c5\u51b5\u548c\u6570\u636e\u8868\uff1b\n"
            "B.\u8bc4\u6807\u59d4\u5458\u4f1a\u6210\u5458\u540d\u5355\uff1b\n"
            "C.\u5f00\u6807\u8bb0\u5f55\uff1b\n"
            "D.\u7b26\u5408\u8981\u6c42\u7684\u6295\u6807\u4e00\u89c8\u8868\uff1b\n"
            "E.\u5426\u51b3\u6295\u6807\u7684\u60c5\u51b5\u8bf4\u660e\uff1b\n"
            "F.\u8bc4\u6807\u6807\u51c6\u3001\u8bc4\u6807\u65b9\u6cd5\u6216\u8005\u8bc4\u6807\u56e0\u7d20\u4e00\u89c8\u8868\uff1b\n"
            "G.\u7ecf\u8bc4\u5ba1\u7684\u4ef7\u683c\u6216\u8005\u8bc4\u5206\u6bd4\u8f83\u4e00\u89c8\u8868\uff1b\n"
            "H.\u7ecf\u8bc4\u5ba1\u7684\u6295\u6807\u4eba\u6392\u5e8f\uff1b\n"
            "I.\u63a8\u8350\u7684\u4e2d\u6807\u5019\u9009\u4eba\u540d\u5355\u4e0e\u7b7e\u8ba2\u5408\u540c\u524d\u8981\u5904\u7406\u7684\u4e8b\u5b9c\uff1b\n"
            "J.\u6f84\u6e05\u3001\u8bf4\u660e\u3001\u8865\u6b63\u4e8b\u9879\u7eaa\u8981\u3002\n"
            "\u9009\u9879B\u4e3a\u5e72\u6270\u9879\uff0c\u4e2d\u6807\u901a\u77e5\u4e66\u4e0d\u5c5e\u4e8e\u8bc4\u6807\u62a5\u544a\u7684\u5185\u5bb9\u3002\n"
            "\u7efc\u4e0a\uff0c\u672c\u9898\u5e94\u9009ACDE\u3002"
        ),
    }
}

EXTRA_IMAGE_SPECS = {
    "highway-mock-exams-2026-a404f460-q033": {
        "subject": "highway",
        "group": "mock-exams",
        "file_slug": "highway-mock-exams-2026-a404f460",
        "page_index": 12,
        "rect": (36.0, 44.2, 106.2, 134.8),
        "file_name": "q033-2.webp",
    },
    "highway-mock-exams-2026-bfe85c22-q031": {
        "subject": "highway",
        "group": "mock-exams",
        "file_slug": "highway-mock-exams-2026-bfe85c22",
        "page_index": 7,
        "rect": (36.0, 629.7, 154.8, 725.1),
        "file_name": "q031-2.webp",
    },
}

ANSWER_IMAGE_SPECS = {
    "highway-mock-exams-2026-a404f460-q009": [
        {
            "subject": "highway",
            "group": "mock-exams",
            "file_slug": "highway-mock-exams-2026-a404f460",
            "page_index": 2,
            "rect": (36.0, 44.2, 390.0, 146.8),
            "file_name": "q009-analysis-1.webp",
        }
    ],
    "highway-mock-exams-2026-dbc526e1-q013": [
        {
            "subject": "highway",
            "group": "mock-exams",
            "file_slug": "highway-mock-exams-2026-dbc526e1",
            "page_index": 3,
            "rect": (36.0, 243.8, 390.0, 390.8),
            "file_name": "q013-analysis-1.webp",
        }
    ],
    "management-mock-exams-2026-ab45bab0-q001": [
        {
            "subject": "management",
            "group": "mock-exams",
            "file_slug": "management-mock-exams-2026-ab45bab0",
            "page_index": 0,
            "rect": (36.0, 230.2, 195.0, 284.8),
            "file_name": "q001-analysis-1.webp",
        }
    ],
    "management-mock-exams-2026-ca9a7408-q076": [
        {
            "subject": "management",
            "group": "mock-exams",
            "file_slug": "management-mock-exams-2026-ca9a7408",
            "page_index": 22,
            "rect": (36.0, 326.2, 390.0, 608.8),
            "file_name": "q076-analysis-1.webp",
        },
        {
            "subject": "management",
            "group": "mock-exams",
            "file_slug": "management-mock-exams-2026-ca9a7408",
            "page_index": 22,
            "rect": (36.0, 683.1, 390.0, 772.5),
            "file_name": "q076-analysis-2.webp",
        },
        {
            "subject": "management",
            "group": "mock-exams",
            "file_slug": "management-mock-exams-2026-ca9a7408",
            "page_index": 23,
            "rect": (36.0, 45.0, 390.0, 308.4),
            "file_name": "q076-analysis-3.webp",
        },
    ],
    "regulations-mock-exams-2026-e1b952e8-q036": [
        {
            "subject": "regulations",
            "group": "mock-exams",
            "file_slug": "regulations-mock-exams-2026-e1b952e8",
            "page_index": 9,
            "rect": (36.0, 509.2, 323.4, 617.2),
            "file_name": "q036-analysis-1.webp",
        }
    ],
}


@dataclass
class Repair:
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


def normalize_blank(text: str) -> str:
    value = text.strip()
    value = value.replace("\uff08\u3000\uff09", "\uff08 \uff09")
    value = value.replace("(\u3000)", "( )")
    return value.rstrip("-").strip()


def source_lines_for_question(path: Path, question: dict[str, Any]) -> tuple[str, list[str]] | None:
    subject, group, file_name = path.relative_to(QUESTION_ROOT).parts
    file_slug = Path(file_name).stem
    pdf_path = pdf_for_question_file(subject, group, file_slug)
    if pdf_path is None:
        return None

    doc = fitz.open(pdf_path)
    lines = []
    try:
        doc_lines = __import__("repair_missing_visual_assets").extract_doc_lines(doc)
        start_index = find_source_question_start(doc_lines, question, min_index=0)
        if start_index is None:
            return None
        start = doc_lines[start_index]
        next_start = find_next_source_question_start(doc_lines, start_index)
        stop_page, stop_y = next_start if next_start is not None else (len(doc) - 1, doc[-1].rect.height)
        raw = span_text(doc_lines, start.page_index, start.y, stop_page, stop_y)
        lines = [normalize_blank(line) for line in strip_source_noise(raw).split("\n") if normalize_blank(line)]
        return str(pdf_path), lines
    finally:
        doc.close()


def parse_choice_payload(raw_lines: list[str]) -> dict[str, Any] | None:
    if not raw_lines:
        return None

    first_match = question_start_match(raw_lines[0])
    if not first_match:
        return None

    stem_lines = [normalize_blank(first_match.group(2))]
    options: list[dict[str, str]] = []
    answer_lines: list[str] = []
    current_option: dict[str, str] | None = None
    in_answer = False
    in_analysis = False

    for line in raw_lines[1:]:
        if ANSWER_MARKER_RE.match(line):
            in_answer = True
            current_option = None
            continue

        analysis_match = ANALYSIS_MARKER_RE.match(line)
        if analysis_match:
            in_answer = True
            in_analysis = True
            current_option = None
            if analysis_match.group(1).strip():
                answer_lines.append(analysis_match.group(1).strip())
            continue

        if in_answer:
            if in_analysis:
                answer_lines.append(line)
            continue

        option_match = OPTION_RE.match(line)
        if option_match:
            if any(option["key"] == option_match.group(1) for option in options):
                in_answer = True
                in_analysis = True
                current_option = None
                answer_lines.append(line)
                continue
            current_option = {"key": option_match.group(1), "text": normalize_blank(option_match.group(2))}
            options.append(current_option)
            continue

        if current_option is not None:
            current_option["text"] = normalize_blank(f"{current_option['text']}{line}")
        else:
            stem_lines.append(line)

    source_text = "\n".join(raw_lines)
    letters = source_answer_letters(source_text)
    if not letters or not options:
        return None

    analysis = "\n".join(answer_lines).strip() or SOURCE_HAS_NO_ANALYSIS
    question_text = normalize_blank("".join(stem_lines))

    return {
        "type": "multiple" if len(letters) > 1 else "single",
        "question": question_text,
        "options": options,
        "correctAnswers": letters,
        "answer": f"## {CORRECT_ANSWER}\n{''.join(letters)}\n\n## {ANALYSIS}\n{analysis}",
    }


def apply_payload(question: dict[str, Any], payload: dict[str, Any]) -> bool:
    changed = False
    for key, value in payload.items():
        if question.get(key) != value:
            question[key] = value
            changed = True
    return changed


def rect_close(left: fitz.Rect, raw: tuple[float, float, float, float], tolerance: float = 2.0) -> bool:
    values = (left.x0, left.y0, left.x1, left.y1)
    return all(abs(a - b) <= tolerance for a, b in zip(values, raw))


def save_pdf_image_by_rect(
    subject: str,
    group: str,
    file_slug: str,
    page_index: int,
    rect_tuple: tuple[float, float, float, float],
    file_name: str,
    dry_run: bool,
) -> str:
    public_path = f"/question-assets/construction/{subject}/{group}/{file_slug}/{file_name}"
    output_path = ASSET_ROOT / subject / group / file_slug / file_name
    if dry_run:
        return public_path
    if output_path.exists():
        return public_path

    pdf_path = pdf_for_question_file(subject, group, file_slug)
    if pdf_path is None:
        raise FileNotFoundError(file_slug)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_index]
        target_rect = fitz.Rect(rect_tuple)
        pix: fitz.Pixmap | None = None
        for image in page.get_images(full=True):
            xref = image[0]
            if any(rect_close(rect, rect_tuple) for rect in page.get_image_rects(xref)):
                pix = fitz.Pixmap(doc, xref)
                break
        if pix is None:
            clip = (target_rect + (-10, -10, 10, 10)) & page.rect
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, alpha=False)

        png = pix.tobytes("png")
        image = Image.open(io.BytesIO(png)).convert("RGB")
        image.save(output_path, format="WEBP", quality=84, method=6)
    finally:
        doc.close()
    return public_path


def attach_extra_images(question: dict[str, Any], dry_run: bool) -> list[str]:
    qid = str(question.get("id", ""))
    spec = EXTRA_IMAGE_SPECS.get(qid)
    if not spec:
        return []

    image_path = save_pdf_image_by_rect(
        subject=spec["subject"],
        group=spec["group"],
        file_slug=spec["file_slug"],
        page_index=spec["page_index"],
        rect_tuple=spec["rect"],
        file_name=spec["file_name"],
        dry_run=dry_run,
    )
    images = list(question.get("questionImages") or [])
    if image_path not in images:
        images.append(image_path)
        if not dry_run:
            question["questionImages"] = images
        return [image_path]
    return []


def attach_answer_images(question: dict[str, Any], dry_run: bool) -> list[str]:
    qid = str(question.get("id", ""))
    specs = ANSWER_IMAGE_SPECS.get(qid)
    if not specs:
        return []

    image_paths: list[str] = []
    for spec in specs:
        image_paths.append(
            save_pdf_image_by_rect(
                subject=spec["subject"],
                group=spec["group"],
                file_slug=spec["file_slug"],
                page_index=spec["page_index"],
                rect_tuple=spec["rect"],
                file_name=spec["file_name"],
                dry_run=dry_run,
            )
        )

    answer = str(question.get("answer", "")).rstrip()
    missing_paths = [path for path in image_paths if path not in answer]
    if not missing_paths:
        return []

    markdown = "\n\n".join(f"![解析图{index}]({path})" for index, path in enumerate(image_paths, start=1))
    if not dry_run:
        question["answer"] = f"{answer}\n\n{markdown}"
    return missing_paths


def repair(dry_run: bool) -> list[Repair]:
    files = load_question_files()
    repairs: list[Repair] = []

    for path, questions in files:
        rel = str(path.relative_to(QUESTION_ROOT)).replace("\\", "/")
        file_changed = False
        for question in questions:
            qid = str(question.get("id", ""))

            if qid in ALIGN_FROM_PDF_IDS:
                source = source_lines_for_question(path, question)
                payload = parse_choice_payload(source[1]) if source else None
                if payload and apply_payload(question, payload):
                    file_changed = True
                    repairs.append(Repair("align_choice_from_pdf", qid, rel, source[0]))
                elif not payload:
                    repairs.append(Repair("align_choice_from_pdf_failed", qid, rel, "source parse failed"))

            override = MANUAL_OVERRIDES.get(qid)
            if override and apply_payload(question, override):
                file_changed = True
                repairs.append(Repair("manual_pdf_source_anomaly_fix", qid, rel, "source answer belongs to next orphan question"))

            added_images = attach_extra_images(question, dry_run=dry_run)
            if added_images:
                file_changed = True
                repairs.append(Repair("attach_missing_pdf_image", qid, rel, ",".join(added_images)))

            added_answer_images = attach_answer_images(question, dry_run=dry_run)
            if added_answer_images:
                file_changed = True
                repairs.append(Repair("attach_answer_pdf_image", qid, rel, ",".join(added_answer_images)))

        if file_changed and not dry_run:
            path.write_text(json.dumps(questions, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    if not dry_run:
        catalog = rebuild_catalog(files)
        (QUESTION_ROOT / "catalog.json").write_text(
            json.dumps(catalog, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        REPORT_ROOT.mkdir(parents=True, exist_ok=True)
        payload = {
            "summary": {
                "repair_count": len(repairs),
                "repairs_by_code": dict(Counter(repair.code for repair in repairs)),
            },
            "repairs": [asdict(repair) for repair in repairs],
        }
        (REPORT_ROOT / "pdf_alignment_repairs.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    return repairs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repairs = repair(dry_run=args.dry_run)
    by_code = Counter(repair.code for repair in repairs)
    print(f"dry_run={args.dry_run}")
    print(f"repairs={len(repairs)}")
    print("by_code=" + ",".join(f"{code}:{count}" for code, count in by_code.most_common()))
    if not args.dry_run:
        print("report_json=reports/pdf_alignment_repairs.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

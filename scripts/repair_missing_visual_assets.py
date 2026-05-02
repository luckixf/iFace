#!/usr/bin/env python3
"""
Attach missing stem figures/tables from local PDFs without rebuilding the bank.

This is intentionally conservative: it only crops image objects that appear
between a question's stem line and its answer/analysis marker. Images after the
answer marker are skipped so highlighted explanation diagrams do not reveal the
answer before the user submits.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Iterable

import fitz

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Pillow is optional at runtime
    Image = None


ROOT = Path(__file__).resolve().parent.parent
PDF_ROOT = ROOT / "local-pdf-sources"
QUESTION_ROOT = ROOT / "public" / "questions" / "construction"
ASSET_ROOT = ROOT / "public" / "question-assets" / "construction"
REPORT_ROOT = ROOT / "reports"

REFERENCE_ANSWER = "\u53c2\u8003\u7b54\u6848"
ANALYSIS_MARKER = "\u3010\u89e3\u6790\u3011"

VISUAL_CUE_RE = re.compile(
    r"(?:"
    r"\u5982\u4e0b\u56fe|\u4e0b\u56fe|\u5982\u56fe\u6240\u793a|\u56fe\s*[0-9\uff10-\uff19]"
    r"|\u5982\u4e0b\u8868|\u89c1\u4e0b\u8868|\u4e0b\u8868\s*[0-9\uff10-\uff19]|\u8868\s*[0-9\uff10-\uff19]"
    r")"
)

QUESTION_START_RE_TEMPLATE = r"^{number}\s*[\.\uff0e\u3001](?!\d)\s*(.*)$"
ANY_QUESTION_START_RE = re.compile(r"^(\d{1,3})\s*[\.\uff0e\u3001](?!\d)\s*(.*)$")

POST_ANSWER_VISUAL_FALLBACK_IDS = {
    # These PDFs place the stem figure at the top of the next page after the
    # answer marker. The image itself contains no highlighted answer.
    "management-chapters-3-4-20d1377c-q006",
    "management-chapters-5-3-d6b34980-q014",
    "management-mock-exams-2026-ca9a7408-q070",
}


@dataclass
class TextLine:
    page_index: int
    y: float
    text: str


@dataclass
class VisualRepair:
    code: str
    question_id: str
    file: str
    detail: str
    images: list[str]


def slugify(name: str) -> str:
    ascii_part = re.sub(r"[^0-9A-Za-z]+", "-", name).strip("-").lower()
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    if ascii_part:
        return f"{ascii_part}-{digest}"
    return f"module-{digest}"


def subject_group_input_dir(subject: str, group: str) -> Path:
    if group == "chapters":
        return PDF_ROOT / subject
    return PDF_ROOT / group / subject


def pdf_for_question_file(subject: str, group: str, file_slug: str) -> Path | None:
    source_dir = subject_group_input_dir(subject, group)
    if not source_dir.exists():
        return None

    for path in sorted(source_dir.glob("*.pdf")) + sorted(source_dir.glob("*.PDF")):
        if slugify(f"{subject}-{group}-{path.stem}") == file_slug:
            return path
    return None


def qnum_from_id(question_id: str) -> int | None:
    match = re.search(r"-q(\d+)$", question_id)
    return int(match.group(1)) if match else None


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text or "")


def extract_page_lines(page: fitz.Page) -> list[TextLine]:
    raw = page.get_text("dict")
    lines: list[TextLine] = []
    blocks = sorted(raw.get("blocks", []), key=lambda item: (item["bbox"][1], item["bbox"][0]))
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = "".join(span.get("text", "") for span in spans).strip()
            if not text:
                continue
            y = min(span["bbox"][1] for span in spans) if spans else block["bbox"][1]
            lines.append(TextLine(page_index=page.number, y=y, text=text))
    return lines


def extract_doc_lines(doc: fitz.Document) -> list[TextLine]:
    lines: list[TextLine] = []
    for page in doc:
        lines.extend(extract_page_lines(page))
    return lines


def find_question_start(lines: list[TextLine], question: dict[str, Any]) -> int | None:
    qid = str(question.get("id", ""))
    qnum = qnum_from_id(qid)

    question_text = compact(str(question.get("question", "")))
    best_index: int | None = None
    best_score = 0.0

    for index, line in enumerate(lines):
        if not ANY_QUESTION_START_RE.match(line.text.strip()):
            continue
        window = compact("".join(item.text for item in lines[index : index + 5]))
        score = question_window_score(question_text, window)
        if score > best_score:
            best_score = score
            best_index = index

    if best_index is not None and best_score >= 0.46:
        return best_index

    if qnum is None:
        return None

    start_re = re.compile(QUESTION_START_RE_TEMPLATE.format(number=qnum))
    fallback: int | None = None

    for index, line in enumerate(lines):
        match = start_re.match(line.text.strip())
        if not match:
            continue
        if fallback is None:
            fallback = index
        if prefix and prefix[:4] in compact(match.group(1)):
            return index

    return fallback


def question_window_score(question_text: str, window: str) -> float:
    if not question_text or not window:
        return 0.0
    if question_text[:20] and question_text[:20] in window:
        return 1.0

    sample_question = question_text[:120]
    sample_window = window[:180]
    score = SequenceMatcher(None, sample_question, sample_window).ratio()

    chunks = [
        sample_question[index : index + 12]
        for index in range(0, max(len(sample_question) - 11, 0), 6)
    ]
    if any(chunk and chunk in sample_window for chunk in chunks):
        score += 0.25

    return min(score, 1.0)


def is_question_start(text: str, number: int) -> bool:
    return bool(re.match(QUESTION_START_RE_TEMPLATE.format(number=number), text.strip()))


def find_question_stop(lines: list[TextLine], start_index: int, question: dict[str, Any]) -> tuple[int, float]:
    start = lines[start_index]
    start_match = ANY_QUESTION_START_RE.match(start.text.strip())
    qnum = int(start_match.group(1)) if start_match else qnum_from_id(str(question.get("id", ""))) or 0

    for line in lines[start_index + 1 :]:
        if line.text.startswith(REFERENCE_ANSWER) or line.text.startswith(ANALYSIS_MARKER):
            return line.page_index, line.y

    for line in lines[start_index + 1 :]:
        if is_question_start(line.text, qnum + 1):
            return line.page_index, line.y

    return start.page_index, start.y


def find_next_question_start(lines: list[TextLine], start_index: int) -> tuple[int, float] | None:
    start_match = ANY_QUESTION_START_RE.match(lines[start_index].text.strip())
    if not start_match:
        return None
    next_number = int(start_match.group(1)) + 1
    for line in lines[start_index + 1 :]:
        if is_question_start(line.text, next_number):
            return line.page_index, line.y
    return None


def image_rect_key(rect: fitz.Rect) -> tuple[float, float, float, float]:
    return (round(rect.x0, 1), round(rect.y0, 1), round(rect.x1, 1), round(rect.y1, 1))


def iter_page_image_rects(page: fitz.Page) -> Iterable[fitz.Rect]:
    seen: set[tuple[float, float, float, float]] = set()
    for image in page.get_images(full=True):
        xref = image[0]
        for rect in page.get_image_rects(xref):
            if rect.is_empty:
                continue
            key = image_rect_key(rect)
            if key in seen:
                continue
            seen.add(key)
            yield rect


def is_candidate_image(page: fitz.Page, rect: fitz.Rect) -> bool:
    page_area = page.rect.width * page.rect.height
    area = rect.width * rect.height
    if rect.y1 < 40:
        return False
    if rect.width < 45 or rect.height < 30:
        return False
    if area < page_area * 0.003:
        return False
    return True


def build_repeated_image_rect_keys(doc: fitz.Document) -> set[tuple[float, float, float, float]]:
    rect_page_counts: dict[tuple[float, float, float, float], int] = {}
    min_repeats = max(3, int(len(doc) * 0.3))

    for page in doc:
        page_keys = {
            image_rect_key(rect)
            for rect in iter_page_image_rects(page)
            if is_candidate_image(page, rect)
        }
        for key in page_keys:
            rect_page_counts[key] = rect_page_counts.get(key, 0) + 1

    return {key for key, count in rect_page_counts.items() if count >= min_repeats}


def rect_overlaps_span(
    rect: fitz.Rect,
    page_index: int,
    start_page: int,
    start_y: float,
    stop_page: int,
    stop_y: float,
    page_height: float,
) -> bool:
    if page_index < start_page or page_index > stop_page:
        return False
    span_y0 = start_y if page_index == start_page else 0.0
    span_y1 = stop_y if page_index == stop_page else page_height
    if span_y1 <= span_y0:
        return False
    overlap = max(0.0, min(rect.y1, span_y1) - max(rect.y0, span_y0))
    return overlap / max(rect.height, 1.0) >= 0.55


def save_question_image(page: fitz.Page, rect: fitz.Rect, absolute_base: Path) -> str:
    clip = (rect + (-10, -10, 10, 10)) & page.rect
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, alpha=False)

    if Image is None:
        absolute_path = absolute_base.with_suffix(".png")
        pix.save(absolute_path)
        return absolute_path.name

    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    max_edge = 1600
    if max(image.size) > max_edge:
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)

    absolute_path = absolute_base.with_suffix(".webp")
    image.save(absolute_path, format="WEBP", quality=82, method=6)
    return absolute_path.name


def next_image_base(asset_dir: Path, qnum: int, index: int) -> Path:
    while True:
        candidate = asset_dir / f"q{qnum:03d}-{index}"
        if not candidate.with_suffix(".webp").exists() and not candidate.with_suffix(".png").exists():
            return candidate
        index += 1


def public_asset_path(subject: str, group: str, file_slug: str, file_name: str) -> str:
    return f"/question-assets/construction/{subject}/{group}/{file_slug}/{file_name}"


def collect_and_save_images_from_span(
    doc: fitz.Document,
    ignored_rects: set[tuple[float, float, float, float]],
    asset_dir: Path,
    subject: str,
    group: str,
    file_slug: str,
    qnum: int,
    start_page: int,
    start_y: float,
    stop_page: int,
    stop_y: float,
    dry_run: bool,
) -> list[str]:
    image_paths: list[str] = []

    for page_index in range(start_page, stop_page + 1):
        page = doc[page_index]
        rects = [
            rect
            for rect in iter_page_image_rects(page)
            if image_rect_key(rect) not in ignored_rects
            and is_candidate_image(page, rect)
            and rect_overlaps_span(
                rect,
                page_index,
                start_page,
                start_y,
                stop_page,
                stop_y,
                page.rect.height,
            )
        ]
        rects.sort(key=lambda rect: (rect.y0, rect.x0))

        for rect in rects:
            image_index = len(image_paths) + 1
            file_base = next_image_base(asset_dir, qnum, image_index)
            file_name = file_base.with_suffix(".webp").name
            if not dry_run:
                asset_dir.mkdir(parents=True, exist_ok=True)
                file_name = save_question_image(page, rect, file_base)
            image_paths.append(public_asset_path(subject, group, file_slug, file_name))

    return image_paths


def attach_visual_assets_to_file(
    path: Path,
    questions: list[dict[str, Any]],
    dry_run: bool,
) -> list[VisualRepair]:
    rel_parts = path.relative_to(QUESTION_ROOT).parts
    if len(rel_parts) != 3:
        return []

    subject, group, file_name = rel_parts
    file_slug = Path(file_name).stem
    rel_file = str(path.relative_to(QUESTION_ROOT)).replace("\\", "/")
    pdf_path = pdf_for_question_file(subject, group, file_slug)

    repairs: list[VisualRepair] = []
    candidates = [
        question
        for question in questions
        if not question.get("questionImages")
        and VISUAL_CUE_RE.search(str(question.get("question", "")))
    ]
    if not candidates:
        return repairs
    if pdf_path is None:
        for question in candidates:
            repairs.append(
                VisualRepair(
                    "missing_source_pdf",
                    str(question.get("id", "")),
                    rel_file,
                    "no matching PDF found for visual cue question",
                    [],
                )
            )
        return repairs

    doc = fitz.open(pdf_path)
    lines = extract_doc_lines(doc)
    ignored_rects = build_repeated_image_rect_keys(doc)
    asset_dir = ASSET_ROOT / subject / group / file_slug

    for question in candidates:
        qid = str(question.get("id", ""))
        qnum = qnum_from_id(qid)
        start_index = find_question_start(lines, question)
        if qnum is None or start_index is None:
            repairs.append(
                VisualRepair("question_span_not_found", qid, rel_file, "could not locate question in PDF", [])
            )
            continue

        start = lines[start_index]
        stop_page, stop_y = find_question_stop(lines, start_index, question)
        image_paths: list[str] = []

        for page_index in range(start.page_index, stop_page + 1):
            page = doc[page_index]
            rects = [
                rect
                for rect in iter_page_image_rects(page)
                if image_rect_key(rect) not in ignored_rects
                and is_candidate_image(page, rect)
                and rect_overlaps_span(
                    rect,
                    page_index,
                    start.page_index,
                    start.y,
                    stop_page,
                    stop_y,
                    page.rect.height,
                )
            ]
            rects.sort(key=lambda rect: (rect.y0, rect.x0))

            for rect in rects:
                image_index = len(image_paths) + 1
                file_base = next_image_base(asset_dir, qnum, image_index)
                file_name = file_base.with_suffix(".webp").name
                if not dry_run:
                    asset_dir.mkdir(parents=True, exist_ok=True)
                    file_name = save_question_image(page, rect, file_base)
                image_paths.append(public_asset_path(subject, group, file_slug, file_name))

        if image_paths:
            if not dry_run:
                question["questionImages"] = image_paths
            repairs.append(
                VisualRepair(
                    "attach_missing_stem_visual",
                    qid,
                    rel_file,
                    f"attached {len(image_paths)} image(s) from {pdf_path.name}",
                    image_paths,
                )
            )
            continue

        if qid in POST_ANSWER_VISUAL_FALLBACK_IDS:
            next_start = find_next_question_start(lines, start_index)
            if next_start is not None:
                fallback_paths = collect_and_save_images_from_span(
                    doc=doc,
                    ignored_rects=ignored_rects,
                    asset_dir=asset_dir,
                    subject=subject,
                    group=group,
                    file_slug=file_slug,
                    qnum=qnum,
                    start_page=stop_page,
                    start_y=stop_y,
                    stop_page=next_start[0],
                    stop_y=next_start[1],
                    dry_run=dry_run,
                )
                if fallback_paths:
                    if not dry_run:
                        question["questionImages"] = fallback_paths
                    repairs.append(
                        VisualRepair(
                            "attach_post_answer_stem_visual",
                            qid,
                            rel_file,
                            "attached reviewed post-answer figure crop",
                            fallback_paths,
                        )
                    )
                    continue

        if image_paths:
            # Kept for defensive clarity if the branch above changes later.
            continue
        else:
            repairs.append(
                VisualRepair(
                    "visual_cue_without_pre_answer_image",
                    qid,
                    rel_file,
                    "visual cue exists, but no pre-answer PDF image object was found",
                    [],
                )
            )

    doc.close()
    return repairs


def load_question_files() -> list[tuple[Path, list[dict[str, Any]]]]:
    files: list[tuple[Path, list[dict[str, Any]]]] = []
    for path in sorted(QUESTION_ROOT.rglob("*.json")):
        if path.name == "catalog.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            files.append((path, payload))
    return files


def write_report(repairs: list[VisualRepair]) -> None:
    from collections import Counter

    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": {
            "repairs": len(repairs),
            "by_code": dict(Counter(repair.code for repair in repairs)),
        },
        "repairs": [asdict(repair) for repair in repairs],
    }
    (REPORT_ROOT / "missing_visual_asset_repairs.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def repair(dry_run: bool) -> list[VisualRepair]:
    all_repairs: list[VisualRepair] = []
    files = load_question_files()
    for path, questions in files:
        repairs = attach_visual_assets_to_file(path, questions, dry_run=dry_run)
        if repairs:
            all_repairs.extend(repairs)
            if not dry_run:
                path.write_text(
                    json.dumps(questions, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8",
                )
    if not dry_run:
        write_report(all_repairs)
    return all_repairs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repairs = repair(dry_run=args.dry_run)
    from collections import Counter

    by_code = Counter(repair.code for repair in repairs)
    print(f"dry_run={args.dry_run}")
    print(f"repairs={len(repairs)}")
    print("by_code=" + ",".join(f"{code}:{count}" for code, count in by_code.most_common()))
    if not args.dry_run:
        print("report_json=reports/missing_visual_asset_repairs.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

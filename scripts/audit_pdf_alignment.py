#!/usr/bin/env python3
"""Audit the current JSON question bank against the local source PDFs.

This script is an acceptance checker, not a parser. It keeps the existing JSON
as the artifact under review and verifies that each question can be traced back
to its source PDF with matching stem/options/answer and plausible image crops.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import fitz

from repair_missing_visual_assets import (
    POST_ANSWER_VISUAL_FALLBACK_IDS,
    build_repeated_image_rect_keys,
    extract_doc_lines,
    image_rect_key,
    is_candidate_image,
    iter_page_image_rects,
    pdf_for_question_file,
    rect_overlaps_span,
)


ROOT = Path(__file__).resolve().parent.parent
QUESTION_ROOT = ROOT / "public" / "questions" / "construction"
PUBLIC_ROOT = ROOT / "public"
REPORT_ROOT = ROOT / "reports"

CORRECT_ANSWER = "\u6b63\u786e\u7b54\u6848"
REFERENCE_ANSWER = "\u53c2\u8003\u7b54\u6848"
ANALYSIS = "\u89e3\u6790"
SOURCE_HAS_NO_ANALYSIS = "\u539f PDF \u672a\u63d0\u4f9b\u89e3\u6790"

ANSWER_RE = re.compile(r"(?:\u53c2\u8003\u7b54\u6848|\u7b54\u6848)\s*[:\uff1a]\s*([A-E\u3001\uff0c, ]{1,16})")
MARKDOWN_ANSWER_RE = re.compile(
    rf"##\s*(?:{CORRECT_ANSWER}|{REFERENCE_ANSWER})\s*\n\s*([A-E](?:[\s,\u3001\uff0c]*[A-E])*)"
)
MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")
QUESTION_ID_NUM_RE = re.compile(r"-q(\d+)$")
GENERIC_QUESTION_START_RE = re.compile(r"^(\d{1,3})\s*[\.\uff0e\u3001]\s*(.*)$")

PDF_SOURCE_KNOWN_BAD_ANSWER_IDS = {
    # The source PDF drops the next safety question's stem: q011 is followed by
    # another A-D option set and that next question's answer/analysis. The q011
    # stem/options themselves are intact, so the JSON is repaired manually.
    "highway-mock-exams-2026-4cbdee82-q011",
}

PDF_SOURCE_ANALYSIS_ONLY_ANSWER_IDS = {
    # The PDF says "参考答案：详见解析"; the analysis explicitly identifies D/E.
    "management-past-exams-2025-5-11-4b92100c-q070",
}


@dataclass
class PdfIssue:
    severity: str
    code: str
    question_id: str
    file: str
    detail: str
    question: str
    source_page: int | None = None
    source_number: int | None = None
    source_line: str | None = None


def load_question_files() -> list[tuple[Path, list[dict[str, Any]]]]:
    files: list[tuple[Path, list[dict[str, Any]]]] = []
    for path in sorted(QUESTION_ROOT.rglob("*.json")):
        if path.name == "catalog.json":
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            files.append((path, payload))
    return files


def compact(text: str) -> str:
    text = text or ""
    text = re.sub(r"(?:\(\s*\)|\uff08\s*\uff09)", "", text)
    replacements = {
        "\uff08": "(",
        "\uff09": ")",
        "\uff0c": ",",
        "\u3002": ".",
        "\uff1a": ":",
        "\uff1b": ";",
        "\uff05": "%",
        "\u3000": "",
        "\xa0": "",
        "\u2014": "-",
        "\uff5e": "~",
        "\u3010": "",
        "\u3011": "",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\s+", "", text)
    return re.sub(r"[(),.;:，。；：、\"'“”‘’【】\[\]{}<>《》]", "", text)

def strip_source_noise(text: str) -> str:
    lines: list[str] = []
    for line in str(text or "").replace("\r\n", "\n").split("\n"):
        value = line.strip()
        if not value:
            continue
        if re.fullmatch(r"\d{1,3}", value):
            continue
        if "\u4e13\u4e1a\u7f51\u6821\u8bfe\u7a0b" in value and "\u9898\u5e93\u8f6f\u4ef6" in value:
            continue
        if "\u82a5\u8fc7\u6559\u80b2" in value:
            continue
        lines.append(value)
    return "\n".join(lines)


def meaningful_chunks(text: str, size: int = 16, max_chunks: int = 8) -> list[str]:
    value = compact(text)
    value = re.sub(r"#+(?:正确答案|参考答案|解析)", "", value)
    if len(value) <= size:
        return [value] if len(value) >= 4 else []

    chunks: list[str] = []
    positions = [0]
    if len(value) > size * 2:
        positions.append(max(0, len(value) // 2 - size // 2))
    positions.append(max(0, len(value) - size))

    step = max(size, len(value) // max(max_chunks, 1))
    positions.extend(range(0, max(len(value) - size, 0), step))

    seen: set[str] = set()
    for pos in positions:
        chunk = value[pos : pos + size]
        if len(chunk) >= 4 and chunk not in seen:
            seen.add(chunk)
            chunks.append(chunk)
        if len(chunks) >= max_chunks:
            break
    return chunks


def chunk_coverage(text: str, haystack: str, size: int = 16) -> tuple[int, int]:
    chunks = meaningful_chunks(text, size=size)
    if not chunks:
        return 0, 0
    found = sum(1 for chunk in chunks if chunk in haystack)
    return found, len(chunks)


def markdown_answer_letters(answer: str) -> list[str]:
    match = MARKDOWN_ANSWER_RE.search(answer)
    if not match:
        return []
    letters: list[str] = []
    for letter in re.findall(r"[A-E]", match.group(1)):
        if letter not in letters:
            letters.append(letter)
    return letters


def source_answer_letters(span_text: str) -> list[str]:
    match = ANSWER_RE.search(span_text)
    if not match:
        return []
    letters: list[str] = []
    for letter in re.findall(r"[A-E]", match.group(1)):
        if letter not in letters:
            letters.append(letter)
    return letters


def source_uses_analysis_only_answer(span_text: str) -> bool:
    return bool(
        re.search(
            r"(?:\u53c2\u8003\u7b54\u6848|\u7b54\u6848)\s*[:\uff1a]\s*\u8be6\u89c1\u89e3\u6790",
            span_text,
        )
    )


def analysis_text(answer: str) -> str:
    if f"## {ANALYSIS}" in answer:
        value = answer.split(f"## {ANALYSIS}", 1)[1].strip()
    else:
        value = MARKDOWN_ANSWER_RE.sub("", answer, count=1).strip()
    return MARKDOWN_IMAGE_RE.sub("", value).strip()


def public_image_to_path(image: str) -> Path:
    return PUBLIC_ROOT / image.lstrip("/").replace("/", "\\")


def rel_info(path: Path) -> tuple[str, str, str] | None:
    rel_parts = path.relative_to(QUESTION_ROOT).parts
    if len(rel_parts) != 3:
        return None
    subject, group, file_name = rel_parts
    return subject, group, Path(file_name).stem


def qnum_from_id(question_id: str) -> int | None:
    match = QUESTION_ID_NUM_RE.search(question_id)
    return int(match.group(1)) if match else None


def question_start_match(text: str) -> re.Match[str] | None:
    match = GENERIC_QUESTION_START_RE.match(text.strip())
    if not match:
        return None
    rest = match.group(2).strip()
    # Section headings such as "1.1 路基施工" are not question starts. A real
    # question may still begin with a digit, e.g. "29.4M1E是...".
    if re.match(r"^\d+(?:[\.\uff0e]\d+)+\b", rest):
        return None
    return match


def is_numbered_analysis_item(text: str) -> bool:
    match = question_start_match(text)
    if not match:
        return False
    rest = match.group(2)
    return bool(
        re.search(r"[A-E]\s*\u9009\u9879(?:\u6b63\u786e|\u9519\u8bef)", rest)
        and not re.search(r"(?:\(\s*\)|\uff08\s*\uff09)", rest)
    )


def candidate_window_text(lines: list[Any], index: int, max_lines: int = 14) -> str:
    """Return only this candidate's local question text for start scoring."""

    values: list[str] = []
    start_page = lines[index].page_index
    for offset, line in enumerate(lines[index : index + max_lines]):
        text = line.text.strip()
        if offset > 0:
            if line.page_index != start_page and values:
                break
            if question_start_match(text) and not is_numbered_analysis_item(text):
                break
            if text.startswith(REFERENCE_ANSWER) or text.startswith(f"\u3010{ANALYSIS}\u3011"):
                break
        values.append(line.text)
    return "".join(values)


def source_start_score(question: dict[str, Any], candidate_window: str, candidate_number: int) -> float:
    stem = str(question.get("question", ""))
    found, total = chunk_coverage(stem, candidate_window, size=14)
    score = (found / total) if total else 0.0
    stem_compact = compact(stem)
    if stem_compact[:18] and stem_compact[:18] in candidate_window:
        score += 0.45
    if stem_compact[:10] and stem_compact[:10] in candidate_window:
        score += 0.2
    qnum = qnum_from_id(str(question.get("id", "")))
    if qnum is not None and candidate_number == qnum:
        score += 0.15
    return score


def find_source_question_start(lines: list[Any], question: dict[str, Any], min_index: int = 0) -> int | None:
    """Find the PDF question start, preferring forward sequential alignment."""

    candidates: list[tuple[float, int, int]] = []
    qnum = qnum_from_id(str(question.get("id", "")))
    for index, line in enumerate(lines):
        if index < min_index:
            continue
        match = question_start_match(line.text)
        if not match:
            continue

        # Numbered analysis items such as "4.A选项错误..." are not question starts.
        if is_numbered_analysis_item(line.text):
            continue

        window = compact(candidate_window_text(lines, index))
        candidate_number = int(match.group(1))
        score = source_start_score(question, window, candidate_number)
        if score >= 0.4:
            candidates.append((score, index, candidate_number))

    if candidates:
        if qnum is not None:
            exact = [candidate for candidate in candidates if candidate[2] == qnum]
            if exact:
                exact.sort(key=lambda item: (-item[0], item[1]))
                best_score = max(score for score, _, _ in candidates)
                if exact[0][0] >= max(0.75, best_score - 0.08):
                    return exact[0][1]
            nearby = [candidate for candidate in candidates if abs(candidate[2] - qnum) <= 3]
            if nearby:
                nearby.sort(key=lambda item: (-item[0], abs(item[2] - qnum), item[1]))
                best_score = max(score for score, _, _ in candidates)
                if nearby[0][0] >= max(0.75, best_score - 0.08):
                    return nearby[0][1]

        candidates.sort(
            key=lambda item: (
                -item[0],
                abs(item[2] - qnum) if qnum is not None else 0,
                item[1],
            )
        )
        return candidates[0][1]

    if min_index:
        return find_source_question_start(lines, question, 0)

    return None


def line_in_span(line: Any, start_page: int, start_y: float, stop_page: int, stop_y: float) -> bool:
    if line.page_index < start_page or line.page_index > stop_page:
        return False
    lower = start_y if line.page_index == start_page else 0.0
    upper = stop_y if line.page_index == stop_page else float("inf")
    return lower <= line.y < upper


def span_text(lines: list[Any], start_page: int, start_y: float, stop_page: int, stop_y: float) -> str:
    return "\n".join(
        line.text for line in lines if line_in_span(line, start_page, start_y, stop_page, stop_y)
    )


def is_question_start_number(text: str, number: int) -> bool:
    match = question_start_match(text)
    return bool(match and int(match.group(1)) == number and not is_numbered_analysis_item(text))


def find_next_source_question_start(lines: list[Any], start_index: int) -> tuple[int, float] | None:
    start_match = question_start_match(lines[start_index].text)
    if not start_match:
        return None
    next_number = int(start_match.group(1)) + 1
    for line in lines[start_index + 1 :]:
        if is_question_start_number(line.text, next_number):
            return line.page_index, line.y
    return None


def find_source_question_stop(lines: list[Any], start_index: int, question: dict[str, Any]) -> tuple[int, float]:
    start_match = question_start_match(lines[start_index].text)
    qnum = int(start_match.group(1)) if start_match else qnum_from_id(str(question.get("id", ""))) or 0

    for line in lines[start_index + 1 :]:
        if line.text.startswith(REFERENCE_ANSWER) or line.text.startswith(f"\u3010{ANALYSIS}\u3011"):
            return line.page_index, line.y

    for line in lines[start_index + 1 :]:
        if is_question_start_number(line.text, qnum + 1):
            return line.page_index, line.y

    return lines[start_index].page_index, lines[start_index].y


def expected_image_rect_count(
    doc: fitz.Document,
    lines: list[Any],
    ignored_rects: set[tuple[float, float, float, float]],
    question: dict[str, Any],
    start_index: int,
    stop_page: int,
    stop_y: float,
) -> int:
    start = lines[start_index]
    qid = str(question.get("id", ""))
    ranges = [(start.page_index, start.y, stop_page, stop_y)]
    if qid in POST_ANSWER_VISUAL_FALLBACK_IDS:
        next_start = find_next_source_question_start(lines, start_index)
        if next_start is not None:
            ranges.append((stop_page, stop_y, next_start[0], next_start[1]))

    count = 0
    for start_page, start_y, end_page, end_y in ranges:
        for page_index in range(start_page, end_page + 1):
            page = doc[page_index]
            for rect in iter_page_image_rects(page):
                if image_rect_key(rect) in ignored_rects:
                    continue
                if not is_candidate_image(page, rect):
                    continue
                if rect_overlaps_span(rect, page_index, start_page, start_y, end_page, end_y, page.rect.height):
                    count += 1
    return count


def add_issue(
    issues: list[PdfIssue],
    severity: str,
    code: str,
    question: dict[str, Any],
    file: str,
    detail: str,
    source_line: Any | None = None,
) -> None:
    source_match = question_start_match(source_line.text) if source_line is not None else None
    issues.append(
        PdfIssue(
            severity=severity,
            code=code,
            question_id=str(question.get("id", "")),
            file=file,
            detail=detail,
            question=re.sub(r"\s+", " ", str(question.get("question", ""))).strip()[:180],
            source_page=(source_line.page_index + 1) if source_line is not None else None,
            source_number=int(source_match.group(1)) if source_match else None,
            source_line=(
                re.sub(r"\s+", " ", source_line.text).strip()[:180]
                if source_line is not None
                else None
            ),
        )
    )


def audit_file(path: Path, questions: list[dict[str, Any]]) -> tuple[list[PdfIssue], dict[str, int]]:
    issues: list[PdfIssue] = []
    rel = str(path.relative_to(QUESTION_ROOT)).replace("\\", "/")
    info = rel_info(path)
    stats = Counter()
    if info is None:
        for question in questions:
            add_issue(issues, "error", "unsupported_question_file_path", question, rel, "")
        return issues, stats

    subject, group, file_slug = info
    pdf_path = pdf_for_question_file(subject, group, file_slug)
    if pdf_path is None:
        for question in questions:
            add_issue(issues, "error", "source_pdf_not_found", question, rel, file_slug)
        return issues, stats

    doc = fitz.open(pdf_path)
    lines = extract_doc_lines(doc)
    ignored_rects = build_repeated_image_rect_keys(doc)

    for question in questions:
        stats["questions"] += 1
        qid = str(question.get("id", ""))
        qtype = str(question.get("type", ""))
        start_index = find_source_question_start(lines, question, min_index=0)
        if start_index is None:
            add_issue(issues, "error", "pdf_question_not_found", question, rel, pdf_path.name)
            continue

        stats["located"] += 1
        start = lines[start_index]
        stop_page, stop_y = find_source_question_stop(lines, start_index, question)
        next_start = find_next_source_question_start(lines, start_index)
        all_stop_page, all_stop_y = next_start if next_start is not None else (len(doc) - 1, doc[-1].rect.height)

        pre_answer_text = span_text(lines, start.page_index, start.y, stop_page, stop_y)
        full_question_text = span_text(lines, start.page_index, start.y, all_stop_page, all_stop_y)
        clean_pre_answer_text = strip_source_noise(pre_answer_text)
        clean_full_question_text = strip_source_noise(full_question_text)
        pre_answer_compact = compact(clean_pre_answer_text)
        full_question_compact = compact(clean_full_question_text)

        stem_found, stem_total = chunk_coverage(str(question.get("question", "")), pre_answer_compact, size=18)
        if stem_total and stem_found / stem_total < 0.55:
            add_issue(
                issues,
                "error",
                "pdf_stem_low_coverage",
                question,
                rel,
                f"{stem_found}/{stem_total} chunks matched",
                start,
            )

        options = question.get("options") or []
        if qtype in {"single", "multiple"}:
            for option in options:
                if not isinstance(option, dict):
                    continue
                option_text = str(option.get("text", ""))
                if option_text.startswith("\u89c1\u9898\u56fe\u9009\u9879"):
                    continue
                if len(compact(option_text)) <= 2:
                    continue
                found, total = chunk_coverage(option_text, pre_answer_compact, size=10)
                if total and found == 0:
                    if "XXXXXX" in clean_pre_answer_text:
                        continue
                    add_issue(
                        issues,
                        "error",
                        "pdf_option_not_found",
                        question,
                        rel,
                        f"{option.get('key')}: {option_text}",
                        start,
                    )

            json_letters = question.get("correctAnswers") or markdown_answer_letters(str(question.get("answer", "")))
            pdf_letters = source_answer_letters(full_question_text)
            if qid in PDF_SOURCE_KNOWN_BAD_ANSWER_IDS:
                pass
            elif pdf_letters and sorted(json_letters) != sorted(pdf_letters):
                add_issue(
                    issues,
                    "error",
                    "pdf_answer_mismatch",
                    question,
                    rel,
                    f"json={''.join(json_letters)} pdf={''.join(pdf_letters)}",
                    start,
                )
            elif not pdf_letters and (
                qid not in PDF_SOURCE_ANALYSIS_ONLY_ANSWER_IDS
                or not source_uses_analysis_only_answer(full_question_text)
            ):
                add_issue(issues, "review", "pdf_answer_not_detected", question, rel, "", start)

            analysis = analysis_text(str(question.get("answer", "")))
            if analysis and SOURCE_HAS_NO_ANALYSIS not in analysis:
                found, total = chunk_coverage(analysis, full_question_compact, size=18)
                if total and found / total < 0.25:
                    if qid in PDF_SOURCE_KNOWN_BAD_ANSWER_IDS:
                        continue
                    add_issue(
                        issues,
                        "review",
                        "pdf_analysis_low_coverage",
                        question,
                        rel,
                        f"{found}/{total} chunks matched",
                        start,
                    )

        images = question.get("questionImages") or []
        if images:
            stats["image_questions"] += 1
            missing_assets = [image for image in images if not public_image_to_path(str(image)).exists()]
            if missing_assets:
                add_issue(issues, "error", "image_asset_missing", question, rel, ",".join(missing_assets), start)
            expected_count = expected_image_rect_count(doc, lines, ignored_rects, question, start_index, stop_page, stop_y)
            if expected_count and expected_count != len(images):
                add_issue(
                    issues,
                    "review",
                    "pdf_image_count_mismatch",
                    question,
                    rel,
                    f"json={len(images)} pdf_candidates={expected_count}",
                    start,
                )

    doc.close()
    return issues, stats


def audit() -> tuple[list[PdfIssue], dict[str, Any]]:
    all_issues: list[PdfIssue] = []
    stats = Counter()
    files = load_question_files()
    for path, questions in files:
        issues, file_stats = audit_file(path, questions)
        all_issues.extend(issues)
        stats.update(file_stats)
        stats["question_files"] += 1

    summary = {
        "questions": stats["questions"],
        "question_files": stats["question_files"],
        "located": stats["located"],
        "image_questions": stats["image_questions"],
        "issues": len(all_issues),
        "by_severity": dict(Counter(issue.severity for issue in all_issues)),
        "by_code": dict(Counter(issue.code for issue in all_issues)),
    }
    return all_issues, summary


def write_reports(issues: list[PdfIssue], summary: dict[str, Any]) -> None:
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = {
        "summary": summary,
        "issues": [asdict(issue) for issue in issues],
    }
    (REPORT_ROOT / "pdf_alignment_audit.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# PDF Alignment Audit",
        "",
        f"- Questions: {summary['questions']}",
        f"- Question files: {summary['question_files']}",
        f"- Located in PDF: {summary['located']}",
        f"- Image questions: {summary['image_questions']}",
        f"- Issues: {summary['issues']}",
        f"- By severity: {summary['by_severity']}",
        f"- By code: {summary['by_code']}",
    ]
    if issues:
        lines.extend(["", "## Issues"])
        for issue in issues[:500]:
            source = ""
            if issue.source_page is not None:
                source = f" source=p{issue.source_page}/q{issue.source_number or '?'}"
            lines.append(
                f"- `{issue.severity}` `{issue.code}` `{issue.question_id}` "
                f"`{issue.file}`{source} - {issue.detail}"
            )
    (REPORT_ROOT / "pdf_alignment_audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args()

    issues, summary = audit()
    write_reports(issues, summary)
    print(f"questions={summary['questions']}")
    print(f"question_files={summary['question_files']}")
    print(f"located={summary['located']}")
    print(f"image_questions={summary['image_questions']}")
    print(f"issues={summary['issues']}")
    print(f"by_severity={summary['by_severity']}")
    print(f"by_code={summary['by_code']}")
    print("report_json=reports/pdf_alignment_audit.json")
    print("report_md=reports/pdf_alignment_audit.md")
    has_error = any(issue.severity == "error" for issue in issues)
    return 1 if args.fail_on_error and has_error else 0


if __name__ == "__main__":
    raise SystemExit(main())

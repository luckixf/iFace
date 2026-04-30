#!/usr/bin/env python3
"""
Build the built-in construction-engineering question bank from local PDFs.

This optional offline script parses three parallel exam branches under
`local-pdf-sources`:

- 公路工程管理与实务
- 建设工程法规及相关知识
- 建设工程施工管理

For each branch it scans:

- 章节精讲
- 历年真题
- 模拟试卷

and generates:

- public/questions/construction/**/*.json
- public/question-assets/construction/**/*.{webp,png}
- public/questions/construction/catalog.json
- src/generated/constructionBank.ts

The parser is intentionally heuristic but tailored to the current PDFs:

- filters page headers / footers / watermark noise
- suppresses near-duplicate OCR lines caused by watermark overlay / hidden text
- extracts single-choice, multiple-choice and essay questions
- preserves essay-question sections more cleanly in Markdown
- exports meaningful inline diagrams as question images
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable

import fitz

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Pillow is optional at runtime
    Image = None


ROOT = Path(__file__).resolve().parents[2]
PDF_ROOT = ROOT / "local-pdf-sources"
QUESTIONS_ROOT = ROOT / "public" / "questions" / "construction"
ASSETS_ROOT = ROOT / "public" / "question-assets" / "construction"
GENERATED_TS = ROOT / "src" / "generated" / "constructionBank.ts"
CATALOG_JSON = QUESTIONS_ROOT / "catalog.json"

LEGACY_OUTPUTS = [
    ROOT / "public" / "questions" / "highway",
    ROOT / "public" / "question-assets" / "highway",
    ROOT / "src" / "generated" / "highwayBank.ts",
]

WATERMARK_KEYWORDS = (
    "专业网校课程",
    "题库软件",
    "考试用书",
    "资讯信息全方位一体化职业考试学习平台",
    "大立教育",
)

WATERMARK_FRAGMENTS = (
    *WATERMARK_KEYWORDS,
    "专业网校",
    "网校课程",
    "职业考试学习平台",
    "资讯信息",
    "一体化",
)

REPEATED_SECTION_KEYS = (
    "背景资料",
    "问题",
    "参考答案",
    "解析",
    "事件一",
    "事件二",
    "事件三",
    "事件四",
    "事件五",
    "事件六",
    "事件七",
    "事件八",
    "事件九",
    "事件十",
)

TYPE_LABELS = {
    "single": "单选题",
    "multiple": "多选题",
    "essay": "解答题",
}

DIFFICULTY_BY_TYPE = {
    "single": 1,
    "multiple": 2,
    "essay": 3,
}

QUESTION_RE = re.compile(r"^(\d{1,3})\s*[.．、](?!\d)\s*(.*)$")
OPTION_RE = re.compile(r"^([A-E])\s*[.．、]\s*(.*)$")
ANSWER_RE = re.compile(r"^(?:参考答案|答案)\s*[:：]\s*(.*)$")
ANALYSIS_RE = re.compile(r"^(?:【解析】|解析\s*[:：])\s*(.*)$")
MAJOR_ANALYSIS_RE = re.compile(r"^\d+\s*[.．、](?!\d)(?:\s*.*)?$")
PURE_MAJOR_ANALYSIS_RE = re.compile(r"^\d+\s*[.．、](?!\d)$")
SUB_ANALYSIS_RE = re.compile(
    r"^(?:\d+\s*-\s*(?:\d+|[A-E])|[（(]\d+[）)]|[A-E]\s*[:：.．、]).*$"
)
SECTION_MARKER_RE = re.compile(
    r"(?:【背景资料】|背景资料\s*[:：]?|【问题】|问题\s*[:：]?|"
    r"【参考答案】|参考答案\s*[:：]?|【解析】|解析\s*[:：]?|"
    r"事件[一二三四五六七八九十]\s*[:：]?)"
)


@dataclass(frozen=True)
class SubjectBranch:
    label: str
    slug: str
    order: int
    chapter_dir: Path


@dataclass(frozen=True)
class SourceGroup:
    label: str
    output_dir: str
    order: int


@dataclass
class TextLine:
    text: str
    page: int
    y: float


@dataclass
class ParsedQuestion:
    sequence: int
    number: int
    module: str
    subject: str
    source: str
    question_type: str
    stem_lines: list[str] = field(default_factory=list)
    options: list[dict[str, str]] = field(default_factory=list)
    answer_key: str = ""
    analysis_lines: list[str] = field(default_factory=list)
    question_images: list[str] = field(default_factory=list)
    pages: list[int] = field(default_factory=list)


SUBJECT_BRANCHES = [
    SubjectBranch(
        label="公路工程管理与实务",
        slug="highway",
        order=0,
        chapter_dir=PDF_ROOT / "highway",
    ),
    SubjectBranch(
        label="建设工程法规及相关知识",
        slug="regulations",
        order=1,
        chapter_dir=PDF_ROOT / "regulations",
    ),
    SubjectBranch(
        label="建设工程施工管理",
        slug="management",
        order=2,
        chapter_dir=PDF_ROOT / "management",
    ),
]

SOURCE_GROUPS = [
    SourceGroup(label="章节精讲", output_dir="chapters", order=0),
    SourceGroup(label="历年真题", output_dir="past-exams", order=1),
    SourceGroup(label="模拟试卷", output_dir="mock-exams", order=2),
]


def natural_sort_key(text: str) -> list[object]:
    parts = re.split(r"(\d+)", text)
    key: list[object] = []
    for part in parts:
        if part.isdigit():
            key.append(int(part))
        elif part:
            key.append(part)
    return key


def slugify(name: str) -> str:
    ascii_part = re.sub(r"[^0-9A-Za-z]+", "-", name).strip("-").lower()
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    if ascii_part:
        return f"{ascii_part}-{digest}"
    return f"module-{digest}"


def normalize_text(text: str) -> str:
    text = text.replace("\u3000", " ")
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"(\d)-\.(?=[A-E])", r"\1-", text)
    return apply_known_ocr_fixes(text.strip())


def normalize_mileage_suffix(match: re.Match[str]) -> str:
    prefix = match.group(1)
    suffix = match.group(2)
    translate = str.maketrans(
        {
            "O": "0",
            "o": "0",
            "Q": "0",
            "I": "1",
            "l": "1",
            "S": "5",
            "s": "5",
            "Z": "2",
        }
    )
    return prefix + suffix.translate(translate)


def repair_numeric_ocr(text: str) -> str:
    cleaned = re.sub(
        r"(?<![A-Za-z0-9])((?:[A-Z]{0,2}K)\d+\+)([0-9A-Za-z]{2,6})(?![A-Za-z0-9])",
        normalize_mileage_suffix,
        text,
    )
    cleaned = re.sub(r"(?<![A-Za-z])[Il](?=\d)", "1", cleaned)
    cleaned = re.sub(r"(?<=\d)[OoQ](?=\d)", "0", cleaned)
    cleaned = re.sub(r"(?<=\d)[Il](?=\d)", "1", cleaned)
    return cleaned


def apply_known_ocr_fixes(text: str) -> str:
    cleaned = repair_numeric_ocr(text)
    replacements = {
        "钢板粧": "钢板桩",
        "粧锁口": "桩锁口",
        "顺顺序": "顺序",
        "围岩别为": "围岩级别为",
        "该道属于什么类型": "该隧道属于什么类型",
        "亚级围岩": "Ⅲ级围岩",
        "亚亚级": "Ⅲ级",
        "IⅢ级": "Ⅲ级",
        "IlI级": "Ⅲ级",
        "IIII级": "Ⅲ级",
    }
    for before, after in replacements.items():
        cleaned = cleaned.replace(before, after)
    return cleaned


def strip_inline_watermark_fragments(text: str) -> str:
    cleaned = text
    for keyword in WATERMARK_FRAGMENTS:
        cleaned = cleaned.replace(keyword, "")
    cleaned = re.sub(r"[ ]{2,}", " ", cleaned)
    cleaned = re.sub(r"[，,、]{2,}", "，", cleaned)
    return cleaned.strip(" ，、,;；")


def canonicalize_for_compare(text: str) -> str:
    cleaned = normalize_text(text)
    cleaned = re.sub(r"[XxＸ]{2,}", "", cleaned)
    cleaned = re.sub(r"[^\u4e00-\u9fffA-Za-z0-9]", "", cleaned)
    return cleaned


def quality_score(text: str) -> float:
    chinese = len(re.findall(r"[\u4e00-\u9fff]", text))
    digits = len(re.findall(r"\d", text))
    latin = len(re.findall(r"[A-Za-z]", text))
    placeholder_penalty = sum(
        len(match.group(0)) for match in re.finditer(r"[XxＸ]{2,}", text)
    )
    return chinese + digits * 0.2 + latin * 0.05 - placeholder_penalty * 1.4


def choose_better_duplicate_text(left: str, right: str) -> str:
    left_key = canonicalize_for_compare(left)
    right_key = canonicalize_for_compare(right)
    if not left_key:
        return right
    if not right_key:
        return left

    left_score = quality_score(left)
    right_score = quality_score(right)

    if right_score > left_score + 1.2 and len(right_key) >= len(left_key) * 0.75:
        return right
    if left_score > right_score + 1.2 and len(left_key) >= len(right_key) * 0.75:
        return left
    if len(right_key) >= len(left_key) * 0.92:
        return right
    return left


def is_near_duplicate(left: str, right: str) -> bool:
    left_key = canonicalize_for_compare(left)
    right_key = canonicalize_for_compare(right)
    if len(left_key) < 10 or len(right_key) < 10:
        return False

    short, long = (
        (left_key, right_key)
        if len(left_key) <= len(right_key)
        else (right_key, left_key)
    )
    if len(short) >= 18 and short in long and len(short) / len(long) >= 0.58:
        return True

    return SequenceMatcher(None, left_key, right_key).ratio() >= 0.88


def merge_text(left: str, right: str) -> str:
    if not left:
        return right
    if not right:
        return left
    if left.endswith((" ", "（", "(", "【", "《", "-", "—", "/", "·")):
        return left + right
    if right.startswith(("，", "。", "！", "？", "；", "：", "、", "）", ")", "】", "》", ",", ".", "!", "?", ";", ":")):
        return left + right
    if re.search(r"[A-Za-z0-9]$", left) and re.match(r"^[A-Za-z0-9]", right):
        return f"{left} {right}"
    return left + right


def canonical_section_marker(marker: str) -> str | None:
    if "背景资料" in marker:
        return "背景资料"
    if "参考答案" in marker:
        return "参考答案"
    if "解析" in marker:
        return "解析"
    if "问题" in marker:
        return "问题"

    event_match = re.search(r"事件[一二三四五六七八九十]", marker)
    if event_match:
        return event_match.group(0)

    return None


def collapse_restarted_section(paragraph: str) -> str:
    collapsed = paragraph.strip()

    for _ in range(4):
        matches = list(SECTION_MARKER_RE.finditer(collapsed))
        if len(matches) < 2:
            break

        first = matches[0]
        first_key = canonical_section_marker(first.group(0))
        if first_key is None or first.start() > 4:
            break

        changed = False
        for match in matches[1:]:
            if canonical_section_marker(match.group(0)) != first_key:
                continue

            leading_body = collapsed[first.end() : match.start()].strip(" ：:;；")
            restarted_body = collapsed[match.end() :].strip(" ：:;；")
            if len(canonicalize_for_compare(leading_body)) < 24:
                continue
            if len(canonicalize_for_compare(restarted_body)) < 24:
                continue
            if not is_near_duplicate(leading_body, restarted_body):
                continue

            best_body = choose_better_duplicate_text(leading_body, restarted_body)
            collapsed = f"{collapsed[:first.end()]}{best_body}"
            changed = True
            break

        if not changed:
            break

    return collapsed.strip()


def leading_section_info(text: str) -> tuple[str, int, int] | None:
    stripped = text.lstrip()
    offset = len(text) - len(stripped)
    match = SECTION_MARKER_RE.match(stripped)
    if not match:
        return None

    key = canonical_section_marker(match.group(0))
    if not key:
        return None

    return key, offset + match.start(), offset + match.end()


def has_strong_prefix_overlap(left: str, right: str) -> bool:
    left_key = canonicalize_for_compare(left)
    right_key = canonicalize_for_compare(right)
    if len(left_key) < 18 or len(right_key) < 18:
        return False

    probe_len = max(18, int(len(left_key) * 0.68))
    probe = left_key[: min(len(left_key), probe_len)]
    if probe and probe in right_key:
        return True

    left_head = left_key[: min(len(left_key), 80)]
    right_head = right_key[: min(len(right_key), 100)]
    return SequenceMatcher(None, left_head, right_head).ratio() >= 0.74


def collapse_adjacent_section_restarts(paragraphs: list[str]) -> list[str]:
    result: list[str] = []

    for paragraph in paragraphs:
        candidate = collapse_restarted_section(paragraph)
        if not candidate:
            continue

        if result:
            previous = result[-1]
            previous_info = leading_section_info(previous)
            candidate_info = leading_section_info(candidate)
            if previous_info and candidate_info and previous_info[0] == candidate_info[0]:
                _, previous_start, previous_end = previous_info
                _, candidate_start, candidate_end = candidate_info
                previous_body = previous[previous_end:].strip(" ：:;；")
                candidate_body = candidate[candidate_end:].strip(" ：:;；")

                if is_near_duplicate(previous_body, candidate_body) or has_strong_prefix_overlap(
                    previous_body,
                    candidate_body,
                ):
                    marker = previous[previous_start:previous_end]
                    best_body = choose_better_duplicate_text(previous_body, candidate_body)
                    prefix = previous[:previous_start]
                    result[-1] = f"{prefix}{marker}{best_body}".strip()
                    continue

        result.append(candidate)

    return result


def trim_repeated_section_tail(text: str, existing_lines: list[str]) -> str:
    if not existing_lines:
        return text

    context = "\n".join(existing_lines[-12:])
    for key in REPEATED_SECTION_KEYS:
        idx = text.find(key)
        if idx <= 0 or key not in context:
            continue

        suffix = text[idx:].lstrip("，、,;； ")
        min_suffix_len = len(canonicalize_for_compare(key)) + 4
        if len(canonicalize_for_compare(suffix)) >= min_suffix_len:
            return suffix

        prefix = text[:idx].rstrip("，、,;； ")
        if len(prefix) >= 8:
            return prefix
        return ""

    return text


def should_skip_line(text: str, title: str, y: float, page_height: float) -> bool:
    if not text:
        return True
    if text == title:
        return True
    if text.isdigit():
        return True
    if y < 40 and any(keyword in text for keyword in WATERMARK_FRAGMENTS):
        return True
    if y > page_height - 20 and text.isdigit():
        return True
    if any(keyword in text for keyword in WATERMARK_KEYWORDS):
        return True
    if re.fullmatch(r"[·•\-—~]+", text):
        return True
    return False


def extract_page_lines(page: fitz.Page, title: str) -> list[TextLine]:
    raw = page.get_text("dict")
    blocks = sorted(raw["blocks"], key=lambda item: (item["bbox"][1], item["bbox"][0]))
    lines: list[TextLine] = []

    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = normalize_text("".join(span.get("text", "") for span in spans))
            text = strip_inline_watermark_fragments(text)
            if should_skip_line(text, title, block["bbox"][1], page.rect.height):
                continue
            y = min(span["bbox"][1] for span in spans) if spans else block["bbox"][1]
            lines.append(TextLine(text=text, page=page.number + 1, y=y))

    return lines


def image_rect_key(rect: fitz.Rect) -> tuple[float, float, float, float]:
    return (
        round(rect.x0, 1),
        round(rect.y0, 1),
        round(rect.x1, 1),
        round(rect.y1, 1),
    )


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


def is_significant_image_rect(page: fitz.Page, rect: fitz.Rect) -> bool:
    page_area = page.rect.width * page.rect.height
    area = rect.width * rect.height
    if area < page_area * 0.02:
        return False
    if rect.width < 120 or rect.height < 50:
        return False
    if rect.y1 < 80:
        return False
    return True


def build_repeated_image_rect_keys(doc: fitz.Document) -> set[tuple[float, float, float, float]]:
    """Ignore fixed-position image objects that behave like watermarks/backgrounds."""

    rect_page_counts: dict[tuple[float, float, float, float], int] = {}
    page_count = len(doc)
    min_repeats = max(3, int(page_count * 0.3))

    for page in doc:
        keys_on_page = {
            image_rect_key(rect)
            for rect in iter_page_image_rects(page)
            if is_significant_image_rect(page, rect)
        }
        for key in keys_on_page:
            rect_page_counts[key] = rect_page_counts.get(key, 0) + 1

    return {key for key, count in rect_page_counts.items() if count >= min_repeats}


def extract_significant_image_rects(
    page: fitz.Page,
    ignored_keys: set[tuple[float, float, float, float]] | None = None,
) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    ignored_keys = ignored_keys or set()

    for rect in iter_page_image_rects(page):
        if image_rect_key(rect) in ignored_keys:
            continue
        if is_significant_image_rect(page, rect):
            rects.append(rect)

    rects.sort(key=lambda rect: (rect.y0, rect.x0))
    return rects


def save_question_image(pix: fitz.Pixmap, absolute_base: Path) -> str:
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


def parse_answer_letters(raw: str) -> list[str]:
    letters = re.findall(r"[A-E]", raw.upper())
    deduped: list[str] = []
    for letter in letters:
        if letter not in deduped:
            deduped.append(letter)
    return deduped


def append_line(buffer: list[str], text: str) -> None:
    candidate = normalize_text(text)
    candidate = strip_inline_watermark_fragments(candidate)
    candidate = trim_repeated_section_tail(candidate, buffer)
    candidate = strip_inline_watermark_fragments(candidate)
    if not candidate:
        return

    for recent in buffer[-8:]:
        if is_near_duplicate(recent, candidate):
            return

    buffer.append(candidate)


def append_to_last_option(question: ParsedQuestion, text: str) -> None:
    candidate = normalize_text(text)
    candidate = strip_inline_watermark_fragments(candidate)
    if not candidate:
        return

    if question.options:
        question.options[-1]["text"] = merge_text(question.options[-1]["text"], candidate)
    else:
        append_line(question.stem_lines, candidate)


def detect_question_type(text: str) -> str | None:
    if "单项选择题" in text:
        return "single"
    if "多项选择题" in text:
        return "multiple"
    if "问答题" in text or "案例分析题" in text or "解答题" in text:
        return "essay"
    return None


def starts_new_stem_paragraph(text: str) -> bool:
    if text.startswith(("【背景资料】", "背景资料", "问题：", "问题:", "问答题", "案例分析题")):
        return True
    if text.startswith(("事件一：", "事件二：", "事件三：", "事件四：", "事件五：", "事件六：")):
        return True
    if re.match(r"^(?:\d+[.．、](?!\d)|[（(]\d+[）)])", text):
        return True
    return False


def starts_new_analysis_paragraph(text: str) -> bool:
    if MAJOR_ANALYSIS_RE.match(text):
        return True
    if SUB_ANALYSIS_RE.match(text):
        return True
    if text.startswith(("事件一：", "事件二：", "事件三：", "事件四：", "事件五：")):
        return True
    return False


def should_soft_merge(previous: str, current: str) -> bool:
    if not previous:
        return False
    if PURE_MAJOR_ANALYSIS_RE.match(previous):
        return False
    if previous.endswith(("。", "！", "？", "；")):
        return False
    if current.startswith(("【", "背景资料", "问题", "事件", "参考答案", "解析")):
        return False
    if MAJOR_ANALYSIS_RE.match(current) or SUB_ANALYSIS_RE.match(current):
        return False
    return True


def dedupe_paragraphs(paragraphs: list[str]) -> list[str]:
    result: list[str] = []
    for paragraph in paragraphs:
        candidate = paragraph.strip()
        if not candidate:
            continue

        duplicated = False
        for existing in result[-6:]:
            if is_near_duplicate(existing, candidate):
                if quality_score(candidate) > quality_score(existing) + 2 and len(candidate) >= len(existing):
                    result[-1] = candidate
                duplicated = True
                break

        if not duplicated:
            result.append(candidate)

    return result


def build_paragraphs(lines: list[str], mode: str) -> list[str]:
    paragraphs: list[str] = []

    for raw in lines:
        line = normalize_text(raw)
        if not line:
            continue

        force_break = (
            starts_new_stem_paragraph(line)
            if mode == "stem"
            else starts_new_analysis_paragraph(line)
        )

        if not paragraphs:
            paragraphs.append(line)
            continue

        if force_break:
            paragraphs.append(line)
            continue

        if should_soft_merge(paragraphs[-1], line):
            paragraphs[-1] = merge_text(paragraphs[-1], line)
        else:
            paragraphs.append(line)

    cleaned_paragraphs = [collapse_restarted_section(paragraph) for paragraph in paragraphs]
    collapsed_paragraphs = collapse_adjacent_section_restarts(cleaned_paragraphs)
    return dedupe_paragraphs(collapsed_paragraphs)


def clean_answer_key(text: str, question_type: str) -> str:
    cleaned = normalize_text(text)
    cleaned = strip_inline_watermark_fragments(cleaned)
    if question_type == "essay" and cleaned in {"详见解析", "见解析", "详见答案"}:
        return ""
    return cleaned


def build_answer_markdown(question: ParsedQuestion) -> str:
    answer_key = clean_answer_key(question.answer_key, question.question_type)
    analysis_paragraphs = build_paragraphs(question.analysis_lines, "analysis")
    analysis = "\n\n".join(paragraphs for paragraphs in analysis_paragraphs if paragraphs).strip()

    if question.question_type == "essay":
        sections: list[str] = []
        if answer_key:
            sections.append(f"## 参考答案\n{answer_key}")
        if analysis:
            sections.append(f"## 解析\n{analysis}")
        return apply_known_ocr_fixes("\n\n".join(sections).strip())

    sections: list[str] = []
    if answer_key:
        sections.append(f"## 正确答案\n{answer_key}")
    if analysis:
        sections.append(f"## 解析\n{analysis}")
    return apply_known_ocr_fixes("\n\n".join(sections).strip())


def finalize_question(question: ParsedQuestion, question_id: str) -> dict:
    stem_paragraphs = build_paragraphs(question.stem_lines, "stem")
    stem = apply_known_ocr_fixes("\n".join(stem_paragraphs).strip())
    answer = build_answer_markdown(question)
    correct_answers = parse_answer_letters(question.answer_key)

    data = {
        "id": question_id,
        "module": question.module,
        "difficulty": DIFFICULTY_BY_TYPE[question.question_type],
        "type": question.question_type,
        "question": stem,
        "answer": answer or "## 参考答案\n待补充",
        "tags": [
            question.subject,
            TYPE_LABELS[question.question_type],
        ],
        "source": question.source,
    }

    if question.options:
        data["options"] = question.options
    if correct_answers:
        data["correctAnswers"] = correct_answers
    if question.question_images:
        data["questionImages"] = question.question_images

    return data


def subject_group_input_dir(branch: SubjectBranch, group: SourceGroup) -> Path:
    if group.output_dir == "chapters":
        return branch.chapter_dir
    if group.output_dir == "past-exams":
        return PDF_ROOT / "past-exams" / branch.slug
    if group.output_dir == "mock-exams":
        return PDF_ROOT / "mock-exams" / branch.slug
    raise ValueError(f"Unsupported group: {group.output_dir}")


def build_module_name(branch: SubjectBranch, title: str) -> str:
    if branch.label in title:
        return title
    return f"{branch.label} · {title}"


def parse_pdf(branch: SubjectBranch, group: SourceGroup, pdf_path: Path, file_slug: str) -> list[dict]:
    title = pdf_path.stem
    module_name = build_module_name(branch, title)
    doc = fitz.open(pdf_path)
    ignored_image_rect_keys = build_repeated_image_rect_keys(doc)

    questions: list[dict] = []
    current_type = "single"
    current_question: ParsedQuestion | None = None
    current_section = "stem"
    question_sequence = 0
    seen_question_ids: set[str] = set()

    def start_question(number: int, first_text: str, page_no: int) -> ParsedQuestion:
        nonlocal current_section, question_sequence
        question_sequence += 1
        question = ParsedQuestion(
            sequence=question_sequence,
            number=number,
            module=module_name,
            subject=branch.label,
            source=group.label,
            question_type=current_type,
            pages=[page_no],
        )
        if first_text:
            append_line(question.stem_lines, first_text)
        current_section = "stem"
        return question

    def flush_current() -> None:
        nonlocal current_question
        if current_question is None:
            return

        question_id = f"{file_slug}-q{current_question.sequence:03d}"
        if question_id not in seen_question_ids:
            questions.append(finalize_question(current_question, question_id))
            seen_question_ids.add(question_id)
        current_question = None

    for page in doc:
        page_lines = extract_page_lines(page, title)
        image_spans: list[tuple[ParsedQuestion, float, float]] = []
        open_image_span: tuple[ParsedQuestion, float] | None = None

        def close_image_span(end_y: float) -> None:
            nonlocal open_image_span
            if open_image_span is None:
                return
            question_ref, start_y = open_image_span
            if end_y > start_y + 4:
                image_spans.append((question_ref, start_y, end_y))
            open_image_span = None

        def open_question_image_span(question_ref: ParsedQuestion, start_y: float) -> None:
            close_image_span(start_y)
            nonlocal open_image_span
            open_image_span = (question_ref, max(0.0, start_y))

        if current_question is not None and current_section != "analysis":
            open_image_span = (current_question, 0.0)

        for line in page_lines:
            new_type = detect_question_type(line.text)
            if new_type:
                current_type = new_type
                continue

            main_match = QUESTION_RE.match(line.text)
            option_match = OPTION_RE.match(line.text)
            answer_match = ANSWER_RE.match(line.text)
            analysis_match = ANALYSIS_RE.match(line.text)

            if main_match:
                number = int(main_match.group(1))
                rest = main_match.group(2).strip()
                should_start = current_question is None

                if current_question is not None:
                    if current_question.question_type == "essay":
                        should_start = number > current_question.number
                    elif current_question.answer_key or current_question.analysis_lines:
                        should_start = True

                if should_start:
                    close_image_span(line.y)
                    flush_current()
                    current_question = start_question(number, rest, line.page)
                    open_question_image_span(current_question, line.y)
                    continue

            if current_question is None:
                continue

            if line.page not in current_question.pages:
                current_question.pages.append(line.page)

            if answer_match:
                close_image_span(line.y)
                current_question.answer_key = clean_answer_key(
                    answer_match.group(1).strip(),
                    current_question.question_type,
                )
                current_section = "analysis"
                continue

            if analysis_match:
                close_image_span(line.y)
                append_line(current_question.analysis_lines, analysis_match.group(1).strip())
                current_section = "analysis"
                continue

            if option_match and current_question.question_type in {"single", "multiple"}:
                current_question.options.append(
                    {
                        "key": option_match.group(1),
                        "text": option_match.group(2).strip(),
                    }
                )
                current_section = "options"
                continue

            if current_section == "analysis":
                append_line(current_question.analysis_lines, line.text)
            elif current_section == "options":
                append_to_last_option(current_question, line.text)
            else:
                append_line(current_question.stem_lines, line.text)

        close_image_span(page.rect.y1)

        if current_question is not None:
            image_rects = extract_significant_image_rects(page, ignored_image_rect_keys)
            asset_dir = ASSETS_ROOT / branch.slug / group.output_dir / file_slug
            asset_dir.mkdir(parents=True, exist_ok=True)

            for rect in image_rects:
                target_question = None
                rect_height = max(rect.height, 1)
                for question_ref, start_y, end_y in image_spans:
                    overlap = max(0.0, min(rect.y1, end_y) - max(rect.y0, start_y))
                    if overlap / rect_height >= 0.55:
                        target_question = question_ref
                        break

                if target_question is None:
                    continue

                image_index = len(target_question.question_images) + 1
                clip = rect + (-10, -10, 10, 10)
                clip = clip & page.rect
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=clip, alpha=False)
                absolute_base = asset_dir / f"q{target_question.sequence:03d}-{image_index}"
                file_name = save_question_image(pix, absolute_base)
                public_path = (
                    f"/question-assets/construction/{branch.slug}/{group.output_dir}/{file_slug}/{file_name}".replace(
                        "\\",
                        "/",
                    )
                )
                target_question.question_images.append(public_path)

    flush_current()
    return questions


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def build_catalog_preview(question_text: str, question_type: str) -> str:
    single_line = re.sub(r"\s+", " ", question_text).strip()
    if not single_line:
        return question_text

    if question_type == "essay":
        limit = 220
    elif question_type == "multiple":
        limit = 160
    else:
        limit = 140

    if len(single_line) <= limit:
        return single_line

    return single_line[: limit - 3].rstrip(" ，,;；。") + "..."


def build_catalog_entries(file: str, questions: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for question in questions:
        entries.append(
            {
                "id": question["id"],
                "module": question["module"],
                "difficulty": question["difficulty"],
                "type": question["type"],
                "question": build_catalog_preview(question["question"], question["type"]),
                "tags": question["tags"],
                "source": question.get("source"),
                "file": file,
            }
        )
    return entries


def build_generated_ts(categories: list[dict]) -> None:
    module_category_map: dict[str, str] = {}
    module_subject_map: dict[str, str] = {}
    module_bucket_map: dict[str, str] = {}

    for category in categories:
        for module in category["modules"]:
            module_category_map[module] = category["category"]
            module_subject_map[module] = category["subject"]
            module_bucket_map[module] = category["bucket"]

    content = f"""// Generated by tools/pdf-pipeline/build_construction_bank.py. Do not edit manually.

export interface GeneratedBuiltinCategory {{
  category: string
  subject: string
  subjectSlug: string
  bucket: string
  files: readonly string[]
  modules: readonly string[]
  order: number
}}

export const GENERATED_BUILTIN_CATEGORIES: readonly GeneratedBuiltinCategory[] = {json.dumps(categories, ensure_ascii=False, indent=2)} as const

export const GENERATED_BUILTIN_MODULES: readonly string[] = GENERATED_BUILTIN_CATEGORIES.flatMap(
  (category) => [...category.modules],
)

export const GENERATED_BUILTIN_MODULE_CATEGORY: Record<string, string> = {json.dumps(module_category_map, ensure_ascii=False, indent=2)}

export const GENERATED_BUILTIN_MODULE_SUBJECT: Record<string, string> = {json.dumps(module_subject_map, ensure_ascii=False, indent=2)}

export const GENERATED_BUILTIN_MODULE_BUCKET: Record<string, string> = {json.dumps(module_bucket_map, ensure_ascii=False, indent=2)}
"""
    GENERATED_TS.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_TS.write_text(content + "\n", encoding="utf-8")


def clean_output_dirs() -> None:
    for path in (QUESTIONS_ROOT, ASSETS_ROOT):
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)

    for legacy in LEGACY_OUTPUTS:
        if legacy.is_dir() and legacy.exists():
            shutil.rmtree(legacy)
        elif legacy.is_file() and legacy.exists():
            legacy.unlink()


def iter_pdfs(path: Path) -> Iterable[Path]:
    pdfs = list(path.glob("*.pdf")) + list(path.glob("*.PDF"))
    for pdf in sorted({pdf.resolve() for pdf in pdfs}, key=lambda item: natural_sort_key(item.name)):
        yield pdf


def main() -> None:
    pdfs_by_pair: dict[tuple[str, str], list[Path]] = {}
    for branch in SUBJECT_BRANCHES:
        for group in SOURCE_GROUPS:
            input_dir = subject_group_input_dir(branch, group)
            pdfs_by_pair[(branch.slug, group.output_dir)] = list(iter_pdfs(input_dir))

    total_available_pdfs = sum(len(paths) for paths in pdfs_by_pair.values())
    if total_available_pdfs == 0:
        raise SystemExit(
            "[ABORT] No PDFs found under local-pdf-sources/. "
            "The existing JSON question bank was left untouched."
        )

    clean_output_dirs()

    categories: list[dict] = []
    catalog_entries: list[dict] = []
    total_questions = 0
    total_pdfs = 0

    for branch in SUBJECT_BRANCHES:
        for group in SOURCE_GROUPS:
            files: list[str] = []
            modules: list[str] = []

            for pdf_path in pdfs_by_pair[(branch.slug, group.output_dir)]:
                title = pdf_path.stem
                file_slug = slugify(f"{branch.slug}-{group.output_dir}-{title}")
                module_name = build_module_name(branch, title)
                json_rel = f"construction/{branch.slug}/{group.output_dir}/{file_slug}.json"
                json_abs = ROOT / "public" / "questions" / json_rel

                parsed_questions = parse_pdf(branch, group, pdf_path, file_slug)
                write_json(json_abs, parsed_questions)
                catalog_entries.extend(
                    build_catalog_entries(json_rel.replace("\\", "/"), parsed_questions)
                )

                files.append(json_rel.replace("\\", "/"))
                modules.append(module_name)
                total_questions += len(parsed_questions)
                total_pdfs += 1

                print(
                    f"[OK] {branch.label} / {group.label} / {title}: {len(parsed_questions)} questions"
                )

            if files:
                categories.append(
                    {
                        "category": f"{branch.label} · {group.label}",
                        "subject": branch.label,
                        "subjectSlug": branch.slug,
                        "bucket": group.label,
                        "files": files,
                        "modules": modules,
                        "order": branch.order * 10 + group.order,
                    }
                )

    write_json(CATALOG_JSON, catalog_entries)
    build_generated_ts(categories)
    print(f"[DONE] Generated {total_questions} questions across {total_pdfs} PDFs")


if __name__ == "__main__":
    main()

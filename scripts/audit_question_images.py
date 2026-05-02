#!/usr/bin/env python3
"""
Audit question image references without rebuilding PDFs.

The script focuses on image-specific risks that the structural JSON audit does
not cover: missing assets, orphaned assets, suspicious image counts, and likely
duplicate crops inside the same question.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
import re

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Pillow is optional for metadata checks
    Image = None


ROOT = Path(__file__).resolve().parent.parent
QUESTION_ROOT = ROOT / "public" / "questions" / "construction"
ASSET_ROOT = ROOT / "public" / "question-assets" / "construction"
REPORT_ROOT = ROOT / "reports"

IMAGE_CUES = (
    "\u56fe",
    "\u8868",
    "\u5982\u4e0b",
    "\u6240\u793a",
    "\u793a\u610f",
    "\u524d\u950b\u7ebf",
    "\u7f51\u7edc\u8ba1\u5212",
    "\u6a2a\u9053\u56fe",
    "\u5e73\u9762\u56fe",
    "\u7acb\u9762\u56fe",
    "\u5256\u9762",
    "\u66f2\u7ebf",
    "\u7ed3\u6784",
    "\u6846\u67b6",
)

MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")


@dataclass
class ImageIssue:
    severity: str
    code: str
    question_id: str
    file: str
    detail: str
    images: list[str]
    question: str


def load_question_files() -> list[tuple[Path, list[dict[str, Any]]]]:
    files: list[tuple[Path, list[dict[str, Any]]]] = []
    for path in sorted(QUESTION_ROOT.rglob("*.json")):
        if path.name == "catalog.json":
            continue
        files.append((path, json.loads(path.read_text(encoding="utf-8"))))
    return files


def public_image_path_to_asset(path: str) -> Path:
    normalized = path.lstrip("/")
    prefix = "question-assets/construction/"
    if normalized.startswith(prefix):
        normalized = normalized[len(prefix) :]
    return ASSET_ROOT / normalized


def question_has_image_cue(question: str) -> bool:
    return any(cue in question for cue in IMAGE_CUES)


def markdown_image_refs(markdown: Any) -> list[str]:
    refs: list[str] = []
    for match in MARKDOWN_IMAGE_RE.finditer(str(markdown or "")):
        ref = match.group(1).strip()
        if ref.startswith("/question-assets/construction/"):
            refs.append(ref)
    return refs


def image_dhash(path: Path) -> int | None:
    if Image is None:
        return None
    try:
        with Image.open(path) as image:
            gray = image.convert("L").resize((9, 8))
            pixels = list(gray.tobytes())
    except Exception:
        return None

    bits = 0
    for row in range(8):
        for col in range(8):
            left = pixels[row * 9 + col]
            right = pixels[row * 9 + col + 1]
            bits = (bits << 1) | int(left > right)
    return bits


def hamming_distance(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def collect_referenced_images(files: list[tuple[Path, list[dict[str, Any]]]]) -> set[Path]:
    refs: set[Path] = set()
    for _, questions in files:
        for question in questions:
            for image in question.get("questionImages") or []:
                refs.add(public_image_path_to_asset(image).resolve())
            for image in markdown_image_refs(question.get("answer", "")):
                refs.add(public_image_path_to_asset(image).resolve())
    return refs


def audit(prune_unreferenced: bool) -> tuple[list[ImageIssue], dict[str, Any]]:
    REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    files = load_question_files()
    issues: list[ImageIssue] = []

    question_count = 0
    image_question_count = 0
    image_ref_count = 0
    answer_image_ref_count = 0

    for path, questions in files:
        rel_file = path.relative_to(ROOT).as_posix()
        for question in questions:
            question_count += 1
            image_refs = question.get("questionImages") or []
            answer_image_refs = markdown_image_refs(question.get("answer", ""))
            all_image_refs = [*image_refs, *answer_image_refs]
            if not all_image_refs:
                continue

            image_question_count += 1
            image_ref_count += len(all_image_refs)
            answer_image_ref_count += len(answer_image_refs)
            question_text = str(question.get("question", ""))
            question_id = str(question.get("id", ""))
            question_type = str(question.get("type", ""))
            snippet = " ".join(question_text.split())[:180]
            asset_paths = [public_image_path_to_asset(image) for image in all_image_refs]

            missing = [image for image, asset in zip(all_image_refs, asset_paths) if not asset.exists()]
            if missing:
                issues.append(
                    ImageIssue(
                        severity="error",
                        code="missing_image_asset",
                        question_id=question_id,
                        file=rel_file,
                        detail="question references image files that do not exist",
                        images=missing,
                        question=snippet,
                    )
                )

            has_cue = question_has_image_cue(question_text)
            if image_refs and not has_cue:
                issues.append(
                    ImageIssue(
                        severity="review",
                        code="image_without_text_cue",
                        question_id=question_id,
                        file=rel_file,
                        detail="question has images but the stem does not mention a figure/table cue",
                        images=image_refs,
                        question=snippet,
                    )
                )

            if question_type in {"single", "multiple"} and len(image_refs) > 2:
                issues.append(
                    ImageIssue(
                        severity="review",
                        code="many_images_for_choice_question",
                        question_id=question_id,
                        file=rel_file,
                        detail="choice question has more than two images",
                        images=image_refs,
                        question=snippet,
                    )
                )

            hashes: list[tuple[str, int]] = []
            for image_ref, asset_path in zip(all_image_refs, asset_paths):
                digest = image_dhash(asset_path)
                if digest is not None:
                    hashes.append((image_ref, digest))

            near_duplicate_pairs: list[str] = []
            for index, (left_ref, left_hash) in enumerate(hashes):
                for right_ref, right_hash in hashes[index + 1 :]:
                    if hamming_distance(left_hash, right_hash) <= 6:
                        near_duplicate_pairs.append(f"{left_ref} <> {right_ref}")

            if near_duplicate_pairs:
                issues.append(
                    ImageIssue(
                        severity="review",
                        code="near_duplicate_images_in_question",
                        question_id=question_id,
                        file=rel_file,
                        detail="; ".join(near_duplicate_pairs[:5]),
                        images=image_refs,
                        question=snippet,
                    )
                )

    referenced_assets = collect_referenced_images(files)
    existing_assets = {path.resolve() for path in ASSET_ROOT.rglob("*") if path.is_file()}
    orphan_assets = sorted(existing_assets - referenced_assets)

    if prune_unreferenced:
        for asset in orphan_assets:
            asset.relative_to(ASSET_ROOT.resolve())
            asset.unlink()
        orphan_assets = []

    for orphan in orphan_assets[:200]:
        issues.append(
            ImageIssue(
                severity="review",
                code="unreferenced_image_asset",
                question_id="",
                file=orphan.relative_to(ROOT).as_posix(),
                detail="asset exists but is not referenced by any question JSON",
                images=[orphan.relative_to(ROOT).as_posix()],
                question="",
            )
        )

    summary = {
        "questions_scanned": question_count,
        "image_questions": image_question_count,
        "image_refs": image_ref_count,
        "answer_image_refs": answer_image_ref_count,
        "asset_files": len(existing_assets) if not prune_unreferenced else len(referenced_assets),
        "unreferenced_assets": len(orphan_assets),
        "issues": len(issues),
        "errors": sum(1 for issue in issues if issue.severity == "error"),
        "review": sum(1 for issue in issues if issue.severity == "review"),
    }

    return issues, summary


def write_reports(issues: list[ImageIssue], summary: dict[str, Any]) -> None:
    payload = {"summary": summary, "issues": [asdict(issue) for issue in issues]}
    (REPORT_ROOT / "question_image_audit.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# Question Image Audit",
        "",
        f"- Questions scanned: {summary['questions_scanned']}",
        f"- Questions with images: {summary['image_questions']}",
        f"- Referenced images: {summary['image_refs']}",
        f"- Answer image refs: {summary['answer_image_refs']}",
        f"- Asset files: {summary['asset_files']}",
        f"- Unreferenced assets: {summary['unreferenced_assets']}",
        f"- Issues: {summary['issues']}",
        f"- Errors: {summary['errors']}",
        f"- Review items: {summary['review']}",
        "",
        "## Samples",
        "",
    ]

    for issue in issues[:120]:
        lines.append(f"### {issue.severity.upper()} {issue.code}")
        if issue.question_id:
            lines.append(f"- Question: `{issue.question_id}`")
        lines.append(f"- File: `{issue.file}`")
        lines.append(f"- Detail: {issue.detail}")
        if issue.images:
            lines.append(f"- Images: {', '.join(issue.images[:6])}")
        if issue.question:
            lines.append(f"- Stem: {issue.question}")
        lines.append("")

    (REPORT_ROOT / "question_image_audit.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fail-on-error", action="store_true")
    parser.add_argument("--prune-unreferenced", action="store_true")
    args = parser.parse_args()

    issues, summary = audit(args.prune_unreferenced)
    write_reports(issues, summary)

    print(f"questions={summary['questions_scanned']}")
    print(f"image_questions={summary['image_questions']}")
    print(f"image_refs={summary['image_refs']}")
    print(f"answer_image_refs={summary['answer_image_refs']}")
    print(f"asset_files={summary['asset_files']}")
    print(f"unreferenced_assets={summary['unreferenced_assets']}")
    print(f"issues={summary['issues']}")
    print(f"errors={summary['errors']}")
    print(f"review={summary['review']}")
    print("report_json=reports/question_image_audit.json")
    print("report_md=reports/question_image_audit.md")

    if args.fail_on_error and summary["errors"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

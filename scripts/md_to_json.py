#!/usr/bin/env python3
"""
Markdown 题库转 JSON 脚本

Markdown 格式:
---
id: net-038
module: 网络
difficulty: 2
tags: [HTTP, 缓存]
source: 高频
---
## 题目
问题内容

## 答案
答案内容（支持代码块）

---
id: net-039
...

用法:
  python3 scripts/md_to_json.py <input.md> <module_key>
  python3 scripts/md_to_json.py questions/network_extra.md network
  python3 scripts/md_to_json.py questions/network_extra.md network --append
  python3 scripts/md_to_json.py questions/network_extra.md network --overwrite
"""

import json
import os
import re
import shutil
import sys
from datetime import datetime

QUESTIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "questions")

MODULE_FILES = {
    "network": "network.json",
    "net": "network.json",
    "perf": "perf.json",
    "performance": "perf.json",
    "css": "css.json",
    "js": "js.json",
    "react": "react.json",
    "typescript": "typescript.json",
    "ts": "typescript.json",
    "project": "project.json",
    "proj": "project.json",
    "code": "algorithm.json",
    "algorithm": "algorithm.json",
}


def get_path(module: str) -> str:
    fname = MODULE_FILES.get(module.lower())
    if not fname:
        raise ValueError(
            f"Unknown module: {module}. Known: {list(MODULE_FILES.keys())}"
        )
    return os.path.join(QUESTIONS_DIR, fname)


def fix_and_load(path: str) -> list:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    if not raw:
        return []
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # 修复截断：找最后完整对象
    last_valid = -1
    for m in re.finditer(r'"source"\s*:\s*"[^"]*"\s*\n\s*\}', raw):
        last_valid = m.end()
    if last_valid == -1:
        return []
    fixed = raw[:last_valid] + "\n]"
    try:
        data = json.loads(fixed)
        print(f"[INFO] Fixed truncated JSON: recovered {len(data)} items")
        return data
    except Exception:
        return []


def backup(path: str):
    if os.path.exists(path):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bak = path + f".bak_{ts}"
        shutil.copy2(path, bak)
        print(f"[INFO] Backup saved: {os.path.basename(bak)}")


def parse_frontmatter(block: str) -> dict:
    """解析 YAML-like frontmatter"""
    meta = {}
    for line in block.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip()
            # 解析数组 [a, b, c]
            if val.startswith("[") and val.endswith("]"):
                inner = val[1:-1]
                items = [
                    x.strip().strip('"').strip("'")
                    for x in inner.split(",")
                    if x.strip()
                ]
                meta[key] = items
            # 解析数字
            elif re.match(r"^\d+$", val):
                meta[key] = int(val)
            else:
                meta[key] = val.strip('"').strip("'")
    return meta


def parse_md(content: str) -> list:
    """
    解析 Markdown 文件，每道题格式：
    ---
    id: xxx
    module: xxx
    difficulty: 1|2|3
    tags: [tag1, tag2]
    source: 高频
    ---
    ## 题目
    问题内容

    ## 答案
    答案内容
    """
    questions = []

    # 按 frontmatter 分割（--- 开头的块）
    # 支持两种分隔方式：
    # 1. frontmatter 在 --- 和 --- 之间
    # 2. 每道题以 --- 开头的 frontmatter 块起始

    # 先按 \n---\n 或文件开头的 --- 分割出所有条目
    # 每个条目 = frontmatter + 正文
    pattern = re.compile(r"(?:^|\n)---\n(.*?)\n---\n(.*?)(?=\n---\n|\Z)", re.DOTALL)

    for match in pattern.finditer(content):
        fm_raw = match.group(1)
        body = match.group(2).strip()

        meta = parse_frontmatter(fm_raw)

        # 从正文中提取题目和答案
        # 格式：## 题目\n内容\n\n## 答案\n内容
        q_match = re.search(r"##\s*题目\s*\n(.*?)(?=\n##\s*答案|\Z)", body, re.DOTALL)
        a_match = re.search(r"##\s*答案\s*\n(.*?)$", body, re.DOTALL)

        question_text = q_match.group(1).strip() if q_match else ""
        answer_text = a_match.group(1).strip() if a_match else ""

        if not question_text and not answer_text:
            # 尝试直接用正文第一行作为问题，其余作为答案
            lines = body.splitlines()
            question_text = lines[0].lstrip("#").strip() if lines else ""
            answer_text = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

        if not meta.get("id"):
            print(f"[WARN] Skipping entry with no id: {question_text[:40]}")
            continue

        item = {
            "id": meta.get("id", ""),
            "module": meta.get("module", ""),
            "difficulty": meta.get("difficulty", 1),
            "question": question_text,
            "answer": answer_text,
            "tags": meta.get("tags", []),
            "source": meta.get("source", ""),
        }
        questions.append(item)

    if not questions:
        print("[WARN] No questions parsed. Check your markdown format.")

    return questions


def write_to_file(module: str, new_items: list, mode: str = "append"):
    """
    mode: append | overwrite
    """
    path = get_path(module)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    if mode == "overwrite":
        backup(path)
        data = new_items
    else:
        existing = fix_and_load(path)
        existing_ids = {x["id"] for x in existing}
        added, skipped = [], []
        for item in new_items:
            if item["id"] in existing_ids:
                skipped.append(item["id"])
            else:
                added.append(item)
        if skipped:
            print(f"[INFO] Skipped {len(skipped)} duplicates: {skipped}")
        backup(path)
        data = existing + added
        print(f"[INFO] Adding {len(added)} new items to existing {len(existing)}")

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(
        f"[OK] {os.path.basename(path)}: {len(data)} total (last={data[-1]['id'] if data else 'N/A'})"
    )
    return data


def status():
    targets = {
        "network.json": 60,
        "perf.json": 50,
        "css.json": 55,
        "js.json": 65,
        "react.json": 65,
        "typescript.json": 55,
        "project.json": 50,
        "algorithm.json": 50,
    }
    seen = set()
    print(f"\n{'文件':<25} {'条数':>5} {'目标':>5} {'最后ID':<20} 状态")
    print("-" * 70)
    for fname, target in targets.items():
        path = os.path.join(QUESTIONS_DIR, fname)
        data = fix_and_load(path)
        last = data[-1]["id"] if data else "N/A"
        done = "✅" if len(data) >= target else f"差{target - len(data)}道"
        print(f"{fname:<25} {len(data):>5} {target:>5} {last:<20} {done}")
    print()


# ── CLI ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] == "status":
        status()
        sys.exit(0)

    if len(sys.argv) < 3:
        print(
            "Usage: python3 scripts/md_to_json.py <input.md> <module> [--append|--overwrite]"
        )
        print("       python3 scripts/md_to_json.py status")
        sys.exit(1)

    md_file = sys.argv[1]
    module = sys.argv[2]
    mode = "append"
    if "--overwrite" in sys.argv:
        mode = "overwrite"
    elif "--append" in sys.argv:
        mode = "append"

    if not os.path.exists(md_file):
        print(f"[ERROR] File not found: {md_file}")
        sys.exit(1)

    with open(md_file, "r", encoding="utf-8") as f:
        content = f.read()

    items = parse_md(content)
    print(f"[INFO] Parsed {len(items)} questions from {md_file}")

    if items:
        write_to_file(module, items, mode=mode)
    else:
        print("[ERROR] No valid questions found, nothing written.")
        sys.exit(1)

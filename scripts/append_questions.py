#!/usr/bin/env python3
"""
题库写入辅助脚本
用法:
  python3 scripts/append_questions.py <module> <json_string>
  或直接 import 后调用 append_questions / write_questions

功能:
  1. 修复截断的 JSON 文件（自动找到最后有效对象）
  2. 安全追加新题目（去重、校验格式）
  3. 写入前备份原文件
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
    "perf": "perf.json",
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

REQUIRED_FIELDS = {"id", "module", "difficulty", "question", "answer", "tags", "source"}


def get_path(module: str) -> str:
    fname = MODULE_FILES.get(module.lower())
    if not fname:
        raise ValueError(
            f"Unknown module: {module}. Known: {list(MODULE_FILES.keys())}"
        )
    return os.path.join(QUESTIONS_DIR, fname)


def fix_and_load(path: str) -> list:
    """尝试加载 JSON，若截断则自动修复后加载"""
    if not os.path.exists(path):
        return []

    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()

    raw = raw.strip()
    if not raw:
        return []

    # 先尝试直接解析
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 修复：找到最后一个完整对象（以 "source": "..." } 结尾）
    last_valid = -1
    for m in re.finditer(r'"source"\s*:\s*"[^"]*"\s*\n\s*\}', raw):
        last_valid = m.end()

    if last_valid == -1:
        print(f"[WARN] No valid objects found in {path}, starting fresh.")
        return []

    fixed = raw[:last_valid] + "\n]"
    try:
        data = json.loads(fixed)
        print(
            f"[INFO] Fixed truncated JSON: recovered {len(data)} items from {os.path.basename(path)}"
        )
        return data
    except json.JSONDecodeError as e:
        print(f"[ERROR] Still cannot parse after fix: {e}")
        return []


def validate_item(item: dict) -> list:
    """返回校验错误列表，空列表表示合法"""
    errors = []
    for field in REQUIRED_FIELDS:
        if field not in item:
            errors.append(f"Missing field: {field}")
    if "difficulty" in item and item["difficulty"] not in (1, 2, 3):
        errors.append(f"difficulty must be 1/2/3, got: {item['difficulty']}")
    if "tags" in item and not isinstance(item["tags"], list):
        errors.append("tags must be a list")
    return errors


def backup(path: str):
    if os.path.exists(path):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        bak = path + f".bak_{ts}"
        shutil.copy2(path, bak)
        print(f"[INFO] Backup: {os.path.basename(bak)}")


def write_questions(module: str, items: list, overwrite: bool = False):
    """
    将 items 写入对应模块文件。
    overwrite=True  → 完全覆盖
    overwrite=False → 追加（自动去重）
    """
    path = get_path(module)
    os.makedirs(os.path.dirname(path), exist_ok=True)

    # 校验新数据
    bad = []
    for i, item in enumerate(items):
        errs = validate_item(item)
        if errs:
            bad.append(f"  Item[{i}] id={item.get('id', '?')}: {'; '.join(errs)}")
    if bad:
        print("[ERROR] Validation failed:")
        for b in bad:
            print(b)
        sys.exit(1)

    if overwrite:
        backup(path)
        data = items
    else:
        existing = fix_and_load(path)
        existing_ids = {x["id"] for x in existing}
        added, skipped = [], []
        for item in items:
            if item["id"] in existing_ids:
                skipped.append(item["id"])
            else:
                added.append(item)
        if skipped:
            print(
                f"[INFO] Skipped {len(skipped)} duplicate ids: {skipped[:5]}{'...' if len(skipped) > 5 else ''}"
            )
        backup(path)
        data = existing + added

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(
        f"[OK] {os.path.basename(path)}: {len(data)} total items (last={data[-1]['id']})"
    )
    return data


def status():
    """打印所有模块的当前状态"""
    seen = set()
    print(f"\n{'模块文件':<25} {'条数':>6} {'最后ID':<20} {'状态'}")
    print("-" * 65)
    for mod, fname in MODULE_FILES.items():
        if fname in seen:
            continue
        seen.add(fname)
        path = os.path.join(QUESTIONS_DIR, fname)
        try:
            data = fix_and_load(path)
            last_id = data[-1]["id"] if data else "N/A"
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
            target = targets.get(fname, "?")
            status_str = f"{len(data)}/{target}"
            done = "✅" if isinstance(target, int) and len(data) >= target else "🔧"
            print(f"{fname:<25} {len(data):>6} {last_id:<20} {status_str} {done}")
        except Exception as e:
            print(f"{fname:<25} {'ERR':>6} {str(e)[:40]}")
    print()


# ── CLI ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 scripts/append_questions.py status")
        print(
            "  python3 scripts/append_questions.py append <module> <json_file_or_inline_json>"
        )
        print("  python3 scripts/append_questions.py overwrite <module> <json_file>")
        status()
        sys.exit(0)

    cmd = sys.argv[1]

    if cmd == "status":
        status()

    elif cmd in ("append", "overwrite") and len(sys.argv) >= 4:
        module = sys.argv[2]
        src = sys.argv[3]
        # src 可以是文件路径或直接是 JSON 字符串
        if os.path.exists(src):
            with open(src, "r", encoding="utf-8") as f:
                items = json.load(f)
        else:
            items = json.loads(src)
        write_questions(module, items, overwrite=(cmd == "overwrite"))

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

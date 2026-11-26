#!/usr/bin/env python3
"""Generate the SGLang native architecture registry.

SGLang discovers native model implementations by importing every module in
``python/sglang/srt/models`` and reading its ``EntryClass`` variable. The class
names in ``EntryClass`` are the architecture names Hugging Face publishes in
``config.json`` (``architectures``).

This script parses those declarations with ``ast`` -- it never imports SGLang,
so it does not need torch or a GPU -- and writes a JSON registry that the Go
runtime embeds.

Usage:
    python3 scripts/sglang_registry_to_json.py --source /path/to/sglang
    python3 scripts/sglang_registry_to_json.py --ref v0.5.6
"""

from __future__ import annotations

import argparse
import ast
import json
import pathlib
import subprocess
import sys
import tempfile

DEFAULT_REPO = "sgl-project/sglang"
DEFAULT_MODELS_DIR = "python/sglang/srt/models"
DEFAULT_OUTPUT = "runtimes/sglang/compatibility/registry.json"


def entry_class_names(path: pathlib.Path) -> list[str]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (OSError, SyntaxError) as exc:
        print(f"warning: skipping {path}: {exc}", file=sys.stderr)
        return []

    names: list[str] = []
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        if not any(isinstance(target, ast.Name) and target.id == "EntryClass" for target in node.targets):
            continue

        value = node.value
        if isinstance(value, ast.Name):
            names.append(value.id)
        elif isinstance(value, ast.List):
            for element in value.elts:
                if isinstance(element, ast.Name):
                    names.append(element.id)
    return names


def collect(models_dir: pathlib.Path) -> dict[str, str]:
    architectures: dict[str, str] = {}
    for path in sorted(models_dir.glob("*.py")):
        for name in entry_class_names(path):
            architectures[name] = path.name
    return dict(sorted(architectures.items()))


def clone_repo(repo: str, ref: str) -> tuple[pathlib.Path, str]:
    temp_dir = pathlib.Path(tempfile.mkdtemp(prefix="sglang-registry-"))
    url = f"https://github.com/{repo}.git"
    # Fetch by ref instead of `clone --branch` so branches, tags and commit
    # SHAs all work.
    subprocess.run(["git", "init", str(temp_dir)], check=True)
    subprocess.run(["git", "-C", str(temp_dir), "remote", "add", "origin", url], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(temp_dir),
            "fetch",
            "--depth",
            "1",
            "--filter=blob:none",
            "origin",
            ref,
        ],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(temp_dir), "checkout", "FETCH_HEAD"],
        check=True,
    )
    subprocess.run(
        ["git", "-C", str(temp_dir), "sparse-checkout", "set", DEFAULT_MODELS_DIR],
        check=True,
    )
    commit = subprocess.run(
        ["git", "-C", str(temp_dir), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return temp_dir, commit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", help="Existing SGLang checkout. Skips cloning.")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub repo to clone.")
    parser.add_argument("--ref", default="main", help="Git ref to clone when --source is omitted.")
    parser.add_argument("--models-dir", default=DEFAULT_MODELS_DIR, help="Models directory inside the checkout.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Where to write the JSON registry.")
    args = parser.parse_args()

    source = pathlib.Path(args.source) if args.source else None
    commit = ""
    if source is None:
        source, commit = clone_repo(args.repo, args.ref)

    models_dir = source / args.models_dir
    if not models_dir.is_dir():
        print(f"error: {models_dir} is not a directory", file=sys.stderr)
        return 1

    if not commit:
        commit = subprocess.run(
            ["git", "-C", str(source), "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
        ).stdout.strip()

    architectures = collect(models_dir)
    if not architectures:
        print("error: no EntryClass declarations found", file=sys.stderr)
        return 1

    payload = {
        "generated_from": f"{args.repo}@{commit or args.ref}",
        "source_path": args.models_dir,
        "architectures": architectures,
    }

    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {len(architectures)} architectures to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

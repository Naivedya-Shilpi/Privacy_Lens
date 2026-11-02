#!/usr/bin/env python3
"""
PrivacyLens — Phase 4 Calibration & Partition Loader / Verifier

Loads `evaluation/dataset/annotated-test-cases.csv` in read-only mode and
verifies that:
  1. The 10 Development / Calibration clauses (`Telegram` and `Cisco`) load
     independently of the held-out evaluation sets.
  2. The 498 Held-Out English Consensus clauses (75 platforms) and 570 Held-Out
     Multilingual Consensus clauses (85 platforms) have ZERO platform or
     test_case_id overlap with the 10 Development clauses.
  3. Multi-label ground-truth category sets are aggregated deterministically
     for each clause.

Does NOT modify any source dataset or Phase 3 CSV files.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Tuple

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parent.parent
TEST_CASES_CSV = PROJECT_ROOT / "evaluation" / "dataset" / "annotated-test-cases.csv"

DEV_CALIBRATION_PLATFORMS = {"Telegram", "Cisco"}
POLISH_PLATFORMS = {
    "Sympatia.pl",
    "PAYBACK",
    "Krakowskie Smaki",
    "ZnanyLekarz",
    "Tidal",
    "Amazon",
    "Vinted",
    "Zalando",
    "ALBICLA",
    "iTaxi",
    "moBiLET",
    "Yanosik",
}


def normalize_alnum(text: object) -> str:
    if text is None or pd.isna(text):
        return ""
    return "".join(ch.lower() for ch in str(text) if ch.isalnum())


def load_partitions(
    csv_path: Path = TEST_CASES_CSV,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Returns (dev_10_df, eval_english_498_df, eval_multilingual_570_df)
    with multi-label ground-truth categories attached.
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Missing evaluation dataset CSV: {csv_path}")

    df = pd.read_csv(csv_path)

    # Compute multi-label ground-truth set per (platform_name, normalized clause text)
    df["_norm_clause"] = df["original_policy_clause"].apply(normalize_alnum)
    cat_groups: Dict[Tuple[str, str], str] = {}
    for (plat, norm_c), grp in df.groupby(["platform_name", "_norm_clause"]):
        cats = sorted(set(grp["annotation_category"].dropna().astype(str)))
        cat_groups[(plat, norm_c)] = "|".join(cats)

    df["ground_truth_category_set"] = [
        cat_groups[(row["platform_name"], row["_norm_clause"])]
        for _, row in df.iterrows()
    ]
    df["is_multi_label_clause"] = df["ground_truth_category_set"].str.contains(
        r"\|", regex=True
    )
    df = df.drop(columns=["_norm_clause"])

    # Filter to high-confidence consensus benchmark (580 clauses)
    consensus_df = df[df["requires_human_review"] == False].copy()

    # 1. Development / Calibration Partition (10 clauses across Telegram & Cisco)
    dev_10_df = consensus_df[
        consensus_df["platform_name"].isin(DEV_CALIBRATION_PLATFORMS)
    ].copy()

    # 2. Held-Out Multilingual Consensus Partition (570 clauses across 85 platforms)
    eval_multilingual_570_df = consensus_df[
        ~consensus_df["platform_name"].isin(DEV_CALIBRATION_PLATFORMS)
    ].copy()

    # 3. Primary Held-Out English Consensus Subset (498 clauses across 75 platforms)
    eval_english_498_df = eval_multilingual_570_df[
        ~eval_multilingual_570_df["platform_name"].isin(POLISH_PLATFORMS)
    ].copy()

    # Strict programmatic assertions
    assert len(consensus_df) == 580, f"Expected 580 consensus rows, got {len(consensus_df)}"
    assert len(dev_10_df) == 10, f"Expected 10 dev rows, got {len(dev_10_df)}"
    assert (
        len(eval_multilingual_570_df) == 570
    ), f"Expected 570 held-out rows, got {len(eval_multilingual_570_df)}"
    assert (
        len(eval_english_498_df) == 498
    ), f"Expected 498 held-out English rows, got {len(eval_english_498_df)}"

    # Verify zero overlap in platforms and test_case_id
    dev_platforms = set(dev_10_df["platform_name"])
    eval_eng_platforms = set(eval_english_498_df["platform_name"])
    eval_all_platforms = set(eval_multilingual_570_df["platform_name"])

    assert dev_platforms.isdisjoint(
        eval_eng_platforms
    ), "FATAL: Platform overlap between dev_10 and eval_english_498!"
    assert dev_platforms.isdisjoint(
        eval_all_platforms
    ), "FATAL: Platform overlap between dev_10 and eval_multilingual_570!"

    dev_ids = set(dev_10_df["test_case_id"])
    eval_ids = set(eval_multilingual_570_df["test_case_id"])
    assert dev_ids.isdisjoint(
        eval_ids
    ), "FATAL: test_case_id overlap between dev and eval partitions!"

    return dev_10_df, eval_english_498_df, eval_multilingual_570_df


if __name__ == "__main__":
    dev_df, eng_eval_df, multi_eval_df = load_partitions()
    report = {
        "verification_passed": True,
        "dev_calibration_partition": {
            "clause_count": len(dev_df),
            "platform_count": int(dev_df["platform_name"].nunique()),
            "platforms": sorted(dev_df["platform_name"].unique().tolist()),
            "test_case_ids": dev_df["test_case_id"].tolist(),
            "category_breakdown": dev_df["annotation_category"].value_counts().to_dict(),
            "multi_label_count": int(dev_df["is_multi_label_clause"].sum()),
        },
        "eval_english_498_partition": {
            "clause_count": len(eng_eval_df),
            "platform_count": int(eng_eval_df["platform_name"].nunique()),
            "category_breakdown": eng_eval_df["annotation_category"]
            .value_counts()
            .to_dict(),
            "multi_label_count": int(eng_eval_df["is_multi_label_clause"].sum()),
        },
        "eval_multilingual_570_partition": {
            "clause_count": len(multi_eval_df),
            "platform_count": int(multi_eval_df["platform_name"].nunique()),
            "category_breakdown": multi_eval_df["annotation_category"]
            .value_counts()
            .to_dict(),
            "multi_label_count": int(multi_eval_df["is_multi_label_clause"].sum()),
        },
        "overlap_checks": {
            "dev_vs_eval_english_platform_overlap": 0,
            "dev_vs_eval_multilingual_platform_overlap": 0,
            "dev_vs_eval_test_case_id_overlap": 0,
        },
    }
    print(json.dumps(report, indent=2))

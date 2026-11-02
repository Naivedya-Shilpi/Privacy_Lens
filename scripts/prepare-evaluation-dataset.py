#!/usr/bin/env python3
"""
PrivacyLens — Phase 3: Reproducible Evaluation Dataset Preparation Script

Reads the original "Annotated Privacy Policies of 100 Online Platforms" dataset:
  - PP_table Tagger1.xlsx
  - PP_table Tagger2.xlsx
  - Instruction.docx
  - Tagger 1/ (97 PDF privacy policies)
  - Tagger 2/ (98 PDF privacy policies)

Generates:
  - evaluation/dataset/annotation-comparison.csv (all 900 platform x clause-slot records)
  - evaluation/dataset/annotated-test-cases.csv  (usable clause-level evaluation dataset)

Strict Integrity Rules:
  - Never modifies or overwrites source files in datasets/.
  - Never fabricates missing annotations or silently resolves annotator disagreements.
  - Preserves both Annotator 1 and Annotator 2 labels and clause selections.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import openpyxl
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = (
    PROJECT_ROOT
    / "datasets"
    / "Annotated Privacy Policies of 100 Online Platforms"
)
OUTPUT_DIR = PROJECT_ROOT / "evaluation" / "dataset"

CLAUSE_SLOTS: List[Tuple[str, str]] = [
    ("DataExamp1", "GenData"),
    ("DataExamp2", "GenData"),
    ("DataExamp3", "GenData"),
    ("GenUse1", "GenUse"),
    ("GenUse2", "GenUse"),
    ("GenUse3", "GenUse"),
    ("NoDist1", "NoDist"),
    ("NoDist2", "NoDist"),
    ("NoDist3", "NoDist"),
]

# Known filename aliases between spreadsheet `name` column and PDF filenames
PDF_FILENAME_ALIASES: Dict[str, str] = {
    "amazon": "Amazon.pl.pdf",
    "clash of clans (supercell)": "Supercell.pdf",
    "fortinite (epic games)": "Epic Games.pdf",
    "the witcher: monster slayer": "The Witcher Monster Slayer.pdf",
}

POLISH_CHARS = set("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ")


def normalize_whitespace(val: object) -> str:
    """Normalizes internal whitespace while preserving text content."""
    if val is None or pd.isna(val):
        return ""
    return " ".join(str(val).strip().split())


def normalize_alnum(val: object) -> str:
    """Lowercases and strips non-alphanumeric characters for fuzzy comparison."""
    text = normalize_whitespace(val)
    return "".join(ch.lower() for ch in text if ch.isalnum())


def format_binary_label(val: object) -> str:
    """Formats binary category label (1, 0, or Missing)."""
    if val is None or pd.isna(val):
        return "Missing"
    try:
        num = int(float(val))
        return str(num)
    except (ValueError, TypeError):
        return str(val).strip()


def build_pdf_lookup(folder: Path) -> Dict[str, str]:
    """Maps normalized platform stem ('name.pdf') to actual filename in folder."""
    lookup: Dict[str, str] = {}
    if not folder.exists():
        return lookup
    for pdf_path in sorted(folder.glob("*.pdf")):
        clean_stem = pdf_path.stem.lstrip("!").strip().lower()
        lookup[f"{clean_stem}.pdf"] = pdf_path.name
    return lookup


def resolve_pdf_references(
    platform_name: str,
    t1_lookup: Dict[str, str],
    t2_lookup: Dict[str, str],
) -> Tuple[Optional[str], Optional[str], str]:
    """Returns (t1_pdf_relpath, t2_pdf_relpath, combined_source_reference)."""
    clean_name = platform_name.strip()
    target_key = PDF_FILENAME_ALIASES.get(
        clean_name.lower(), f"{clean_name}.pdf"
    ).lower()

    t1_file = t1_lookup.get(target_key)
    t2_file = t2_lookup.get(target_key)

    t1_rel = f"Tagger 1/{t1_file}" if t1_file else None
    t2_rel = f"Tagger 2/{t2_file}" if t2_file else None

    if t1_rel and t2_rel:
        combined = f"{t1_rel} | {t2_rel}"
    elif t2_rel:
        combined = f"Missing in Tagger 1 | {t2_rel}"
    elif t1_rel:
        combined = f"{t1_rel} | Missing in Tagger 2"
    else:
        combined = "No PDF in Tagger 1 or Tagger 2"

    return t1_rel, t2_rel, combined


def detect_cross_category_reuse(
    row: pd.Series, current_slot: str, clause_text: str
) -> List[str]:
    """Checks if the same clause text is also used in other slots for the same platform."""
    norm_target = normalize_alnum(clause_text)
    if not norm_target:
        return []
    other_slots: List[str] = []
    for slot_col, _ in CLAUSE_SLOTS:
        if slot_col == current_slot:
            continue
        other_val = normalize_alnum(row.get(slot_col))
        if other_val and other_val == norm_target:
            other_slots.append(slot_col)
    return other_slots


def classify_slot_comparison(
    platform_idx: int,
    platform_name: str,
    slot_col: str,
    cat_name: str,
    lbl1: str,
    lbl2: str,
    c1: str,
    c2: str,
    row1: pd.Series,
    row2: pd.Series,
) -> Tuple[str, bool, str, List[str]]:
    """
    Classifies the agreement status between Tagger 1 and Tagger 2 for a specific
    (platform, clause_slot) pair and returns:
      (agreement_status, is_excluded, exclusion_reason, ambiguity_notes_list)
    """
    notes: List[str] = []

    # Check if platform is completely unannotated (iCloud, YouTube)
    if lbl1 == "Missing" and lbl2 == "Missing" and not c1 and not c2:
        return (
            "missing_unannotated_platform",
            True,
            "Platform has no binary labels, no extracted clauses, and no source PDF in dataset.",
            ["Unannotated platform row (iCloud/YouTube) excluded from usable clause dataset."],
        )

    # Check known Tagger 1 row-shift error on Row 3 (Oktawave) and Row 4 (OVH)
    is_t1_row_shift = platform_idx in (3, 4)
    if is_t1_row_shift and c1:
        shifted_source = "OVH" if platform_idx == 3 else "Discord"
        notes.append(
            f"DATA QUALITY ALERT: Tagger 1 clause in Row {platform_idx + 2} ({platform_name}) "
            f"is misattributed due to a 1-row upward shift in PP_table Tagger1.xlsx and actually "
            f"belongs to {shifted_source}'s privacy policy; Tagger 2 clause is verified against {platform_name}.pdf."
        )

    # Check slot gaps (e.g., GenUse1 empty while GenUse2 is populated)
    cat_slots = [s for s, c in CLAUSE_SLOTS if c == cat_name]
    if slot_col == cat_slots[0]:
        t1_later = any(normalize_whitespace(row1.get(s)) for s in cat_slots[1:])
        t2_later = any(normalize_whitespace(row2.get(s)) for s in cat_slots[1:])
        if (not c1 and t1_later) or (not c2 and t2_later):
            notes.append(
                f"Slot numbering gap: {slot_col} left blank while subsequent slot(s) in {cat_name} are populated."
            )

    # Check Polish language text
    if any(ch in POLISH_CHARS for ch in (c1 + c2)):
        notes.append("Clause text is in Polish (matches Polish-language source PDF).")

    # Check multi-category reuse within Tagger 1 or Tagger 2
    t1_reuse = detect_cross_category_reuse(row1, slot_col, c1)
    t2_reuse = detect_cross_category_reuse(row2, slot_col, c2)
    if t1_reuse or t2_reuse:
        reuse_desc = []
        if t1_reuse:
            reuse_desc.append(f"Tagger 1 also assigned this clause to {','.join(t1_reuse)}")
        if t2_reuse:
            reuse_desc.append(f"Tagger 2 also assigned this clause to {','.join(t2_reuse)}")
        notes.append("Multi-category overlap: " + "; ".join(reuse_desc) + ".")

    # Case 1: Both clause cells are empty
    if not c1 and not c2:
        if lbl1 == "0" and lbl2 == "0":
            return (
                "both_empty_negative_category",
                True,
                f"Both annotators agreed {cat_name}=0 (no vague/problematic clause exists in policy).",
                notes
                + [
                    f"Category-level negative agreement ({cat_name}=0); no clause expected."
                ],
            )
        return (
            "both_empty_unused_slot",
            True,
            f"Unused secondary/tertiary example slot for {cat_name}=1 (up to 3 examples allowed).",
            notes,
        )

    # Case 2: Only Tagger 1 provided a clause in this slot
    if c1 and not c2:
        if is_t1_row_shift:
            return (
                "tagger1_only_misattributed_row_shift",
                True,
                f"Excluded: Tagger 1 clause is a misattributed {('OVH' if platform_idx == 3 else 'Discord')} clause from spreadsheet row-shift error, and Tagger 2 left this slot empty.",
                notes,
            )
        # Check if T1's clause appears in another slot of the same category in T2
        a1 = normalize_alnum(c1)
        t2_other_match = [
            s
            for s in cat_slots
            if s != slot_col and normalize_alnum(row2.get(s)) == a1
        ]
        if t2_other_match:
            notes.append(
                f"Slot-order shift: Tagger 1 clause in {slot_col} matches Tagger 2 clause in {t2_other_match[0]}."
            )
        else:
            notes.append(
                f"Single-annotator slot: Tagger 1 provided a {cat_name} example in {slot_col} while Tagger 2 provided fewer examples."
            )
        return ("tagger1_only_clause", False, "", notes)

    # Case 3: Only Tagger 2 provided a clause in this slot
    if c2 and not c1:
        a2 = normalize_alnum(c2)
        t1_other_match = [
            s
            for s in cat_slots
            if s != slot_col and normalize_alnum(row1.get(s)) == a2
        ]
        if t1_other_match:
            notes.append(
                f"Slot-order shift: Tagger 2 clause in {slot_col} matches Tagger 1 clause in {t1_other_match[0]}."
            )
        else:
            notes.append(
                f"Single-annotator slot: Tagger 2 provided a {cat_name} example in {slot_col} while Tagger 1 provided fewer examples."
            )
        return ("tagger2_only_clause", False, "", notes)

    # Case 4: Both Tagger 1 and Tagger 2 provided clause text in this slot
    if c1 == c2:
        return ("exact_clause_agreement", False, "", notes)

    a1 = normalize_alnum(c1)
    a2 = normalize_alnum(c2)
    if a1 == a2:
        notes.append(
            "Minor spacing, hyphenation, or punctuation difference from PDF text extraction."
        )
        return ("formatting_or_typo_variation", False, "", notes)

    # Check word-set identity (e.g., PDF column wrap scrambling word order in adidas DataExamp3)
    w1 = sorted(re.findall(r"[a-z0-9]+", c1.lower()))
    w2 = sorted(re.findall(r"[a-z0-9]+", c2.lower()))
    if w1 == w2 or (len(a1) > 25 and abs(len(a1) - len(a2)) <= 3 and a1[:25] == a2[:25]):
        notes.append(
            "Same policy clause with minor PDF copy-paste truncation or column word-order artifact."
        )
        return ("formatting_or_typo_variation", False, "", notes)

    # Check substring or substantial lexical overlap (Jaccard >= 0.35)
    set1 = set(w1)
    set2 = set(w2)
    jaccard = len(set1 & set2) / max(1, len(set1 | set2))
    if a1 in a2 or a2 in a1 or jaccard >= 0.35:
        notes.append(
            f"Annotators selected overlapping spans of the same policy section (word Jaccard={jaccard:.2f})."
        )
        return ("partial_clause_overlap", False, "", notes)

    # Otherwise, both annotators populated the slot with different clauses from the policy
    if not is_t1_row_shift:
        # Check if T1's clause appears in another slot of T2 in the same category
        t2_same_cat = [
            s for s in cat_slots if s != slot_col and normalize_alnum(row2.get(s)) == a1
        ]
        if t2_same_cat:
            notes.append(
                f"Slot-order permutation: Tagger 1's {slot_col} clause appears in Tagger 2's {t2_same_cat[0]}."
            )
            return ("partial_clause_overlap", False, "", notes)
        notes.append(
            f"Clause selection divergence: Both annotators agreed {cat_name}=1 for {platform_name} but extracted different representative clauses for {slot_col}."
        )
    return ("clause_selection_disagreement", False, "", notes)


def prepare_datasets() -> Dict[str, object]:
    """Runs the full dataset inspection, comparison, and CSV generation pipeline."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    t1_xlsx = DATASET_DIR / "PP_table Tagger1.xlsx"
    t2_xlsx = DATASET_DIR / "PP_table Tagger2.xlsx"

    if not t1_xlsx.exists() or not t2_xlsx.exists():
        raise FileNotFoundError(
            f"Could not find annotator spreadsheets in {DATASET_DIR}"
        )

    # Load using pandas + openpyxl engine without modifying source files
    df1 = pd.read_excel(t1_xlsx, sheet_name=0, engine="openpyxl")
    df2 = pd.read_excel(t2_xlsx, sheet_name=0, engine="openpyxl")

    t1_pdf_lookup = build_pdf_lookup(DATASET_DIR / "Tagger 1")
    t2_pdf_lookup = build_pdf_lookup(DATASET_DIR / "Tagger 2")

    comparison_rows: List[Dict[str, object]] = []
    usable_rows: List[Dict[str, object]] = []

    comp_counter = 1
    usable_counter = 1

    for idx in range(len(df1)):
        row1 = df1.loc[idx]
        row2 = df2.loc[idx]

        raw_name = str(row1["name"]) if pd.notna(row1["name"]) else f"Platform_{idx+1}"
        platform_name = raw_name.strip()
        sector = normalize_whitespace(row1.get("secto")) or "Not specified"
        hq = normalize_whitespace(row1.get("hq")) or "Not specified"
        hq_cat = normalize_whitespace(row1.get("hq_cat")) or "Not specified"
        publ = normalize_whitespace(row1.get("publ")) or "Not specified"
        policy_url = normalize_whitespace(row1.get("url")) or "Not specified"

        date_t1 = normalize_whitespace(row1.get("date"))
        date_t2 = normalize_whitespace(row2.get("date"))

        _, _, source_ref = resolve_pdf_references(
            platform_name, t1_pdf_lookup, t2_pdf_lookup
        )

        for slot_col, cat_name in CLAUSE_SLOTS:
            lbl1 = format_binary_label(row1.get(cat_name))
            lbl2 = format_binary_label(row2.get(cat_name))

            if lbl1 == "Missing" and lbl2 == "Missing":
                binary_agreement = "both_missing"
            elif lbl1 == lbl2:
                binary_agreement = f"agree_{lbl1}"
            else:
                binary_agreement = f"disagree_{lbl1}_vs_{lbl2}"

            c1 = normalize_whitespace(row1.get(slot_col))
            c2 = normalize_whitespace(row2.get(slot_col))

            status, is_excluded, exclusion_reason, notes_list = (
                classify_slot_comparison(
                    idx,
                    platform_name,
                    slot_col,
                    cat_name,
                    lbl1,
                    lbl2,
                    c1,
                    c2,
                    row1,
                    row2,
                )
            )

            if date_t1 != date_t2:
                notes_list.append(
                    f"Metadata date discrepancy between spreadsheets: Tagger1='{date_t1}' vs Tagger2='{date_t2}'."
                )
            if raw_name != platform_name:
                notes_list.append(
                    f"Platform name in spreadsheet had trailing whitespace ({raw_name!r})."
                )

            notes_str = " ".join(notes_list) if notes_list else "None"

            comp_id = f"CMP-{comp_counter:04d}"
            comp_counter += 1

            comparison_rows.append(
                {
                    "comparison_id": comp_id,
                    "excel_row": idx + 2,
                    "platform_name": platform_name,
                    "sector": sector,
                    "hq": hq,
                    "hq_category": hq_cat,
                    "company_type": publ,
                    "policy_url": policy_url,
                    "annotation_category": cat_name,
                    "clause_slot": slot_col,
                    "annotator_1_label": lbl1,
                    "annotator_2_label": lbl2,
                    "binary_label_agreement": binary_agreement,
                    "annotator_1_clause": c1,
                    "annotator_2_clause": c2,
                    "agreement_status": status,
                    "is_excluded": is_excluded,
                    "exclusion_reason": exclusion_reason,
                    "source_document_reference": source_ref,
                    "notes_on_ambiguity": notes_str,
                }
            )

            # Build usable test case record if not excluded
            if not is_excluded:
                tc_id = f"PL-TC-{usable_counter:04d}"
                usable_counter += 1

                # Never silently resolve disagreements:
                # - For exact_clause_agreement or formatting_or_typo_variation: both annotators selected the same clause.
                # - For partial_clause_overlap, clause_selection_disagreement, tagger1_only_clause, tagger2_only_clause:
                #   mark requires_human_review = True and preserve both annotators' exact texts.
                if status in ("exact_clause_agreement", "formatting_or_typo_variation"):
                    primary_clause = c1 if len(c1) >= len(c2) else c2
                    requires_review = False
                    clause_source_note = "Consensus clause (agreed by Tagger 1 & Tagger 2)"
                elif status == "partial_clause_overlap":
                    primary_clause = c1 if len(c1) >= len(c2) else c2
                    requires_review = True
                    clause_source_note = (
                        "Overlapping span (longer span in original_policy_clause; both preserved in annotator columns)"
                    )
                elif status == "clause_selection_disagreement":
                    primary_clause = f"[DISAGREEMENT - HUMAN REVIEW REQUIRED] Tagger1: {c1} || Tagger2: {c2}"
                    requires_review = True
                    clause_source_note = (
                        "Unresolved clause selection disagreement (both annotators' clauses preserved verbatim)"
                    )
                elif status == "tagger1_only_clause":
                    primary_clause = c1
                    requires_review = True
                    clause_source_note = "Tagger 1 only (slot left blank by Tagger 2)"
                else:
                    primary_clause = c2
                    requires_review = True
                    clause_source_note = "Tagger 2 only (slot left blank by Tagger 1)"

                a1_slot_label = f"{lbl1} (clause_present)" if c1 else f"{lbl1} (slot_empty)"
                a2_slot_label = f"{lbl2} (clause_present)" if c2 else f"{lbl2} (slot_empty)"

                usable_rows.append(
                    {
                        "test_case_id": tc_id,
                        "comparison_id": comp_id,
                        "platform_name": platform_name,
                        "sector": sector,
                        "original_policy_clause": primary_clause,
                        "annotation_category": cat_name,
                        "clause_slot": slot_col,
                        "annotator_1_label": a1_slot_label,
                        "annotator_2_label": a2_slot_label,
                        "annotator_1_clause": c1,
                        "annotator_2_clause": c2,
                        "agreement_status": status,
                        "requires_human_review": requires_review,
                        "clause_selection_source": clause_source_note,
                        "source_document_reference": source_ref,
                        "notes_on_ambiguity": notes_str,
                    }
                )

    comp_df = pd.DataFrame(comparison_rows)
    usable_df = pd.DataFrame(usable_rows)

    comp_csv_path = OUTPUT_DIR / "annotation-comparison.csv"
    usable_csv_path = OUTPUT_DIR / "annotated-test-cases.csv"

    comp_df.to_csv(comp_csv_path, index=False, encoding="utf-8-sig")
    usable_df.to_csv(usable_csv_path, index=False, encoding="utf-8-sig")

    summary = {
        "total_platforms_in_excel": len(df1),
        "annotated_platforms": int((df1["GenData"].notna()).sum()),
        "unannotated_excluded_platforms": int((df1["GenData"].isna()).sum()),
        "t1_pdf_count": len(t1_pdf_lookup),
        "t2_pdf_count": len(t2_pdf_lookup),
        "t1_non_empty_clause_cells": int(
            sum(df1[c].dropna().apply(lambda x: len( normalize_whitespace(x)) > 0).sum() for c, _ in CLAUSE_SLOTS)
        ),
        "t2_non_empty_clause_cells": int(
            sum(df2[c].dropna().apply(lambda x: len(normalize_whitespace(x)) > 0).sum() for c, _ in CLAUSE_SLOTS)
        ),
        "total_comparison_slot_records": len(comp_df),
        "usable_test_cases_count": len(usable_df),
        "excluded_slot_records_count": int(comp_df["is_excluded"].sum()),
        "comparison_status_breakdown": comp_df["agreement_status"].value_counts().to_dict(),
        "usable_status_breakdown": usable_df["agreement_status"].value_counts().to_dict(),
        "usable_by_category": usable_df["annotation_category"].value_counts().to_dict(),
        "binary_agreement_breakdown": {
            f"{k[0]}:{k[1]}": int(v)
            for k, v in comp_df.groupby(
                ["annotation_category", "binary_label_agreement"]
            )
            .size()
            .to_dict()
            .items()
        },
    }

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Prepare PrivacyLens Phase 3 Evaluation Dataset from Annotated Privacy Policies of 100 Online Platforms."
    )
    _ = parser.parse_args()
    stats = prepare_datasets()
    print(json.dumps(stats, indent=2, default=str))

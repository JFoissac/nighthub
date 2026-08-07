from __future__ import annotations

from collections import Counter

from common import (
    cleaned_posts_path,
    diagnostic_sample_path,
    read_csv,
    score_bucket,
    seed_labels_path,
    weak_label_and_rationale,
    write_csv,
)


def main() -> None:
    cleaned_rows = read_csv(cleaned_posts_path())
    labeled_rows = []
    diagnostic_rows = []

    for row in cleaned_rows:
        weak_score, rationale = weak_label_and_rationale(row["normalized_text"])
        severity_bucket = score_bucket(weak_score)

        labeled = {
            **row,
            "weak_score": str(weak_score),
            "final_score": str(weak_score),
            "severity_bucket": severity_bucket,
            "label_source": "weak_supervision",
            "triggered_rules": rationale,
        }
        labeled_rows.append(labeled)

        diagnostic = (
            weak_score >= 8
            or ("many_exclamations" in rationale)
            or ("partisan_attack" in rationale and weak_score <= 4)
            or ("institutional" in row["category_tags"] and weak_score < 6)
        )
        if diagnostic:
            diagnostic_rows.append(
                {
                    "row_id": row["row_id"],
                    "date": row["date"],
                    "platform": row["platform"],
                    "normalized_text": row["normalized_text"],
                    "weak_score": str(weak_score),
                    "severity_bucket": severity_bucket,
                    "triggered_rules": rationale,
                    "category_tags": row["category_tags"],
                }
            )

    write_csv(
        seed_labels_path(),
        labeled_rows,
        fieldnames=list(labeled_rows[0].keys()),
    )

    diagnostic_rows = sorted(
        diagnostic_rows,
        key=lambda row: (-int(row["weak_score"]), row["row_id"]),
    )[:1500]

    write_csv(
        diagnostic_sample_path(),
        diagnostic_rows,
        fieldnames=[
            "row_id",
            "date",
            "platform",
            "normalized_text",
            "weak_score",
            "severity_bucket",
            "triggered_rules",
            "category_tags",
        ],
    )

    print(f"Labeled {len(labeled_rows)} rows")
    print(f"Score distribution: {dict(Counter(row['final_score'] for row in labeled_rows))}")
    print(f"Diagnostic sample: {len(diagnostic_rows)} rows")


if __name__ == "__main__":
    main()

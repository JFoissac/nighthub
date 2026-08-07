from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from common import blend_model_with_weak_score, read_csv, score_bucket, seed_labels_path
from score_message import load_selected_model


def main() -> None:
    rows = read_csv(seed_labels_path())
    model_name, vectorizer, model = load_selected_model()

    distribution = Counter()
    bucket_distribution = Counter()
    top_examples = []
    low_examples = []

    for row in rows:
        vector = vectorizer.transform_one(row["normalized_text"])
        probabilities = model.predict_proba_one(vector)
        predicted_score = sum(score * prob for score, prob in probabilities.items())
        weak_score = int(row["final_score"])
        blended_score, blend_strategy = blend_model_with_weak_score(predicted_score, weak_score)
        rounded_score = int(round(blended_score))
        rounded_score = max(0, min(10, rounded_score))
        bucket = score_bucket(blended_score)

        distribution[str(rounded_score)] += 1
        bucket_distribution[bucket] += 1

        sample = {
            "row_id": row["row_id"],
            "date": row["date"],
            "platform": row["platform"],
            "score": blended_score,
            "bucket": bucket,
            "model_score_raw": round(predicted_score, 3),
            "weak_score_raw": weak_score,
            "blend_strategy": blend_strategy,
            "triggered_rules": row["triggered_rules"],
            "text": row["normalized_text"][:300],
        }
        if rounded_score >= 9 and len(top_examples) < 50:
            top_examples.append(sample)
        if rounded_score <= 1 and len(low_examples) < 50:
            low_examples.append(sample)

    summary = {
        "model_name": model_name,
        "rows_scored": len(rows),
        "score_distribution": dict(sorted(distribution.items(), key=lambda item: int(item[0]))),
        "bucket_distribution": dict(bucket_distribution),
        "top_examples": top_examples[:20],
        "low_examples": low_examples[:20],
    }

    output_path = Path(__file__).resolve().parents[1] / "artifacts" / "scored_dataset_summary.json"
    output_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import json
from collections import Counter

from common import (
    MultinomialNB,
    OneVsRestPerceptron,
    SparseTfidfVectorizer,
    baseline_model_path,
    candidate_model_path,
    confidence_bundle,
    evaluation_report_path,
    model_metrics_path,
    precision_recall_f1,
    read_csv,
    risk_flag,
    score_bucket,
    seed_labels_path,
    selected_model_path,
    stratified_split,
    write_json,
)


BUCKET_TO_INT = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "EXTREME": 3}


def rows_to_texts_and_labels(rows: list[dict[str, str]]) -> tuple[list[str], list[int]]:
    texts = [row["normalized_text"] for row in rows]
    labels = [int(row["final_score"]) for row in rows]
    return texts, labels


def evaluate_model(model_name: str, model, vectors: list[dict[int, float]], labels: list[int]) -> dict[str, object]:
    bucket_truth = []
    bucket_pred = []
    rounded_predictions = []
    expected_predictions = []
    confidence_rows = []

    for vector, label in zip(vectors, labels):
        probabilities = model.predict_proba_one(vector)
        expected_score = sum(score * prob for score, prob in probabilities.items())
        rounded_score = int(round(expected_score))
        rounded_score = max(0, min(10, rounded_score))
        expected_predictions.append(expected_score)
        rounded_predictions.append(rounded_score)
        bucket_truth.append(BUCKET_TO_INT[score_bucket(label)])
        bucket_pred.append(BUCKET_TO_INT[score_bucket(expected_score)])
        confidence_rows.append(confidence_bundle(probabilities))

    metrics = precision_recall_f1(bucket_truth, bucket_pred, [0, 1, 2, 3])
    avg_top_probability = round(
        sum(row["top_probability"] for row in confidence_rows) / len(confidence_rows),
        4,
    ) if confidence_rows else 0.0
    avg_margin = round(
        sum(row["margin"] for row in confidence_rows) / len(confidence_rows),
        4,
    ) if confidence_rows else 0.0
    mae = round(
        sum(abs(pred - truth) for pred, truth in zip(expected_predictions, labels)) / len(labels),
        4,
    ) if labels else 0.0
    exact_accuracy = round(
        sum(1 for pred, truth in zip(rounded_predictions, labels) if pred == truth) / len(labels),
        4,
    ) if labels else 0.0

    return {
        "model_name": model_name,
        "bucket_metrics": metrics,
        "mae": mae,
        "exact_accuracy": exact_accuracy,
        "avg_top_probability": avg_top_probability,
        "avg_margin": avg_margin,
    }


def export_model(path, model_name: str, vectorizer: SparseTfidfVectorizer, model, metrics: dict[str, object]) -> None:
    payload = {
        "model_name": model_name,
        "vectorizer": vectorizer.to_dict(),
        "model": model.to_dict(),
        "metrics": metrics,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def main() -> None:
    rows = read_csv(seed_labels_path())
    splits = stratified_split(rows, "severity_bucket")
    train_rows = splits["train"]
    val_rows = splits["val"]
    test_rows = splits["test"]

    train_texts, train_labels = rows_to_texts_and_labels(train_rows)
    val_texts, val_labels = rows_to_texts_and_labels(val_rows)
    test_texts, test_labels = rows_to_texts_and_labels(test_rows)

    vectorizer = SparseTfidfVectorizer.fit(train_texts, max_features=7000, min_df=2)
    train_vectors = vectorizer.transform(train_texts)
    val_vectors = vectorizer.transform(val_texts)
    test_vectors = vectorizer.transform(test_texts)

    baseline = MultinomialNB(alpha=1.0).fit(
        train_vectors,
        train_labels,
        vocab_size=len(vectorizer.vocabulary),
    )
    candidate = OneVsRestPerceptron(epochs=8, learning_rate=0.12).fit(
        train_vectors,
        train_labels,
    )

    baseline_val = evaluate_model("tfidf_multinomial_nb", baseline, val_vectors, val_labels)
    candidate_val = evaluate_model("tfidf_ovr_perceptron", candidate, val_vectors, val_labels)
    baseline_test = evaluate_model("tfidf_multinomial_nb", baseline, test_vectors, test_labels)
    candidate_test = evaluate_model("tfidf_ovr_perceptron", candidate, test_vectors, test_labels)

    candidate_better = (
        candidate_val["mae"] < baseline_val["mae"]
        or (
            candidate_val["mae"] == baseline_val["mae"]
            and candidate_val["bucket_metrics"]["macro_f1"] >= baseline_val["bucket_metrics"]["macro_f1"]
        )
    )
    selected_name = "tfidf_ovr_perceptron" if candidate_better else "tfidf_multinomial_nb"
    selected_model = candidate if selected_name == "tfidf_ovr_perceptron" else baseline
    selected_metrics = candidate_test if selected_name == "tfidf_ovr_perceptron" else baseline_test

    export_model(baseline_model_path(), "tfidf_multinomial_nb", vectorizer, baseline, baseline_test)
    export_model(candidate_model_path(), "tfidf_ovr_perceptron", vectorizer, candidate, candidate_test)
    export_model(selected_model_path(), selected_name, vectorizer, selected_model, selected_metrics)

    disagreement_count = 0
    review_flags = Counter()
    for row, vector in zip(test_rows, test_vectors):
        baseline_proba = baseline.predict_proba_one(vector)
        candidate_proba = candidate.predict_proba_one(vector)
        baseline_label = int(round(sum(score * prob for score, prob in baseline_proba.items())))
        candidate_label = int(round(sum(score * prob for score, prob in candidate_proba.items())))
        if baseline_label != candidate_label:
            disagreement_count += 1
        confidence = confidence_bundle(candidate_proba if selected_name == "tfidf_ovr_perceptron" else baseline_proba)
        action, reason = risk_flag(
            text=row["normalized_text"],
            top_probability=confidence["top_probability"],
            margin=confidence["margin"],
            entropy_value=confidence["entropy"],
            baseline_label=baseline_label,
            candidate_label=candidate_label,
        )
        review_flags[f"{action}:{reason}"] += 1

    metrics_payload = {
        "dataset": {
            "train_rows": len(train_rows),
            "validation_rows": len(val_rows),
            "test_rows": len(test_rows),
            "score_distribution": dict(Counter(row["final_score"] for row in rows)),
            "bucket_distribution": dict(Counter(row["severity_bucket"] for row in rows)),
        },
        "baseline_validation": baseline_val,
        "candidate_validation": candidate_val,
        "baseline_test": baseline_test,
        "candidate_test": candidate_test,
        "selected_model": selected_name,
        "selected_test_metrics": selected_metrics,
        "test_model_disagreements": disagreement_count,
        "risk_flag_distribution": dict(review_flags),
    }
    write_json(model_metrics_path(), metrics_payload)

    report = [
        "# Trump Criticality Model Evaluation",
        "",
        f"- Train rows: `{len(train_rows)}`",
        f"- Validation rows: `{len(val_rows)}`",
        f"- Test rows: `{len(test_rows)}`",
        f"- Selected model: `{selected_name}`",
        "",
        "## Validation Macro F1",
        "",
        f"- Baseline bucket macro_f1: `{baseline_val['bucket_metrics']['macro_f1']}`",
        f"- Candidate bucket macro_f1: `{candidate_val['bucket_metrics']['macro_f1']}`",
        "",
        "## Test MAE / Exact Accuracy / Bucket Macro F1",
        "",
        f"- Baseline: mae `{baseline_test['mae']}`, exact_accuracy `{baseline_test['exact_accuracy']}`, bucket_macro_f1 `{baseline_test['bucket_metrics']['macro_f1']}`",
        f"- Candidate: mae `{candidate_test['mae']}`, exact_accuracy `{candidate_test['exact_accuracy']}`, bucket_macro_f1 `{candidate_test['bucket_metrics']['macro_f1']}`",
        "",
        "## Confidence and Risk",
        "",
        f"- Test disagreements between baseline and candidate: `{disagreement_count}`",
        f"- Risk flags: `{dict(review_flags)}`",
        "",
        "## Caveat",
        "",
        "- These metrics are based on weak labels, so they reflect consistency with the rule engine rather than ground-truth human judgment.",
    ]
    evaluation_report_path().write_text("\n".join(report), encoding="utf-8")

    print(f"Selected model: {selected_name}")
    print(f"Wrote {model_metrics_path()}")
    print(f"Wrote {evaluation_report_path()}")


if __name__ == "__main__":
    main()

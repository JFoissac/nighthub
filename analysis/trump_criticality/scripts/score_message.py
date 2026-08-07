from __future__ import annotations

import argparse
import json

from common import (
    MultinomialNB,
    OneVsRestPerceptron,
    SparseTfidfVectorizer,
    blend_model_with_weak_score,
    confidence_bundle,
    derive_tags,
    normalize_text,
    risk_flag,
    score_bucket,
    selected_model_path,
    weak_label_and_rationale,
)


def load_selected_model():
    payload = json.loads(selected_model_path().read_text(encoding="utf-8"))
    vectorizer = SparseTfidfVectorizer.from_dict(payload["vectorizer"])
    model_name = payload["model_name"]
    if model_name == "tfidf_multinomial_nb":
        model = MultinomialNB.from_dict(payload["model"])
    else:
        model = OneVsRestPerceptron.from_dict(payload["model"])
    return model_name, vectorizer, model


def main() -> None:
    parser = argparse.ArgumentParser(description="Score a new Trump message for criticality.")
    parser.add_argument("--text", required=True, help="Message text to score")
    args = parser.parse_args()

    model_name, vectorizer, model = load_selected_model()
    text = normalize_text(args.text)
    vector = vectorizer.transform_one(text)
    probabilities = model.predict_proba_one(vector)
    predicted_score = sum(score * prob for score, prob in probabilities.items())
    predicted_label = int(round(predicted_score))
    predicted_label = max(0, min(10, predicted_label))
    confidence = confidence_bundle(probabilities)
    weak_score, weak_rationale = weak_label_and_rationale(text)
    baseline_like_label = weak_score
    blended_score, blend_strategy = blend_model_with_weak_score(predicted_score, weak_score)
    final_label = int(round(blended_score))
    final_label = max(0, min(10, final_label))
    action, reason = risk_flag(
        text=text,
        top_probability=confidence["top_probability"],
        margin=confidence["margin"],
        entropy_value=confidence["entropy"],
        baseline_label=baseline_like_label,
        candidate_label=predicted_label,
    )

    payload = {
        "model_name": model_name,
        "text": text,
        "criticality_score": blended_score,
        "criticality_score_rounded": final_label,
        "criticality_bucket": score_bucket(blended_score),
        "model_score_raw": round(predicted_score, 3),
        "weak_score_raw": weak_score,
        "blend_strategy": blend_strategy,
        "score_probabilities": {str(label): round(prob, 4) for label, prob in sorted(probabilities.items())},
        "prediction_risk": {
            "action": action,
            "reason": reason,
            **confidence,
        },
        "heuristic_crosscheck": {
            "weak_score": weak_score,
            "weak_rationale": weak_rationale,
            "derived_tags": derive_tags(text),
        },
    }
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()

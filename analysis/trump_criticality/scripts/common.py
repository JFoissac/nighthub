from __future__ import annotations

import csv
import html
import json
import math
import random
import re
from bisect import bisect_right
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[3]
PIPELINE_DIR = ROOT / "analysis" / "trump_criticality"
ARTIFACTS_DIR = PIPELINE_DIR / "artifacts"
DATA_DIR = PIPELINE_DIR / "data"

RAW_DATASET_CANDIDATES = [
    ROOT / "docs" / "djt_posts_dec2025.csv",
    ROOT / "docs" / "tweets_01-08-2021.json",
]

SEED = 42
TOKEN_RE = re.compile(r"[A-Za-z0-9%$@#']+")


def ensure_dirs() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def raw_dataset_path() -> Path:
    for path in RAW_DATASET_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError("No Trump dataset found in expected locations.")


def cleaned_posts_path() -> Path:
    return ARTIFACTS_DIR / "cleaned_posts.csv"


def drop_log_path() -> Path:
    return ARTIFACTS_DIR / "drop_log.csv"


def preprocess_summary_path() -> Path:
    return ARTIFACTS_DIR / "preprocess_summary.json"


def seed_labels_path() -> Path:
    return ARTIFACTS_DIR / "seed_labels.csv"


def manual_review_queue_path() -> Path:
    return ARTIFACTS_DIR / "manual_review_queue.csv"


def diagnostic_sample_path() -> Path:
    return ARTIFACTS_DIR / "diagnostic_sample.csv"


def eda_summary_path() -> Path:
    return ARTIFACTS_DIR / "eda_summary.json"


def eda_report_path() -> Path:
    return ARTIFACTS_DIR / "eda_report.md"


def model_metrics_path() -> Path:
    return ARTIFACTS_DIR / "model_metrics.json"


def evaluation_report_path() -> Path:
    return ARTIFACTS_DIR / "evaluation_report.md"


def baseline_model_path() -> Path:
    return ARTIFACTS_DIR / "baseline_model.json"


def candidate_model_path() -> Path:
    return ARTIFACTS_DIR / "candidate_model.json"


def selected_model_path() -> Path:
    return ARTIFACTS_DIR / "selected_model.json"


def to_bool(value: str) -> bool:
    return str(value).strip().lower() == "true"


def safe_int(value: str, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def normalize_text(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_RE.findall(text or "")]


def ngrams(tokens: list[str], n: int) -> Iterable[str]:
    for idx in range(0, max(0, len(tokens) - n + 1)):
        yield " ".join(tokens[idx : idx + n])


def percentile_rank(values: list[float], current: float) -> float:
    if not values:
        return 0.0
    lower = bisect_right(values, current)
    return lower / len(values)


def zscore_like_percentile(values: list[float], current: float) -> float:
    return round(percentile_rank(values, current), 4)


def parse_date(value: str) -> tuple[str, int | None, int | None, int | None]:
    if not value:
        return ("", None, None, None)

    candidates = [
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
    ]
    for fmt in candidates:
        try:
            dt = datetime.strptime(value, fmt)
            return (dt.isoformat(), dt.year, dt.month, dt.hour)
        except ValueError:
            continue
    return (value, None, None, None)


TOPIC_RULES = [
    ("military_escalation", re.compile(r"\b(attack|attacked|bomb|bombardment|missile|missiles|war|strike|blockade|troops|military|nuclear)\b", re.I)),
    ("geopolitics", re.compile(r"\b(iran|china|russia|ukraine|nato|north korea|israel|taiwan|gaza|palestine)\b", re.I)),
    ("institutional", re.compile(r"\b(fbi|cia|doj|justice department|supreme court|congress|senate|pentagon|treasury|fed|federal reserve|national guard)\b", re.I)),
    ("market_sensitive", re.compile(r"\b(tariff|tariffs|sanctions|trade deficit|trade war|economy|inflation|stocks|market|export controls)\b", re.I)),
    ("public_order", re.compile(r"\b(crime|riots|riot|violence|border|deport|immigration|law and order)\b", re.I)),
    ("campaign_promo", re.compile(r"\b(endorsement|re-election|vote|voter|telerally|rally|thank you|maga)\b", re.I)),
]


def derive_tags(text: str) -> list[str]:
    tags = [name for name, pattern in TOPIC_RULES if pattern.search(text or "")]
    return sorted(tags)


LOW_RULES = [
    ("promo_endorsement", re.compile(r"\b(complete and total endorsement|endorsement|re-election|telerally|thank you|great crowd|maga)\b", re.I)),
    ("personal_or_generic", re.compile(r"\b(congratulations|happy birthday|great meeting|beautiful day|good luck)\b", re.I)),
]

MID_RULES = [
    ("partisan_attack", re.compile(r"\b(cheaters|thieves|corrupt|crooked|fake news|witch hunt|hoax|rigged|enemy)\b", re.I)),
    ("culture_war", re.compile(r"\b(crime|immigration|border|voter identification|voter id|illegal aliens)\b", re.I)),
]

HIGH_RULES = [
    ("institutional", re.compile(r"\b(fbi|cia|doj|justice department|supreme court|treasury|fed|federal reserve|national guard|pentagon)\b", re.I)),
    ("market_sensitive", re.compile(r"\b(tariff|tariffs|sanctions|trade war|trade deficit|economy|inflation|export controls)\b", re.I)),
    ("geopolitical", re.compile(r"\b(iran|china|russia|ukraine|nato|north korea|israel)\b", re.I)),
    ("military", re.compile(r"\b(troops|military|strike|strikes)\b", re.I)),
]

EXTREME_RULES = [
    ("direct_escalation", re.compile(r"\b(bomb|bombardment|missile|missiles|blockade|invade|invasion|retaliation|respond immediately)\b", re.I)),
    ("crisis_signaling", re.compile(r"\b(martial law|civil war|constitutional crisis|national emergency)\b", re.I)),
    ("severe_rupture", re.compile(r"\b(secretary of state has resigned|secretary of defense has been fired|nuclear)\b", re.I)),
]

LITERAL_CONFLICT_TERMS = re.compile(r"\b(attack|attacked|war|strike|strikes)\b", re.I)
AGENCY_TERMS = re.compile(r"\b(we|i|our|my administration|united states|at my direction|i am ordering|i ordered|we will|i will|launch|launched)\b", re.I)
BENIGN_CONFLICT_CONTEXT = re.compile(
    r"\b(attack ad|attack ads|war against|war on|culture war|stock market|emergency declaration|article|opinion|bluster|good conversation|cease all shooting|waging war against|war against gangs)\b",
    re.I,
)
CALMING_CONTEXT = re.compile(r"\b(ceasefire|peace talks|agreed to cease|agreed to stop|good conversation)\b", re.I)


def style_intensity_adjustment(text: str) -> tuple[int, list[str]]:
    reasons: list[str] = []
    score = 0
    exclamations = text.count("!")
    questions = text.count("?")
    caps_words = len(re.findall(r"\b[A-Z]{4,}\b", text))

    if exclamations >= 3:
        score += 1
        reasons.append("many_exclamations")
    if questions >= 3:
        score += 1
        reasons.append("many_question_marks")
    if caps_words >= 3:
        score += 1
        reasons.append("many_all_caps_words")

    return score, reasons


def weak_label_and_rationale(text: str) -> tuple[int, str]:
    normalized = normalize_text(text)
    lower = normalized.lower()
    if not lower:
        return (0, "empty_or_non_text")

    reasons: list[str] = []
    score = 0
    benign_conflict = bool(BENIGN_CONFLICT_CONTEXT.search(lower))
    literal_conflict = bool(LITERAL_CONFLICT_TERMS.search(lower))
    direct_agency = bool(AGENCY_TERMS.search(lower))
    calming = bool(CALMING_CONTEXT.search(lower))

    if any(pattern.search(lower) for _, pattern in EXTREME_RULES):
        score = max(score, 9)
        reasons.extend(name for name, pattern in EXTREME_RULES if pattern.search(lower))
        if re.search(r"\b(iran|china|russia|north korea|israel|ukraine)\b", lower) and re.search(r"\b(attack|attacked|bomb|missile|war|blockade|invade|invasion)\b", lower) and direct_agency:
            score = 10
            reasons.append("explicit_geopolitical_escalation")

    if literal_conflict and not benign_conflict:
        if direct_agency:
            score = max(score, 8)
            reasons.append("literal_conflict_with_agency")
        else:
            score = max(score, 6)
            reasons.append("literal_conflict_reference")

    high_hits = [name for name, pattern in HIGH_RULES if pattern.search(lower)]
    if high_hits:
        reasons.extend(high_hits)
        if "military" in high_hits and "geopolitical" in high_hits:
            score = max(score, 8)
        elif "institutional" in high_hits or "market_sensitive" in high_hits:
            score = max(score, 6)
        else:
            score = max(score, 5)

    mid_hits = [name for name, pattern in MID_RULES if pattern.search(lower)]
    if mid_hits:
        reasons.extend(mid_hits)
        score = max(score, 3 if len(mid_hits) == 1 else 4)

    low_hits = [name for name, pattern in LOW_RULES if pattern.search(lower)]
    if low_hits and score == 0:
        reasons.extend(low_hits)
        score = 1

    style_score, style_reasons = style_intensity_adjustment(normalized)
    if score >= 3:
        score = min(10, score + style_score)
        reasons.extend(style_reasons)

    if benign_conflict and score >= 8:
        score = max(4, score - 3)
        reasons.append("benign_conflict_context")

    if calming and score >= 7:
        score = max(5, score - 2)
        reasons.append("calming_context")

    if "market_sensitive" in reasons and re.search(r"\b(stock market|all-time high|economy)\b", lower) and score >= 7:
        score = max(4, score - 3)
        reasons.append("non_escalatory_market_context")

    if re.search(r"\b(emergency declaration)\b", lower) and score >= 7:
        score = max(3, score - 4)
        reasons.append("administrative_emergency_context")

    if score == 0 and re.search(r"\b(great|good|nice|meeting|crowd|watch|tonight)\b", lower):
        return (1, "generic_political_chatter")

    return (score, ",".join(dict.fromkeys(reasons)) if reasons else "default_low")


def score_bucket(score: float) -> str:
    if score <= 2:
        return "LOW"
    if score <= 5:
        return "MEDIUM"
    if score <= 8:
        return "HIGH"
    return "EXTREME"


def build_impact_proxy(row: dict[str, str], platform_year_engagement: dict[tuple[str, str], list[float]]) -> tuple[float, dict[str, float | int | str]]:
    platform = row["platform"]
    year = row["year"] or "unknown"
    key = (platform, year)
    favorite_count = safe_int(row["favorite_count"])
    repost_count = safe_int(row["repost_count"])
    deleted_flag = 1 if to_bool(row["deleted_flag"]) else 0
    media_count = safe_int(row["media_count"])
    tags = row["category_tags"].split("|") if row["category_tags"] else []
    engagement = math.log1p(favorite_count) + 1.25 * math.log1p(repost_count)
    percentile = zscore_like_percentile(platform_year_engagement.get(key, []), engagement)
    tag_bonus = min(0.35, 0.08 * len([tag for tag in tags if tag in {"military_escalation", "geopolitics", "institutional", "market_sensitive", "public_order"}]))
    deletion_bonus = 0.08 if deleted_flag else 0.0
    media_bonus = 0.04 if media_count > 0 else 0.0
    score = round(min(1.0, 0.65 * percentile + tag_bonus + deletion_bonus + media_bonus), 4)
    details = {
        "engagement_percentile": percentile,
        "tag_bonus": round(tag_bonus, 4),
        "deletion_bonus": deletion_bonus,
        "media_bonus": media_bonus,
        "engagement_raw": round(engagement, 4),
    }
    return score, details


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    ensure_dirs()
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, payload: object) -> None:
    ensure_dirs()
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def stratified_split(rows: list[dict[str, str]], label_key: str, ratios: tuple[float, float, float] = (0.7, 0.15, 0.15)) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row[label_key]].append(row)

    rng = random.Random(SEED)
    train: list[dict[str, str]] = []
    val: list[dict[str, str]] = []
    test: list[dict[str, str]] = []

    for bucket in grouped.values():
        rng.shuffle(bucket)
        n = len(bucket)
        train_n = max(1, int(n * ratios[0]))
        val_n = max(1, int(n * ratios[1])) if n >= 3 else 0
        train.extend(bucket[:train_n])
        val.extend(bucket[train_n : train_n + val_n])
        test.extend(bucket[train_n + val_n :])

    return {"train": train, "val": val, "test": test}


def precision_recall_f1(y_true: list[int], y_pred: list[int], labels: list[int]) -> dict[str, object]:
    per_class = {}
    total_correct = 0
    total = len(y_true)
    confusion = {str(label): {str(other): 0 for other in labels} for label in labels}

    for truth, pred in zip(y_true, y_pred):
        confusion[str(truth)][str(pred)] += 1
        if truth == pred:
            total_correct += 1

    f1_values = []
    for label in labels:
        tp = sum(1 for truth, pred in zip(y_true, y_pred) if truth == label and pred == label)
        fp = sum(1 for truth, pred in zip(y_true, y_pred) if truth != label and pred == label)
        fn = sum(1 for truth, pred in zip(y_true, y_pred) if truth == label and pred != label)
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        support = sum(1 for truth in y_true if truth == label)
        per_class[str(label)] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": support,
        }
        f1_values.append(f1)

    return {
        "accuracy": round(total_correct / total if total else 0.0, 4),
        "macro_f1": round(sum(f1_values) / len(f1_values) if f1_values else 0.0, 4),
        "per_class": per_class,
        "confusion_matrix": confusion,
    }


@dataclass
class SparseTfidfVectorizer:
    vocabulary: dict[str, int]
    idf: dict[str, float]

    @classmethod
    def fit(cls, texts: list[str], max_features: int = 6000, min_df: int = 2) -> "SparseTfidfVectorizer":
        doc_freq: Counter[str] = Counter()
        for text in texts:
            doc_freq.update(set(tokenize(text)))

        kept = [
            token
            for token, count in doc_freq.most_common()
            if count >= min_df
        ][:max_features]

        vocabulary = {token: index for index, token in enumerate(kept)}
        total_docs = max(1, len(texts))
        idf = {
            token: math.log((1 + total_docs) / (1 + doc_freq[token])) + 1.0
            for token in kept
        }
        return cls(vocabulary=vocabulary, idf=idf)

    def transform_one(self, text: str) -> dict[int, float]:
        counts: Counter[str] = Counter(tokenize(text))
        if not counts:
            return {}

        max_tf = max(counts.values()) or 1
        features: dict[int, float] = {}
        for token, count in counts.items():
            if token not in self.vocabulary:
                continue
            tf = 0.5 + 0.5 * (count / max_tf)
            features[self.vocabulary[token]] = tf * self.idf[token]
        return features

    def transform(self, texts: list[str]) -> list[dict[int, float]]:
        return [self.transform_one(text) for text in texts]

    def to_dict(self) -> dict[str, object]:
        return {"vocabulary": self.vocabulary, "idf": self.idf}

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "SparseTfidfVectorizer":
        return cls(
            vocabulary={str(k): int(v) for k, v in dict(payload["vocabulary"]).items()},
            idf={str(k): float(v) for k, v in dict(payload["idf"]).items()},
        )


class MultinomialNB:
    def __init__(self, alpha: float = 1.0) -> None:
        self.alpha = alpha
        self.classes_: list[int] = []
        self.class_log_prior_: dict[int, float] = {}
        self.feature_log_prob_: dict[int, dict[int, float]] = {}
        self.default_log_prob_: dict[int, float] = {}

    def fit(self, vectors: list[dict[int, float]], labels: list[int], vocab_size: int) -> "MultinomialNB":
        class_counts = Counter(labels)
        feature_counts: dict[int, defaultdict[int, float]] = {
            label: defaultdict(float) for label in class_counts
        }

        for vector, label in zip(vectors, labels):
            for feature_id, value in vector.items():
                feature_counts[label][feature_id] += value

        total_docs = max(1, len(labels))
        self.classes_ = sorted(class_counts.keys())

        for label in self.classes_:
            self.class_log_prior_[label] = math.log(class_counts[label] / total_docs)
            total_feature_mass = sum(feature_counts[label].values())
            denominator = total_feature_mass + self.alpha * vocab_size
            self.default_log_prob_[label] = math.log(self.alpha / denominator)
            self.feature_log_prob_[label] = {}
            for feature_id in range(vocab_size):
                numerator = feature_counts[label].get(feature_id, 0.0) + self.alpha
                self.feature_log_prob_[label][feature_id] = math.log(numerator / denominator)
        return self

    def predict_proba_one(self, vector: dict[int, float]) -> dict[int, float]:
        scores: dict[int, float] = {}
        for label in self.classes_:
            score = self.class_log_prior_[label]
            default_log = self.default_log_prob_[label]
            for feature_id, value in vector.items():
                score += value * self.feature_log_prob_[label].get(feature_id, default_log)
            scores[label] = score

        max_score = max(scores.values())
        exp_scores = {label: math.exp(score - max_score) for label, score in scores.items()}
        total = sum(exp_scores.values()) or 1.0
        return {label: value / total for label, value in exp_scores.items()}

    def predict_one(self, vector: dict[int, float]) -> int:
        proba = self.predict_proba_one(vector)
        return max(proba.items(), key=lambda item: item[1])[0]

    def to_dict(self) -> dict[str, object]:
        return {
            "alpha": self.alpha,
            "classes": self.classes_,
            "class_log_prior": self.class_log_prior_,
            "feature_log_prob": self.feature_log_prob_,
            "default_log_prob": self.default_log_prob_,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "MultinomialNB":
        model = cls(alpha=float(payload["alpha"]))
        model.classes_ = [int(value) for value in payload["classes"]]
        model.class_log_prior_ = {int(k): float(v) for k, v in dict(payload["class_log_prior"]).items()}
        model.feature_log_prob_ = {
            int(k): {int(fk): float(fv) for fk, fv in dict(v).items()}
            for k, v in dict(payload["feature_log_prob"]).items()
        }
        model.default_log_prob_ = {int(k): float(v) for k, v in dict(payload["default_log_prob"]).items()}
        return model


class OneVsRestPerceptron:
    def __init__(self, epochs: int = 8, learning_rate: float = 0.15) -> None:
        self.epochs = epochs
        self.learning_rate = learning_rate
        self.classes_: list[int] = []
        self.weights_: dict[int, defaultdict[int, float]] = {}
        self.bias_: dict[int, float] = {}

    def fit(self, vectors: list[dict[int, float]], labels: list[int]) -> "OneVsRestPerceptron":
        self.classes_ = sorted(set(labels))
        self.weights_ = {label: defaultdict(float) for label in self.classes_}
        self.bias_ = {label: 0.0 for label in self.classes_}
        rng = random.Random(SEED)
        paired = list(zip(vectors, labels))

        for _ in range(self.epochs):
            rng.shuffle(paired)
            for vector, truth in paired:
                predicted = self.predict_one(vector)
                if predicted == truth:
                    continue
                for feature_id, value in vector.items():
                    self.weights_[truth][feature_id] += self.learning_rate * value
                    self.weights_[predicted][feature_id] -= self.learning_rate * value
                self.bias_[truth] += self.learning_rate
                self.bias_[predicted] -= self.learning_rate
        return self

    def decision_scores_one(self, vector: dict[int, float]) -> dict[int, float]:
        scores: dict[int, float] = {}
        for label in self.classes_:
            score = self.bias_[label]
            weights = self.weights_[label]
            for feature_id, value in vector.items():
                if feature_id in weights:
                    score += weights[feature_id] * value
            scores[label] = score
        return scores

    def predict_proba_one(self, vector: dict[int, float]) -> dict[int, float]:
        scores = self.decision_scores_one(vector)
        max_score = max(scores.values()) if scores else 0.0
        exp_scores = {label: math.exp(score - max_score) for label, score in scores.items()}
        total = sum(exp_scores.values()) or 1.0
        return {label: value / total for label, value in exp_scores.items()}

    def predict_one(self, vector: dict[int, float]) -> int:
        scores = self.decision_scores_one(vector)
        if not scores:
            return 0
        return max(scores.items(), key=lambda item: item[1])[0]

    def to_dict(self) -> dict[str, object]:
        return {
            "epochs": self.epochs,
            "learning_rate": self.learning_rate,
            "classes": self.classes_,
            "weights": {str(label): dict(weights) for label, weights in self.weights_.items()},
            "bias": self.bias_,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, object]) -> "OneVsRestPerceptron":
        model = cls(
            epochs=int(payload["epochs"]),
            learning_rate=float(payload["learning_rate"]),
        )
        model.classes_ = [int(value) for value in payload["classes"]]
        model.weights_ = {
            int(label): defaultdict(float, {int(fid): float(weight) for fid, weight in dict(weights).items()})
            for label, weights in dict(payload["weights"]).items()
        }
        model.bias_ = {int(label): float(bias) for label, bias in dict(payload["bias"]).items()}
        return model


def entropy(probabilities: Iterable[float]) -> float:
    values = [value for value in probabilities if value > 0]
    if not values:
        return 0.0
    return -sum(value * math.log(value, 2) for value in values)


def confidence_bundle(probabilities: dict[int, float]) -> dict[str, float]:
    ordered = sorted(probabilities.values(), reverse=True)
    top = ordered[0] if ordered else 0.0
    second = ordered[1] if len(ordered) > 1 else 0.0
    return {
        "top_probability": round(top, 4),
        "margin": round(top - second, 4),
        "entropy": round(entropy(probabilities.values()), 4),
    }


def risk_flag(
    *,
    text: str,
    top_probability: float,
    margin: float,
    entropy_value: float,
    baseline_label: int,
    candidate_label: int,
) -> tuple[str, str]:
    short_text = len(tokenize(text)) <= 6
    disagreement = baseline_label != candidate_label
    if abs(candidate_label - baseline_label) >= 4:
        return ("manual_review", "large_heuristic_model_gap")
    if disagreement and top_probability < 0.7:
        return ("manual_review", "model_disagreement")
    if top_probability < 0.6 or margin < 0.15:
        return ("manual_review", "low_confidence")
    if entropy_value > 1.15:
        return ("manual_review", "high_entropy")
    if short_text and top_probability < 0.75:
        return ("manual_review", "short_ambiguous_text")
    return ("auto", "stable_prediction")


def blend_model_with_weak_score(model_score: float, weak_score: int) -> tuple[float, str]:
    gap = abs(model_score - weak_score)
    if gap >= 4:
        blended = ((model_score) + (2 * weak_score)) / 3
        return (round(blended, 3), "weak_score_guardrail")
    blended = (0.7 * model_score) + (0.3 * weak_score)
    return (round(blended, 3), "weighted_blend")

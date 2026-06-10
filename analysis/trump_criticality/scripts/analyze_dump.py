from __future__ import annotations

from collections import Counter, defaultdict

from common import (
    eda_report_path,
    eda_summary_path,
    ngrams,
    read_csv,
    seed_labels_path,
    tokenize,
    write_json,
)


def main() -> None:
    rows = read_csv(seed_labels_path())
    yearly = Counter(row["year"] for row in rows if row["year"])
    hourly = Counter(row["hour"] for row in rows if row["hour"])
    label_counts = Counter(row["final_score"] for row in rows)
    bucket_counts = Counter(row["severity_bucket"] for row in rows)
    platform_counts = Counter(row["platform"] for row in rows)
    tags = Counter(tag for row in rows for tag in row["category_tags"].split("|") if tag)
    top_tokens = Counter()
    repeated_bigrams = Counter()
    label_examples = defaultdict(list)
    top_scored_rows = sorted(rows, key=lambda row: int(row["final_score"]), reverse=True)[:20]

    for row in rows:
        tokens = [token for token in tokenize(row["normalized_text"]) if len(token) > 3]
        top_tokens.update(tokens[:30])
        repeated_bigrams.update(ngrams(tokens, 2))
        if len(label_examples[row["severity_bucket"]]) < 3:
            label_examples[row["severity_bucket"]].append(row["normalized_text"])

    summary = {
        "row_count": len(rows),
        "platform_counts": dict(platform_counts),
        "yearly_top_15": yearly.most_common(15),
        "hourly_top_10": hourly.most_common(10),
        "score_distribution": dict(label_counts),
        "bucket_distribution": dict(bucket_counts),
        "tag_distribution": tags.most_common(20),
        "top_tokens": top_tokens.most_common(30),
        "top_bigrams": repeated_bigrams.most_common(25),
        "top_score_examples": [
            {
                "row_id": row["row_id"],
                "date": row["date"],
                "platform": row["platform"],
                "weak_score": row["final_score"],
                "bucket": row["severity_bucket"],
                "text": row["normalized_text"][:280],
            }
            for row in top_scored_rows
        ],
    }
    write_json(eda_summary_path(), summary)

    report = [
        "# Trump Dump Exploratory Analysis",
        "",
        f"- Rows analyzed: `{len(rows)}`",
        f"- Platforms: `{dict(platform_counts)}`",
        f"- Score distribution: `{dict(label_counts)}`",
        f"- Bucket distribution: `{dict(bucket_counts)}`",
        "",
        "## Main Themes",
        "",
    ]
    for tag, count in tags.most_common(10):
        report.append(f"- `{tag}`: {count}")
    report.extend(["", "## Timing", ""])
    for year, count in yearly.most_common(10):
        report.append(f"- `{year}`: {count}")
    report.extend(["", "## Repeated Language", ""])
    for phrase, count in repeated_bigrams.most_common(15):
        report.append(f"- `{phrase}`: {count}")
    report.extend(["", "## Class Examples", ""])
    for label, examples in sorted(label_examples.items()):
        report.append(f"### Bucket {label}")
        report.append("")
        for example in examples:
            report.append(f"- {example[:240]}")
        report.append("")

    eda_report_path().write_text("\n".join(report), encoding="utf-8")
    print(f"Wrote {eda_summary_path()}")
    print(f"Wrote {eda_report_path()}")


if __name__ == "__main__":
    main()

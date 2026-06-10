from __future__ import annotations

import csv
from collections import Counter, defaultdict

from common import (
    ROOT,
    build_impact_proxy,
    cleaned_posts_path,
    derive_tags,
    drop_log_path,
    ensure_dirs,
    normalize_text,
    parse_date,
    preprocess_summary_path,
    raw_dataset_path,
    safe_int,
    to_bool,
    write_csv,
    write_json,
)


def main() -> None:
    ensure_dirs()
    dataset_path = raw_dataset_path()

    cleaned_rows = []
    dropped_rows = []
    platform_year_engagement = defaultdict(list)
    total_rows = 0

    with dataset_path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for raw in reader:
            total_rows += 1
            row_id = str(total_rows)
            normalized_text = normalize_text(raw.get("text", ""))
            date_raw = raw.get("date", "")
            parsed_date, year, month, hour = parse_date(date_raw)

            if not normalized_text:
                dropped_rows.append(
                    {
                        "row_id": row_id,
                        "drop_reason": "empty_text",
                        "date": date_raw,
                        "platform": raw.get("platform", ""),
                        "text_preview": "",
                    }
                )
                continue

            cleaned = {
                "row_id": row_id,
                "source_id": raw.get("id", ""),
                "date": parsed_date,
                "platform": raw.get("platform", ""),
                "handle": raw.get("handle", ""),
                "text": raw.get("text", ""),
                "normalized_text": normalized_text,
                "favorite_count": str(safe_int(raw.get("favorite_count", "0"))),
                "repost_count": str(safe_int(raw.get("repost_count", "0"))),
                "quote_flag": str(to_bool(raw.get("quote_flag", "False"))),
                "repost_flag": str(to_bool(raw.get("repost_flag", "False"))),
                "deleted_flag": str(to_bool(raw.get("deleted_flag", "False"))),
                "word_count": str(safe_int(raw.get("word_count", "0"))),
                "hashtags": raw.get("hashtags", ""),
                "urls": raw.get("urls", ""),
                "user_mentions": raw.get("user_mentions", ""),
                "media_count": str(safe_int(raw.get("media_count", "0"))),
                "media_urls": raw.get("media_urls", ""),
                "post_url": raw.get("post_url", ""),
                "in_reply_to": raw.get("in_reply_to", ""),
                "year": str(year or ""),
                "month": str(month or ""),
                "hour": str(hour or ""),
                "char_count": str(len(normalized_text)),
                "token_count": str(len(normalized_text.split())),
                "category_tags": "|".join(derive_tags(normalized_text)),
            }
            cleaned_rows.append(cleaned)

            engagement = safe_int(cleaned["favorite_count"]) + safe_int(cleaned["repost_count"])
            platform_year_engagement[(cleaned["platform"], cleaned["year"] or "unknown")].append(engagement)

    for key, values in platform_year_engagement.items():
        values.sort()

    for row in cleaned_rows:
        impact_score, details = build_impact_proxy(row, platform_year_engagement)
        row["impact_proxy"] = str(impact_score)
        row["impact_engagement_percentile"] = str(details["engagement_percentile"])
        row["impact_tag_bonus"] = str(details["tag_bonus"])
        row["impact_deletion_bonus"] = str(details["deletion_bonus"])
        row["impact_media_bonus"] = str(details["media_bonus"])

    write_csv(
        cleaned_posts_path(),
        cleaned_rows,
        fieldnames=[
            "row_id",
            "source_id",
            "date",
            "platform",
            "handle",
            "text",
            "normalized_text",
            "favorite_count",
            "repost_count",
            "quote_flag",
            "repost_flag",
            "deleted_flag",
            "word_count",
            "hashtags",
            "urls",
            "user_mentions",
            "media_count",
            "media_urls",
            "post_url",
            "in_reply_to",
            "year",
            "month",
            "hour",
            "char_count",
            "token_count",
            "category_tags",
            "impact_proxy",
            "impact_engagement_percentile",
            "impact_tag_bonus",
            "impact_deletion_bonus",
            "impact_media_bonus",
        ],
    )

    write_csv(
        drop_log_path(),
        dropped_rows,
        fieldnames=["row_id", "drop_reason", "date", "platform", "text_preview"],
    )

    summary = {
        "dataset_path": str(dataset_path.relative_to(ROOT)),
        "output_path": str(cleaned_posts_path().relative_to(ROOT)),
        "drop_log_path": str(drop_log_path().relative_to(ROOT)),
        "input_rows": total_rows,
        "cleaned_rows": len(cleaned_rows),
        "dropped_rows": len(dropped_rows),
        "platform_counts": dict(Counter(row["platform"] for row in cleaned_rows)),
        "year_counts_top_10": Counter(row["year"] for row in cleaned_rows).most_common(10),
        "tag_counts": Counter(tag for row in cleaned_rows for tag in row["category_tags"].split("|") if tag).most_common(),
    }
    write_json(preprocess_summary_path(), summary)

    print(f"Preprocessed {len(cleaned_rows)} rows from {dataset_path.name}")
    print(f"Wrote {cleaned_posts_path()}")
    print(f"Wrote {drop_log_path()}")


if __name__ == "__main__":
    main()

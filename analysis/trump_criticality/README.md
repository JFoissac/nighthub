# Trump Criticality Pipeline

This folder contains a reproducible analysis and modeling pipeline for Donald Trump's historical social posts from 2009 onward.

The pipeline is centered on a numeric `criticality_score` from `0` to `10` based on wording only.

It also provides:

1. `criticality_bucket`
   - `LOW` for `0-2`
   - `MEDIUM` for `3-5`
   - `HIGH` for `6-8`
   - `EXTREME` for `9-10`
2. `prediction_risk`
   A confidence / uncertainty layer used to flag outputs for manual review.

## Constraints

- The current environment does not include `pandas`, `numpy`, or `scikit-learn`.
- The pipeline therefore uses Python standard library only.
- Models are intentionally interpretable and reproducible.
- Generated scores should be treated as analytical support for message tone and severity, not as claims of causal real-world impact.

## Dataset

Primary dataset:

- [docs/djt_posts_dec2025.csv](/home/dev/nighthub/docs/djt_posts_dec2025.csv)

Fallback dataset:

- [docs/tweets_01-08-2021.json](/home/dev/nighthub/docs/tweets_01-08-2021.json)

## Pipeline Steps

1. Preprocess the raw dump
2. Build suggested `0-10` labels automatically
3. Produce exploratory analysis outputs
4. Train baseline and candidate text models
5. Evaluate held-out metrics and confidence/risk behavior
6. Score new messages with a reproducible inference script

## Commands

Run from the repository root:

```bash
python3 analysis/trump_criticality/scripts/preprocess.py
python3 analysis/trump_criticality/scripts/weak_label.py
python3 analysis/trump_criticality/scripts/analyze_dump.py
python3 analysis/trump_criticality/scripts/train.py
python3 analysis/trump_criticality/scripts/infer.py --text "Iran attacked our military assets and we will respond immediately."
python3 analysis/trump_criticality/scripts/score_dataset.py
```

## Main Outputs

- `analysis/trump_criticality/artifacts/cleaned_posts.csv`
- `analysis/trump_criticality/artifacts/drop_log.csv`
- `analysis/trump_criticality/artifacts/preprocess_summary.json`
- `analysis/trump_criticality/artifacts/seed_labels.csv`
- `analysis/trump_criticality/artifacts/diagnostic_sample.csv`
- `analysis/trump_criticality/artifacts/eda_summary.json`
- `analysis/trump_criticality/artifacts/eda_report.md`
- `analysis/trump_criticality/artifacts/model_metrics.json`
- `analysis/trump_criticality/artifacts/evaluation_report.md`
- `analysis/trump_criticality/artifacts/selected_model.json`
- `analysis/trump_criticality/artifacts/scored_dataset_summary.json`

## Label Sources

## Weak Labeling Logic

The rule engine assigns a noisy `0-10` score using:

- taxonomy-driven regex rules for the 0-10 severity scale
- style-intensity cues such as all-caps emphasis and repeated punctuation
- an optional diagnostic sample for inspection, without requiring manual annotation

High-level behavior:

- endorsements, congratulations, rally promotion -> `0-2`
- harsh partisan attacks, cheating rhetoric, enemy framing -> `3-5`
- institutional, sanctions, tariffs, National Guard, Pentagon, military tension -> `6-8`
- explicit war / bomb / missile / blockade / attack rhetoric -> `9-10`

Every weakly scored row stores:

- `final_score`
- `severity_bucket`
- `triggered_rules`

This makes the weak supervision stage explainable and reproducible.

## Trained Model

The training script fits two transparent downstream models on the weak labels:

1. `tfidf_multinomial_nb`
2. `tfidf_ovr_perceptron`

The selected model predicts score probabilities over the observed weak-label values, and inference converts that distribution into:

- a numeric expected score `0-10`
- a rounded score
- a bucket `LOW / MEDIUM / HIGH / EXTREME`
- a confidence / risk flag

The final inference score is not raw model output only.

It combines:

- the weak rule-engine score
- the model score

When both disagree strongly, the weak score acts as a guardrail and the result is flagged for review.

## Dataset-Level Scoring

`score_dataset.py` runs the selected model over the weak-labeled dataset and produces:

- score distribution across the corpus
- bucket distribution
- example high-severity texts
- example low-severity texts

This is useful to sanity-check whether the model collapses too much into low severity or over-produces extreme scores.

## Explainability

Each scored message exposes:

- triggered weak rules
- weak score
- raw model score
- final blended score
- blend strategy
- confidence / review flag

## Limitations

- The model learns from noisy rule-generated labels, so good test metrics mostly measure alignment with the weak labeling scheme.
- Confidence can be over-optimistic when the rule engine and downstream model are very consistent.
- This is a wording severity scorer, not an impact model and not a causal attribution system.

## Governance

- This pipeline is for analysis and monitoring only.
- It must not be used to generate persuasive Trump-style content.
- Bias, temporal drift, labeling subjectivity, and impact overclaim risk are documented in:
  - [CODEBOOK.md](/home/dev/nighthub/analysis/trump_criticality/CODEBOOK.md)
  - [ASSUMPTIONS.md](/home/dev/nighthub/analysis/trump_criticality/ASSUMPTIONS.md)

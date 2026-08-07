# Criticality Codebook

## Goal

Assign a `criticality_score` from `0` to `10` based on wording alone.

This score reflects how aggressive, alarming, threatening, or crisis-like the text feels.

It does not attempt to estimate real-world impact.

## Score Anchors

### `0`

Plainly harmless, routine, promotional, congratulatory, or personal chatter.

Examples:

- "Thank you Michigan, incredible crowd tonight."
- "Congressman X has my Complete and Total Endorsement for Re-Election."

### `1-2`

Low-intensity political noise, self-promotion, complaints, applause lines, or emotionally charged but non-threatening rhetoric.

Examples:

- "Fake news is failing again."
- "We had a great rally tonight."

### `3-5`

Noticeably aggressive, polarizing, accusatory, or stress-inducing language, but without explicit threat or crisis escalation.

Examples:

- "The Democrats are cheaters and thieves."
- "They refuse to even consider voter identification."

### `6-8`

Strongly aggressive, institutionally serious, or public-order / market / state-sensitive wording.

Examples:

- "Massive tariffs will hit foreign steel and auto imports if talks fail."
- "The National Guard may return in a stronger form."
- "The Pentagon and Treasury are coordinating an immediate sanctions package."

### `9-10`

Explicit or near-explicit threat, war, bombs, retaliation, invasion, blockade, severe crisis signaling, or direct escalation tone.

Examples:

- "Iran attacked our military assets and we will respond immediately."
- "A naval blockade is now in effect."
- "We launch bombs on Iran."

## Annotation Rules

1. Label the wording, not the speaker's intent.
2. Do not infer hidden meaning without textual evidence.
3. Use the smallest score that honestly matches the wording.
4. Reserve `9-10` for direct escalation, war, bombs, explicit threat, or severe crisis tone.
5. If uncertain between adjacent scores, choose the lower score and mark for review.
6. Reposts and quotes inherit text-level cues but should still be reviewed if context is ambiguous.

## Prediction Risk Rules

Flag for manual review when:

- model confidence is low
- model disagreement is high
- text is unusually short or ambiguous
- wording contains both low-signal and high-signal cues
- the post falls near a class boundary

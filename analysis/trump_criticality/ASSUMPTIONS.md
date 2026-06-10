# Assumptions and Limitations

## Dataset Assumptions

- The dump is treated as a historical archive of message wording.
- The main target is perceived textual severity, not external world impact.
- Platform behavior changed over time, but the first model intentionally uses text-first features.

## Modeling Assumptions

- The first training pass uses weak labels because a gold-standard human-labeled set is not yet available.
- Weak labels are useful for building a reviewable baseline, but they can encode heuristic bias.
- The pipeline favors interpretability over complexity in the first iteration.

## Limitations

- No external event linkage dataset is required for this scorer, because the target is wording severity.
- Temporal drift is substantial across 2009-2025.
- The meaning of engagement differs between Twitter and Truth Social.
- Some highly rhetorical messages may sound severe without producing measurable external effects.

## Governance

- This tool is for analysis, monitoring, and manual-review support.
- It must not be used for persuasion or style imitation.
- Any high-stakes use should include human review, especially for predicted scores `7+`.

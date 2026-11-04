# Code extract notes

Commit: `b220448766ab4ee4c83d58a67d51f0cb5bda86c2` (2026-11-03).
`home-mixer/params/param.rs:1` last sync `2026-11-02T16:00:39Z`.

## Weight application

`xai-value-model/scoring.rs`

- `apply`: missing prediction → 0, else `score * weight`.
- `weighted_terms`: 29 named terms. Reply uses `reply_weight_for`. Dwell uses `dwell_weight_for`.
- `post_unexplored` weight zeroed unless `post_unexplored_include_out_of_network` or `in_network == Some(true)`.
- `vqv` / `quoted_vqv` weights zeroed when not eligible. Published weights are already 0.
- Video continuation terms are `P(video_open) * seconds * weight`. Home-mixer local weights hardcode those weights to 0. vm-ranker defaults are also 0.
- `offset_score`: `NEGATIVE_SCORES_OFFSET = 0.001`. Negative net is rescaled by `(net + negative_sum) / total_sum * 0.001`. Non-negative net becomes `net + 0.001`.
- `diversity_multiplier(decay, floor, k) = (1 - floor) * decay^k + floor`.
- `author_pool_counts`: k = how many higher-ordered posts share the author. Order is the pre-multiplier score vector.
- OON multiplier applies when `in_network == Some(false)`, or when in-network AND flag AND (reply OR retweet). `None` → no discount.
- Default `multiplier_pre_offset = false`: multipliers hit the offset score.
- `AuthorExplorationBonus` default 0. Added on the un-offset net, then re-offset.

## Two default tables

Home-mixer local `weights_for` (`scorers/value_model.rs`) reads param.rs but hardcodes:

- diversity off, decay 1, floor 1
- OON rescore flag false
- exploration bonus 0
- video continuation weights 0
- `post_unexplored_include_out_of_network` false

`vm_ranker_request.rs` sets `compute_value_model: true` and `value_model_id: "dpp"`.

vm-ranker literal diffs vs param.rs:

- favorite 0.5 vs 0.66
- video open 0.07 vs 0.02
- cont dwell 0.004 vs 0.006
- post unexplored 0.02 vs 0.015
- not interested -47.52 vs -52.272

Diversity / OON params exist only in `vm-ranker/params.rs`:

- enable diversity true, decay 0.5, floor 0.25
- OON 0.75, topic OON 0.5, new-user OON 0.00001, new-user age threshold 0
- in-network reply/retweet rescore true
- `ComputeValueModel` feature-switch default false, but the request field forces compute anyway
- `DppEnabled` true, theta 0.65, max selected rank 150, topic DPP false
- CLI `--dpp-enabled` default false (`vm-ranker/args.rs`). `--dpp-top-k` default 50. `--dpp-theta` CLI default 0.5, overwritten by the switch when params resolve.

## Bidirectional

`CandidateScoringInputs::bidirectional_boost_eligible`: not reply, not retweet, mutual follow.
Reply weight becomes `reply + boost` when boost != 0 and eligible. Published boost 15 → 20.
Dwell boost published 0, so dwell weight stays 0.05.
Doc: `docs/BIDIRECTIONAL_BOOST_CHANGE.md`. July 13, 2026 broad 20; July 24, 2026 set to 15. Dwell boost tested, not shipped broadly.

## Cold start

`author_cold_start.rs` + param.rs:

- enabled true
- original only, followers ≤ 50000, age ≤ 7200s, `view_count_on_home` < 200
- position among nonzero scores `< 0.97 * nonzero`
- target rank uniform in `[15, 16)` → index 15 only
- Thompson: Beta(0.75 + favs, 49.25 + impressions - favs), scale 1, then best real score among top 2 samples
- viewer arm Holdout when both Phoenix MOE codivert flags are false (they are). Holdout does not filter by author corpus.

This is separate from `AuthorExplorationBonus` (default 0).

## Sources

- Thunder 1200, skips when cached posts
- Phoenix 1000, enabled true
- SimClusters const `MAX_RESULTS = 800`, enabled true, max age hours 48
- Popular 500, enabled true
- TweetMixer 800, enabled false
- Phoenix MOE enabled false, max 0
- SID enabled false, max 800

## Selection and VF

- `TOP_K_CANDIDATES_TO_SELECT = 50`
- `MAX_POST_AGE = 48 * 60 * 60` wired into `AgeFilter`
- `VFFilter` drops `Drop`, `Tombstone`, `NotEvaluated` only
- Fair share enabled, budget `PhoenixScoresResultSize = 2800`

## Premium

No Premium/Blue multiplier in value-model weights, home-mixer scorers, or phoenix `*.py`/`*.rs` name search. Subscription ineligibility is a pre-score filter. IDV premium appears in visibility age-verification viewer profile.

## Not found

No published rank multiplier named premium or blue. No ShadowCreed string in x-algorithm. Radar methodology page scores only the 4 checks. ShadowCreed is documented on shadowbanradar.com/tweepcred-score as a separate public-signal estimate (profile 68 + activity 32), shown only when those checks are clean. 2026-11-04 research snapshot for @mate_mattt: No shadowban detected, ShadowCreed 60/100 Solid.

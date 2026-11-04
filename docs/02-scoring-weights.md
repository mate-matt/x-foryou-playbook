# 02 · 权重与公式

数字只来自公开源码，不来自二手图表。两份文件用同一套 feature switch 键，但**写在仓库里的默认字面量并不完全一样**。读的时候要分开。

| 文件 | 角色 |
| --- | --- |
| [`home-mixer/params/param.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/param.rs) | 文件头写明 `mirrored from config feature-switch defaults; last sync 2026-11-02T16:00:39Z`。本地加权分读这里。下面「主表」用这份。 |
| [`vm-ranker/params.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/params.rs) | 没有 last-sync 注释。`VMRanker` 重算价值模型时，开关没下发就用这里的字面量。多样性、站外折扣只在这份里有默认值。 |

运行时如果配置服务下发了同一个键，两边都会用下发值，仓库里的字面量只是缺省。README 说 cron 会把主要生产值镜像进仓库，并举了 `param.rs` 为例。所以本手册把 **param.rs 当作 2026-11-02 的镜像快照**，并把 vm-ranker 对不上的 5 个键单独列出来，不把它们揉成一个数。

## 先把公式说对

Phoenix 预测的是「这个读者对这条帖做出某个动作的概率」，或一个连续量（比如停留时长）。[`xai-value-model/scoring.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/scoring.rs) 里写得很直：

```text
项 = 预测值 × 权重
加权和 = 各项目之和
```

权重乘的是预测，不是这条帖已经拿到的喜欢数、转发数。源码注释和 README（2026-08-14）都点名一种误读：「1 次举报抵消 468 个喜欢」。468 正好是 `234 / 0.5`。`0.5` 是 vm-ranker 里 `FavoriteWeight` 的旧字面量；param.rs 镜像快照里喜欢的权重已经是 `0.66`。即便拿今天的 `234 / 0.66` 去除，得到的也只是两个系数的比，仍然不是「举报次数和喜欢次数可以互换」。

源码还给了两个原因，这里照意思写，不改数字：

- 举报的基线概率比喜欢低 1000 倍以上，所以权重要大，预测才影响得了排序。
- 算的是**这个读者**做这件事的概率，不是把全网的举报次数乘上去。相似的人互相影响更大。而且只有出现在 Home 时间线里的行为才进这套推荐；从群里点进来刷，对这条排序没有那份计数。

`apply` 的实现是：预测缺失就当 0，再乘权重。

## 主表 · param.rs（2026-11-02 镜像）

正向，按绝对值从大到小。

| 标识 | 默认 | feature switch |
| --- | --- | --- |
| `ShareViaCopyLinkWeight` | 20.0 | `rust_home_mixer_share_via_copy_link_weight` |
| `BidirectionalFollowReplyWeightBoost` | 15.0 | `rust_home_mixer_bidirectional_follow_reply_weight_boost` |
| `ReplyWeight` | 5.0 | `rust_home_mixer_reply_weight` |
| `QuoteWeight` | 5.0 | `rust_home_mixer_quote_weight` |
| `ShareViaDmWeight` | 5.0 | `rust_home_mixer_share_via_dm_weight` |
| `FollowAuthorWeight` | 4.0 | `rust_home_mixer_follow_author_weight` |
| `ShareWeight` | 2.0 | `rust_home_mixer_share_weight` |
| `RetweetWeight` | 1.0 | `rust_home_mixer_retweet_weight` |
| `FavoriteWeight` | 0.66 | `rust_home_mixer_favorite_weight` |
| `ContClickDwellTimeWeight` | 0.4 | `rust_home_mixer_cont_click_dwell_time_weight` |
| `ClickWeight` | 0.3 | `rust_home_mixer_click_weight` |
| `OpenLinkWeight` | 0.2 | `rust_home_mixer_open_link_weight` |
| `PhotoExpandWeight` | 0.05 | `rust_home_mixer_photo_expand_weight` |
| `DwellWeight` | 0.05 | `rust_home_mixer_dwell_weight` |
| `QuotedClickWeight` | 0.05 | `rust_home_mixer_quoted_click_weight` |
| `VideoOpenWeight` | 0.02 | `rust_home_mixer_video_open_weight` |
| `PostUnexploredWeight` | 0.015 | `rust_home_mixer_post_unexplored_weight` |
| `ContDwellTimeWeight` | 0.006 | `rust_home_mixer_cont_dwell_time_weight` |

负向：

| 标识 | 默认 | feature switch |
| --- | --- | --- |
| `ReportWeight` | −234.0 | `rust_home_mixer_report_weight` |
| `MuteAuthorWeight` | −58.8 | `rust_home_mixer_mute_author_weight` |
| `NotInterestedWeight` | −52.272 | `rust_home_mixer_not_interested_weight` |
| `BlockAuthorWeight` | −31.2 | `rust_home_mixer_block_author_weight` |
| `NotDwelledWeight` | −0.02 | `rust_home_mixer_not_dwelled_weight` |

公开默认就是 0，这一项目前不加不减：

| 标识 | 默认 |
| --- | --- |
| `ProfileClickWeight` | 0.0 |
| `VqvWeight` | 0.0 |
| `QuotedVqvWeight` | 0.0 |
| `PostVideoWeight` | 0.0 |
| `BidirectionalFollowDwellWeightBoost` | 0.0 |

`BidirectionalFollowReplyWeightBoost` 不是单独的预测头。它在条件满足时**加到回复权重上**。见下一节。

连续项（`dwell_time`、`click_dwell_time`）乘的是预测的时长，不是 0 到 1 的概率。所以 `0.006` 和 `0.4` 不能跟「喜欢 0.66」横着比大小，单位不一样。

## vm-ranker 字面量和主表对不上的 5 个键

同一条 feature switch，两份文件的缺省不同。重算价值模型、又没有配置下发时，用的是右列。

| 键 | param.rs（有 last sync） | vm-ranker/params.rs |
| --- | --- | --- |
| `FavoriteWeight` | 0.66 | 0.5 |
| `VideoOpenWeight` | 0.02 | 0.07 |
| `ContDwellTimeWeight` | 0.006 | 0.004 |
| `PostUnexploredWeight` | 0.015 | 0.02 |
| `NotInterestedWeight` | −52.272 | −47.52 |

其余主表里的权重，两份文件的字面量一致（含复制链接 20、回复 5、举报 −234、互关回复加成 15）。

只出现在 vm-ranker、主表没有的项，公开默认全是 0：`VideoContinuationWeight`、`UserVideoContinuationWeight`、`ProfileVisitSecsWeight`。公式里留了位置（视频打开概率 × 续看秒数，再乘权重），默认乘出来仍是 0。

## 互关加成怎么加上去

[`docs/BIDIRECTIONAL_BOOST_CHANGE.md`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/docs/BIDIRECTIONAL_BOOST_CHANGE.md) 和 [`xai-value-model/weights.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/weights.rs) 的 `reply_weight_for`：

- 加成不是 0，并且这条帖**不是回复、不是转帖**，作者和读者**互相关注**，回复权重变成 `ReplyWeight + Boost`。按两份文件现在的字面量，就是 `5 + 15 = 20`。
- 回复和转帖不加，即便作者是互关。
- 停留加成 `BidirectionalFollowDwellWeightBoost` 默认 0。代码要求加成不为 0 才改停留权重，所以默认路径上停留仍是 0.05。文档写明：停留加成做过实验，没有按回复加成那样铺开。
- 时间线（文档原文）：2026-07-10 小流量试过 5、10、15、20（当时多数人是 0）；07-13 许多人收到 20；07-24 改成 15。

互关标记来自 `BidirectionalFollowHydrator`：读者关注了作者，并且社交图确认作者也关注读者。`EnableBidirectionalFollowHydration` 默认 true。

## 负分被抬进一个很小的正偏移

`NEGATIVE_SCORES_OFFSET = 0.001`（`xai-value-model/weights.rs`，`home-mixer/params/config.rs` 里也有同名常量）。

`offset_score`：

- 正负权重之和为 0 时，加权和小于 0 就变成 0。
- 加权和小于 0：`(加权和 + 负向权重绝对值之和) / 全部权重绝对值之和 × 0.001`。
- 否则：`加权和 + 0.001`。

负向权重绝对值之和只加这五项：不感兴趣、屏蔽、静音、举报、未停留。复制链接这类正向权重不进这个负向之和。

## 作者多样性

只在 vm-ranker 重算时按参数生效。home-mixer 本地那一版把 `enable_author_diversity` 写死为 false，衰减和地板写死为 1.0，等于不衰减。

vm-ranker 公开默认：

| 参数 | 默认 |
| --- | --- |
| `EnableAuthorDiversity` | true |
| `AuthorDiversityDecay` | 0.5 |
| `AuthorDiversityFloor` | 0.25 |

公式（`diversity_multiplier`）：

```text
multiplier(k) = (1 - floor) × decay^k + floor
```

`k` 是同一作者里，按调整前分数从高到低，排在这条前面的帖数。第一条 `k = 0`，乘数是 1。用默认值：

| 同一作者里的名次 | k | 乘数 |
| --- | --- | --- |
| 第 1 条 | 0 | 1 |
| 第 2 条 | 1 | 0.625 |
| 第 3 条 | 2 | 0.4375 |
| 再往后 | 更大 | 往 0.25 靠 |

## 站外折扣（OON）

`post_fusion_multipliers`：站外帖（`in_network == Some(false)`）乘 `effective_oon_weight`。站内的**回复和转帖**，在 `EnableOonRescoreForInNetworkRepliesRetweets = true`（vm-ranker 默认）时也乘这个系数。站内原创不乘。`in_network` 缺失则不乘（当 1）。

`effective_oon_weight` 的取值（`vm-ranker/scoring/value_model.rs`）：

| 情况 | 默认系数 |
| --- | --- |
| 普通 For You | `OonWeightFactor = 0.75` |
| 话题请求 | `TopicOonWeightFactor = 0.5` |
| 账号年龄小于 `NewUserAgeThresholdSecs` 且关注数 ≥ 5 | `NewUserOonWeightFactor = 0.00001` |

`NewUserAgeThresholdSecs` 默认是 **0**。年龄不会小于 0，所以这条「新用户站外几乎乘成 0」的分支，在公开默认下不会打开。不要把它写成现行规则。常量 `NEW_USER_MIN_FOLLOWING = 5` 只在阈值大于 0 时才有意义。

`MultiplierPreOffset` 默认 false：多样性系数和站外系数乘在**已经加过 0.001 偏移之后的分数**上。为 true 时，先去掉偏移，只对非负的净值乘系数，负的净值不乘，再偏移回去。公开默认走前一种。

`AuthorExplorationBonus` 默认 0.0。它是按作者规则加到去偏移之后的净值上的，不是冷启动。冷启动是另一套，见下。

## 冷启动（新帖抬升）

README 说的 new-author boost，对应 [`home-mixer/scorers/author_cold_start.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/author_cold_start.rs)，不是上面那个默认 0 的 exploration bonus。

公开默认（都在 param.rs）：

| 参数 | 默认 |
| --- | --- |
| `EnableViewerColdStart` | true |
| `ColdStartImpressionThreshold` | 200 |
| `ColdStartFollowerCap` | 50000 |
| `ColdStartMaxPostAgeSecs` | 7200 |
| `ColdStartSlotMin` / `ColdStartSlotMax` | 15 / 16 |
| `LowImpressionsMaxPositionRatio` | 0.97 |
| `EnableColdStartThompsonSampling` | true |
| `ColdStartBetaAlpha0` / `ColdStartBetaBeta0` | 0.75 / 49.25 |
| `ColdStartTsTopK` | 2 |
| `ColdStartImpressionScale` | 1.0 |

一条帖要同时满足才会被考虑：原创（不是回复、不是转帖）；作者粉丝数 ≤ 50000；帖龄 ≤ 7200 秒；Home 上的展示次数 `< 200`；在非零分里的名次还没差到 `0.97 × 非零条数` 之外。

目标槽：`slot_min .. slot_max`，也就是只剩下标 15 这一个位置（第 16 名那个分数）。候选不够 16 条非零分时，这段是空的，这次不抬。被选中的那条分数变成 `max(自己的分, 目标位置的分)`。

谁被选中：默认走 Thompson sampling。用 Home 展示和喜欢数更新 Beta(0.75, 49.25)，抽出奖励，留下抽样最高的 2 条，再在这 2 条里取**真实排序分**更高的那条。喜欢数被帽在展示数之内。

读者分臂：`PhoenixMoeCodivertViewerIsTreatment` 和 `IsControl` 默认都是 false，于是臂是 Holdout。Holdout 不按作者对照桶过滤。对照/实验臂才会只抬对应桶里的作者。那两个开关默认关着。

抬升下标会随着请求送到 vm-ranker。价值模型重算时，`apply_cold_start_decisions` 可以再次把该下标的分数抬到目标名次。

## DPP 重排

README：VMRanker 用候选嵌入做一个 determinantal point process，用掉一点分数，换相邻帖不要太像。

源码要两层都开，才会真的跑：

- 进程参数 `--dpp-enabled`，[`vm-ranker/args.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/args.rs) 默认 **false**。没这个上下文，后面的开关不会单独把 DPP 叫起来。
- feature switch `DppEnabled` 默认 **true**；话题流还要 `TopicDppEnabled`，默认 false，所以话题请求默认不做 DPP。
- `DppTheta = 0.65`，`DppMaxSelectedRank = 150`。
- `--dpp-top-k` 的进程默认是 50；`--dpp-theta` 进程默认 0.5，但一旦读到 feature switch，theta 会被开关盖成 0.65。

仓库没有写生产进程是否带了 `--dpp-enabled`。本手册只写：README 描述了 DPP；公开默认里，开关是开的，进程旗标是关的。不要把「一定在做 DPP」写成已核对的事实。

`WeightPerturbationSigma` 默认 0，权重扰动默认不发生。`UserDebiasEnabled` 默认 false。

## Premium / Blue

在已公开的价值模型权重、`home-mixer/scorers/`、以及 `phoenix/` 的检索里，**没有** Premium 或 Blue 认证作为排序乘数。

订阅和 Premium 出现在可见性一侧：订户专属帖进不了未订阅读者的候选（`IneligibleSubscriptionFilter`），年龄验证里有 IDV Premium 这样的观众属性。那是「给不给看」，不是把分数乘一个蓝标系数。若生产模型在未公开的特征里用了认证，这份仓库没有写出那个乘数。这里记为：**公开打分权重中不存在。**

## 2026 年 10 月 README 里和排序有关的更新

- 10 月 8 日：Phoenix 排序模型把「你会在这条帖上花多久」估得更好，见 `phoenix/xrex/models/loss_recsys.py`、`recsys_model.py`。
- 10 月 13 日：Phoenix 召回也开始朝「有人会读完」训练，见 `phoenix/xrex/models/recsys_two_tower_model.py`。
- 10 月 26 日：`Brazil2026ElectionFilter` 已从 For You 移除。不要把它写成仍在过滤。

这些是训练目标的变化，不是 param.rs 里某一格权重被改成了新的公开数字。仓库没有在这次更新里给出一套新的权重表。

# 02 · 权重与公式

这里列出的数字全部来自官方开源代码，不参考任何二手图表。代码库里有两份核心参数文件，它们共用同一套 feature switch key，但**写死在仓库代码里的默认字面量并不完全一致**，阅读时需要区分开来。

| 文件 | 角色 |
| --- | --- |
| [`home-mixer/params/param.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/param.rs) | 文件头明确标注了 `mirrored from config feature-switch defaults; last sync 2026-11-02T16:00:39Z`。本地加权打分就是读取这里的配置，下文的「主表」也以这份文件为准。 |
| [`vm-ranker/params.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/params.rs) | 没有 last-sync 同步注释。当 `VMRanker` 重新计算价值模型且线上配置没下发时，会回退使用这里的字面量。多样性衰减和站外折扣的默认值只存在于这份文件中。 |

在生产运行时，如果配置服务下发了对应 key 的值，两边都会优先使用动态下发的值，仓库里的字面量仅仅是兜底默认值。README 提到系统有定时任务（cron）会把线上主力生产配置镜像同步到仓库，并特别拿 `param.rs` 举了例。因此，本文把 **param.rs 视为 2026-11-02 的镜像快照**；至于 vm-ranker 中对不上的 5 个 key，我们会单独列出对比，而不是简单粗暴地混为一个数字。

## 先把公式说对

Phoenix 模型预测的本质上是「当前读者对这条推文做出某种行为的概率」，或者是一个连续数值（比如停留时长）。[`xai-value-model/scoring.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/scoring.rs) 里的打分逻辑非常直白：

```text
项 = 预测值 × 权重
加权和 = 各项目之和
```

这里要注意：权重乘的是**模型预测的概率**，而不是这条推文已经累计获得的喜欢数或转推数。官方源码注释和 2026-08-14 的 README 都专门辟谣了一种常见误读，即所谓的「被举报 1 次相当于抵消 468 个喜欢」。468 这个数正好是 `234 / 0.5`，其中 `0.5` 只是 vm-ranker 里 `FavoriteWeight` 早期写死的字面量，而在 param.rs 的最新镜像快照里，喜欢的权重早就变成了 `0.66`。退一步说，就算拿现在的 `234 / 0.66` 去算，除出来的也只是两个模型特征权重的比例，绝不能理解成「线上举报次数和喜欢次数能直接 1:1 抵消」。

关于这一点，源码给出了两个核心逻辑，意思大致如下（保留数值）：

- 用户举报的基线先验概率比点赞喜欢低 1000 倍以上，所以权重的绝对值必须给得足够大，模型的预测值才能真正对排序产生影响。
- 打分算的是**眼前这位特定读者**发生该行为的概率，而不是把全网已经产生的举报数直接乘进去。协同过滤中兴趣相似的人群影响更大；而且只有发生在 Home 信息流中的行为才会计入这套推荐模型，如果是从群组或外链点进来看推，根本不会计入这个排序的特征统计。

代码中 `apply` 的具体实现也很直接：如果某个预测项缺失，就当作 0 处理，然后再乘以对应权重。

## 主表 · param.rs（2026-11-02 镜像）

正向权重（按绝对值从大到小排列）：

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

负向权重：

| 标识 | 默认 | feature switch |
| --- | --- | --- |
| `ReportWeight` | −234.0 | `rust_home_mixer_report_weight` |
| `MuteAuthorWeight` | −58.8 | `rust_home_mixer_mute_author_weight` |
| `NotInterestedWeight` | −52.272 | `rust_home_mixer_not_interested_weight` |
| `BlockAuthorWeight` | −31.2 | `rust_home_mixer_block_author_weight` |
| `NotDwelledWeight` | −0.02 | `rust_home_mixer_not_dwelled_weight` |

公开代码中默认值为 0 的项（当前既不加分也不扣分）：

| 标识 | 默认 |
| --- | --- |
| `ProfileClickWeight` | 0.0 |
| `VqvWeight` | 0.0 |
| `QuotedVqvWeight` | 0.0 |
| `PostVideoWeight` | 0.0 |
| `BidirectionalFollowDwellWeightBoost` | 0.0 |

说明：`BidirectionalFollowReplyWeightBoost` 并不是一个独立的模型预测头，而是当满足特定条件时，**直接叠加到回复权重上**，具体见下一节说明。

另外，连续项（如 `dwell_time`、`click_dwell_time`）乘以的是模型预测的时长（秒数），而不是 0 到 1 之间的概率。所以像 `0.006` 和 `0.4` 这类系数不能直接跟「喜欢 0.66」横向比大小，因为它们的量纲完全不同。

## vm-ranker 字面量和主表对不上的 5 个键

对应同一条 feature switch，两份文件里硬编码的兜底默认值并不一样。在 vm-ranker 重新打分、且没有配置中心下发动态值时，会走右侧这一列的值：

| 键 | param.rs（有 last sync） | vm-ranker/params.rs |
| --- | --- | --- |
| `FavoriteWeight` | 0.66 | 0.5 |
| `VideoOpenWeight` | 0.02 | 0.07 |
| `ContDwellTimeWeight` | 0.006 | 0.004 |
| `PostUnexploredWeight` | 0.015 | 0.02 |
| `NotInterestedWeight` | −52.272 | −47.52 |

除了这 5 项之外，主表里的其他权重在两份文件中的字面量完全一致（包括复制链接 20、回复 5、举报 −234、互关回复加成 15 等）。

还有一些项只出现在 vm-ranker 中、主表里根本没有，但它们在公开代码里的默认值全都是 0：比如 `VideoContinuationWeight`、`UserVideoContinuationWeight`、`ProfileVisitSecsWeight`。虽然公式里留好了坑位（视频打开概率 × 续播秒数，再乘以权重），但由于默认权重是 0，乘完后依然不产生实际得分。

## 互关加成是怎么生效的

参考 [`docs/BIDIRECTIONAL_BOOST_CHANGE.md`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/docs/BIDIRECTIONAL_BOOST_CHANGE.md) 以及 [`xai-value-model/weights.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/weights.rs) 中的 `reply_weight_for` 函数：

- 只要加成值不为 0，且当前推文**既不是回复也不是转推**，同时作者与读者处于**互相关注**状态，回复的权重就会直接变为 `ReplyWeight + Boost`。按照目前两份文件里的字面量计算，也就是 `5 + 15 = 20`。
- 如果推文本身就是一条回复或转推，则不会触发加成，哪怕作者与读者确实是互关。
- 停留时长的互关加成 `BidirectionalFollowDwellWeightBoost` 默认是 0。代码逻辑要求加成必须不为 0 才会去调整停留权重，所以在默认路径下，停留权重依然保持原本的 0.05。文档中也注明：官方对停留加成做过实验，但并没有像回复加成那样全面上线。
- 演进时间线（来自文档原话）：2026-07-10 曾小流量测试过 5、10、15、20 等不同挡位（当时大部分用户为 0）；07-13 开始大面积灰度 20；最终在 07-24 调整并定格为 15。

互相关注的判定标记由 `BidirectionalFollowHydrator` 提供：需要读者关注了作者，并且社交图谱服务确认作者也反向关注了读者。该功能的开关 `EnableBidirectionalFollowHydration` 默认处于打开状态（true）。

## 负分被平移到一个极小的正偏移量

代码中定义了常量 `NEGATIVE_SCORES_OFFSET = 0.001`（位于 `xai-value-model/weights.rs`，同时 `home-mixer/params/config.rs` 中也有同名定义）。

具体的打分平移函数 `offset_score` 逻辑如下：

- 如果所有正向和负向权重之和为 0，那么只要加权总分小于 0，就会直接归零。
- 如果加权总分小于 0：会按公式 `(加权和 + 负向权重绝对值之和) / 全部权重绝对值之和 × 0.001` 将其平移压缩到 `[0, 0.001)` 之间。
- 如果加权总分大于等于 0：则简单地执行 `加权和 + 0.001`。

注意：这里的「负向权重绝对值之和」仅累加这五项：不感兴趣、屏蔽、静音、举报、未停留。像复制链接这类正向权重绝不会混进这个负向绝对值总和里。

## 作者多样性打折（Author Diversity）

这一机制只在 vm-ranker 阶段根据参数生效。在 home-mixer 本地初排那一版实现中，`enable_author_diversity` 被硬编码写死为了 false，对应的衰减系数和保底底线也都写死为 1.0，相当于完全不做多样性惩罚。

而在 vm-ranker 中，开源代码的默认配置如下：

| 参数 | 默认 |
| --- | --- |
| `EnableAuthorDiversity` | true |
| `AuthorDiversityDecay` | 0.5 |
| `AuthorDiversityFloor` | 0.25 |

衰减计算公式（`diversity_multiplier`）：

```text
multiplier(k) = (1 - floor) × decay^k + floor
```

其中 `k` 表示同一个作者的所有候选推文中，按照调整前打分从高到低排序时，排在当前推文前面的数量。对于该作者的第一条推文，`k = 0`，计算出的乘数就是 1。带入默认参数后的具体衰减梯度如下：

| 同一作者里的名次 | k | 乘数 |
| --- | --- | --- |
| 第 1 条 | 0 | 1 |
| 第 2 条 | 1 | 0.625 |
| 第 3 条 | 2 | 0.4375 |
| 再往后 | 更大 | 往 0.25 靠 |

## 站外推文折扣（OON / Out-Of-Network）

在 `post_fusion_multipliers` 处理逻辑中：站外推文（即 `in_network == Some(false)`）的分数会乘以一个折损系数 `effective_oon_weight`。对于站内的**回复和转推**，当开关 `EnableOonRescoreForInNetworkRepliesRetweets = true`（vm-ranker 默认开启）时，也会被视同站外推文乘以这个折扣；但站内原创推文绝不会被打折。如果推文的 `in_network` 字段缺失，则不做折扣（系数按 1 处理）。

`effective_oon_weight` 的具体取值规则（见 `vm-ranker/scoring/value_model.rs`）：

| 情况 | 默认系数 |
| --- | --- |
| 普通 For You | `OonWeightFactor = 0.75` |
| 话题请求 | `TopicOonWeightFactor = 0.5` |
| 账号年龄小于 `NewUserAgeThresholdSecs` 且关注数 ≥ 5 | `NewUserOonWeightFactor = 0.00001` |

这里需要特别关注：`NewUserAgeThresholdSecs` 的默认值其实是 **0**。由于账号注册时长不可能小于 0，因此在公开默认配置下，那个「新用户刷到站外推文打折到几乎归零」的惩罚分支根本不会被触发。千万别把它当成线上正在生效的铁律。代码里的常量 `NEW_USER_MIN_FOLLOWING = 5`，也只有在该时间阈值被配置为大于 0 时才真正有意义。

另外，`MultiplierPreOffset` 默认是 false：这意味着多样性乘数和站外折损系数，是直接乘在**已经加完 0.001 偏移量的最终分数**上的。只有当该开关设为 true 时，系统才会先减去偏移量，仅对非负的净得分应用乘数（负分净值不乘），最后再把偏移量加回去。公开默认实现走的是前者。

至于 `AuthorExplorationBonus`，其默认值是 0.0。它是按作者维度直接加在去掉偏移后的净分上的探索奖励，并不是新推文冷启动逻辑。真正的冷启动是另一套独立机制，见下文。

## 冷启动机制（新推文提权）

README 中提到的 new-author boost，对应的代码实现是 [`home-mixer/scorers/author_cold_start.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/author_cold_start.rs)，而不是上面那个默认设为 0 的 exploration bonus。

开源公开的默认配置（均定义在 param.rs 中）：

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

一条推文必须同时满足以下所有硬性门槛，才会被冷启动机制纳入候选池：必须是原创（非回复、非转推）；作者粉丝数 ≤ 50000；发布时间 ≤ 7200 秒（2小时内）；在 Home 流上的累计曝光量 `< 200`；在当前所有非零分推文的初排中，名次不能跌出 `0.97 × 非零条数` 之后。

目标提权槽位区间为 `slot_min .. slot_max`，由于是左闭右开区间 `15 .. 16`，实际上只锁定了下标 15 这一个固定位置（即对应排在第 16 名的那条推文的分数）。如果当前候选池里得分大于 0 的推文总数不足 16 条，该区间就是空的，本轮便不会触发任何提权。一旦有推文被选中提权，它的最终得分会更新为 `max(自己的分, 目标位置的分)`。

具体哪条推文能被选中：系统默认采用汤普森采样（Thompson sampling）。代码以推文在 Home 流上的真实曝光数和喜欢数作为先验反馈，更新 Beta(0.75, 49.25) 分布并抽取奖励得分，筛选出采样值最高的前 2 条，接着再在这 2 条里挑选**原始真实排序分**更高的一条胜出。为了防止异常数据，点赞数在计算时会被严格截断在曝光数之内。

读者分桶实验：控制开关 `PhoenixMoeCodivertViewerIsTreatment` 与 `IsControl` 默认全为 false，因此当前读者默认处于 Holdout 实验臂。在 Holdout 臂下，系统不会按作者的对照桶进行前置过滤；只有在明确划入实验臂或对照臂时，系统才会只提权对应分桶里的作者。这两个实验开关默认都是关闭的。

选中的冷启动提权位置下标会随请求透传给 downstream 的 vm-ranker。在价值模型重算阶段，`apply_cold_start_decisions` 会再次把该下标对应推文的分数强行拉平到目标位次。

## DPP 多样性重排

README 提到：VMRanker 会利用候选推文的向量表征（embedding）运行一套行列式点过程（DPP）重排算法，牺牲少许排序分，以换取相邻推荐结果不要过度相似。

不过，从源码实现来看，DPP 必须在两层开关同时满足时才会真正运行：

- 首先是进程级命令行参数 `--dpp-enabled`，在 [`vm-ranker/args.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/args.rs) 里默认是 **false**。如果启动时没有带上这个上下文参数，后面的动态开关根本无法唤醒 DPP 逻辑。
- 其次是 feature switch 开关 `DppEnabled`，虽然它默认是 **true**；但在话题信息流场景下，还额外受 `TopicDppEnabled` 开关控制（默认是 false），因此话题请求在默认配置下根本不做 DPP。
- 参数方面，`DppTheta = 0.65`，`DppMaxSelectedRank = 150`。
- `--dpp-top-k` 的进程级默认值是 50；`--dpp-theta` 进程级默认值是 0.5，但只要读取到了 feature switch，theta 就会被动态配置覆盖成 0.65。

开源仓库并没有说明其线上生产部署时是否显式传递了 `--dpp-enabled` 参数。因此这里必须严谨表述：README 确实描述了 DPP 机制；但在公开的默认代码中，动态业务开关虽然打开了，底层的进程启动开关却是关闭的。千万不要把「线上一定在跑 DPP」当成已验证的既定事实。

另外，`WeightPerturbationSigma` 默认是 0，意味着权重随机扰动默认是不启用的；`UserDebiasEnabled` 默认也是 false。

## Premium / Blue 蓝标加成

在目前已公开的价值模型打分权重、`home-mixer/scorers/` 目录源码，以及 `phoenix/` 的检索召回实现中，**根本不存在**任何针对 Premium 或 Blue 蓝标认证账号的直接排序乘数加权。

订阅与 Premium 状态目前仅体现在内容曝光准入门槛（可见性）层面：比如会员专属推文绝对不会进入非订阅用户的候选池（由 `IneligibleSubscriptionFilter` 负责拦截），或者在年龄核验逻辑中包含了 IDV Premium 等受众属性。这些属于「有没有资格被展示」的硬性过滤，而不是在最终得分上乘以一个所谓的蓝标系数。如果其实际线上生产模型在未公开的模型特征侧引入了认证特征，那至少在这套开源代码库中并未呈现任何乘数。结论明确记为：**公开打分权重体系中不存在该加成。**

## 2026 年 10 月 README 中与推荐排序相关的更新

- 10 月 8 日：Phoenix 排序模型优化了对「用户在推文上的停留时长」的预测精度，具体改动参见 `phoenix/xrex/models/loss_recsys.py` 与 `recsys_model.py`。
- 10 月 13 日：Phoenix 召回阶段也开始以「吸引读者完整读完」为目标进行训练，具体实现参见 `phoenix/xrex/models/recsys_two_tower_model.py`。
- 10 月 26 日：已从 For You 信息流中正式移除了 `Brazil2026ElectionFilter` 过滤器，不要再误以为该过滤规则仍在运行。

需要特别说明的是：上述改动属于底层模型训练目标或管道过滤器的调整，并没有把 param.rs 里的具体打分权重更新为另一套公开数字。仓库在此次更新中并未发布任何全新的权重对照表。

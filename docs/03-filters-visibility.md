# 03 · 预过滤与可见性

排序决定次序。可见性决定一条帖以什么形态出现，或者干脆不出现。两套代码，两套输入。把一边的结果拿去解释另一边，是这份仓库自己在提醒不要做的事。

## 打分前过滤

顺序以 [`phoenix_candidate_pipeline.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs) 里 `filters` 向量为准。README 的表是摘要；源码比摘要多几格，有的默认关着。

| 顺序 | 过滤器 | 去掉什么 | 默认 |
| --- | --- | --- | --- |
| 1 | `DropDuplicatesFilter` | 多个来源返回的同一条帖 | 开 |
| 2 | `ZeroFavCodivertFilter` | 零喜欢实验桶里的帖 | `ViewerZeroFavCodivertIsTreatment = false`，默认不跑 |
| 3 | `CoreDataHydrationFilter` | 正文和元数据没装上的帖 | 开 |
| 4 | `NewUserSoftNsfwFilter` | 新账号上的软性成人向站外帖 | `EnableNewUserSoftNsfwFilter = false` |
| 5 | `AgeFilter` | 超过 48 小时 | 常量 `MAX_POST_AGE = 48 * 60 * 60`（`params/config.rs`），不是 feature switch |
| 6 | `SelfTweetFilter` | 作者就是当前读者 | 开 |
| 7 | `OONRetweetReplyFilter` | 站外转帖；站外回复（除非打开 Phoenix 站外回复开关）；父帖缺失的回复 | `EnablePhoenixOonReplies = false` |
| 8 | `OONNsfwSimclustersFilter` | SimClusters 来的、作者被标成成人内容、读者又没关注的帖 | 跟随 `EnableSimclustersSource = true` |
| 9 | `RetweetDeduplicationFilter` | 同一条原帖的重复转帖 | 开 |
| 10 | `IneligibleSubscriptionFilter` | 带订阅作者、而读者不在订阅列表里的帖 | 开 |
| 11 | `PreviouslySeenPostsFilter` | 已经展示过 | 开 |
| 12 | `PreviouslySeenPostsBackupFilter` | 另一份展示记录里已看过 | 开 |
| 13 | `PreviouslyServedPostsFilter` | 这次会话更早已经下发过 | `EnableServedFilterAllRequests = true` |
| 14 | `ViewerMutedKeywordFilter` | 撞上读者的静音关键词 | 开 |
| 15 | `AuthorSocialgraphFilter` | 读者屏蔽或静音了作者；作者屏蔽了读者；引用作者或被转用户落在屏蔽关系里 | 开 |
| 16 | `VideoFilter` | 请求声明不要视频时的视频帖 | 仅 `exclude_videos` |
| 17 | `TopicIdsFilter` | 不在所点话题里，或落在排除话题里 | 仅话题请求 |
| 18 | `NewUserMinEngagementFilter` | 新账号上、站外帖互动不够 | `EnableNewUserMinEngagementFilter = false`，阈值默认 0 |
| 19 | `InventoryHoldoutFilter` | 按帖和读者确定性抽掉一定比例 | 开关默认 false，三个比例默认 0 |
| 20 | `FavHoldoutFilter` | 按喜欢数分桶的留出实验 | `EnableFavHoldout = false` |
| 21 | `FairShareRankingFilter` | 超出打分预算的帖 | `EnableFairShareRanking = true`，预算 `PhoenixScoresResultSize = 2800`；没有打分序列或正在用缓存帖时不跑 |

48 小时同时出现在 SimClusters 的 `SimclustersMaxCandidateAgeHours = 48`，以及 TweetMixer 源码里的 `MAX_POST_AGE`。主路径上真正裁候选的是 `AgeFilter` 那个常量。

`OONRetweetReplyFilter` 还丢掉父链是空的回复，不限于站外。站内转帖和父链完整的站内回复留着，但排序阶段可能再乘站外系数，见权重文档。

## 选取之后

| 顺序 | 过滤器 | 行为 | 默认 |
| --- | --- | --- | --- |
| 1 | `VFFilter` | 可见性动作为 Drop、Tombstone、NotEvaluated 的帖去掉 | 开 |
| 2 | `AncillaryVFFilter` | `drop_ancillary_posts` 为真的帖去掉（父帖、引用帖、被转原帖已被丢） | 开 |
| 3 | `AncestorVideoFilter` | 祖先是视频而这次请求排除视频 | 仅 `exclude_videos` |
| 4 | `DedupConversationFilter` | 同一对话的多余分支 | 开 |
| 5 | `VideoCarouselFilter` | 视频轮播的额外筛选 | `EnableVideoCarousel = false` |

`TopKScoreSelector` 在这些过滤器**之前**。先按分留下 50 条，再问可见性。所以一条高分帖仍可能在最后一步消失。消失的原因是可见性，不是它的预测分突然变了。

## 四个读者能感知的答案

README 的标注路径写的是，对「这一条帖 × 这一位读者」：

| 答案 | 含义 |
| --- | --- |
| ALLOW | 正常显示 |
| NOTICE | 帖还在，带一条说明 |
| INTERSTITIAL | 帖还在，先挡一层，读者可以点开。成人或强烈影像会走这里。本仓库不负责把那层画出来 |
| DROP | 不显示 |

客户端枚举比这四个词更细，在 [`visibility-filtering-client/models.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/visibility-filtering-client/models.rs) 的 `Action`：`Allow`、`Drop`、`Interstitial`、`Downrank`、`Tombstone`、`Avoid`、`NotEvaluated`。

`VFFilter` 只丢掉 `Drop`、`Tombstone`、`NotEvaluated`。`Allow`、`Interstitial`、`Avoid`、`Downrank` **留在候选里**。`Avoid` / `Downrank` 不是价值模型里的权重，本仓库的 For You 过滤器也没有把它们换成一个分数乘数。不要把这两个枚举读成「排名乘了 0.几」。

规则侧（`visibility-filtering/rules/tweet_rules.rs` 等）还有大量具体 DROP：垃圾、本地法律下架、受保护账号、社区、敏感内容对未登录或未成年读者，以及「只对非关注者的推荐才丢」的规则。README 写明两点：

- 第一条回答 DROP 的规则会结束这次评估。
- 另一组规则只在「来自未关注账号的推荐」上生效，而且只能 DROP。同一个人发的帖，关注者仍可以 ALLOW。完整顺序在可见性规则注册表。仓库也写了：为降低被绕过的风险，一部分 botmaker 规则没有公开。

## 和排序的分界

| | 排序 | 可见性 |
| --- | --- | --- |
| 问的问题 | 留下的帖谁在前 | 这条帖给这个读者看不看、怎么看 |
| 主要输入 | 这个读者的行为预测 | 标签、屏蔽、静音、关注、保护、暂停、订阅、国家、设置 |
| 公开权重 | param.rs / vm-ranker | 没有一套「举报 = −234」那种排序权重 |
| For You 里谁执行 | Phoenix + 价值模型 + VMRanker | `VFCandidateHydrator` + `VFFilter` |
| 失败时长什么样 | 帖还在，只是靠后或根本没进 Top 50 | 帖不在这一屏，或带着说明 / 遮罩 |

低曝光最常见的是左边：预测到的回复、转发、读完不高，站外再乘 0.75，同一作者后面的帖还要衰减，48 小时以外直接没进候选。这些都**不会**让 Shadowban Radar 的四项公开检查变红，也**不会**在 Under the Hood 里显示成一个「降权标签」。右边才会产生 DROP、说明或遮罩。

## Under the Hood 在这套代码里的位置

官方工具：[https://x.com/i/jf/under_the_hood](https://x.com/i/jf/under_the_hood)。仓库目录 `under-the-hood/` 负责把账号和帖子上的标签收成一份报告。`EnableUnderTheHood` 在 param.rs 的默认是 **false**（这是 home-mixer 要不要走那条请求路径的开关，不是「产品没有这个页面」）。

README（2026-09-18）：报告会写明账号或帖子是否因法律要求被限制可见，例如某国的法律下架。它是登录后、给账号主人看的标签汇总，不是一次 For You 请求的打分明细。和第三方检测的差别写在 [05-shadowban-radar.md](05-shadowban-radar.md)。

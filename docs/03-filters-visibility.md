# 03 · 预过滤与可见性

排序决定谁排在前面，可见性决定一条帖子长什么样、或者干脆出不出现。这是两套完全不同的代码，吃两套完全不同的输入。拿一边的逻辑去强行解释另一边，这恰恰是代码仓库自己反复提醒不要干的事。

## 打分前过滤

过滤顺序严格以 [`phoenix_candidate_pipeline.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs) 里的 `filters` 向量为准。README 里的表格只是个精简摘要；翻看源码会发现实际过滤器比摘要多出好几个，只不过有些默认没开。

| 顺序 | 过滤器 | 去掉什么 | 默认状态 |
| --- | --- | --- | --- |
| 1 | `DropDuplicatesFilter` | 多个来源召回的同一条重复帖 | 开 |
| 2 | `ZeroFavCodivertFilter` | 处于“零点赞分流”实验桶里的帖子 | `ViewerZeroFavCodivertIsTreatment = false`，默认不跑 |
| 3 | `CoreDataHydrationFilter` | 正文和元数据拼装失败的帖子 | 开 |
| 4 | `NewUserSoftNsfwFilter` | 面向新账号展示的非关注软性成人向帖子 | `EnableNewUserSoftNsfwFilter = false` |
| 5 | `AgeFilter` | 发布超过 48 小时的帖子 | 常量硬编码 `MAX_POST_AGE = 48 * 60 * 60`（位于 `params/config.rs`），不是 feature switch |
| 6 | `SelfTweetFilter` | 作者就是当前读者的帖子（自己不看自己） | 开 |
| 7 | `OONRetweetReplyFilter` | 站外转帖；站外回复（除非打开 Phoenix 站外回复开关）；缺少父帖的孤立回复 | `EnablePhoenixOonReplies = false` |
| 8 | `OONNsfwSimclustersFilter` | 来自 SimClusters、作者被打上成人内容标签、读者又没关注的帖子 | 随 `EnableSimclustersSource = true` 开启 |
| 9 | `RetweetDeduplicationFilter` | 针对同一条原帖的重复转帖 | 开 |
| 10 | `IneligibleSubscriptionFilter` | 属于付费订阅作者、而当前读者不在订阅列表里的帖子 | 开 |
| 11 | `PreviouslySeenPostsFilter` | 之前已经曝光展示过的帖子 | 开 |
| 12 | `PreviouslySeenPostsBackupFilter` | 备用展示记录里显示已看过的帖子 | 开 |
| 13 | `PreviouslyServedPostsFilter` | 本次会话前序请求中已经下发过的帖子 | `EnableServedFilterAllRequests = true` |
| 14 | `ViewerMutedKeywordFilter` | 命中了读者静音关键词的帖子 | 开 |
| 15 | `AuthorSocialgraphFilter` | 读者屏蔽/静音了作者；作者屏蔽了读者；或者引用的作者/被转的原作者命中了屏蔽关系 | 开 |
| 16 | `VideoFilter` | 客户端明确声明不要视频时的视频帖 | 仅在带 `exclude_videos` 时生效 |
| 17 | `TopicIdsFilter` | 不在所选话题内，或命中了排除话题的帖子 | 仅在话题流请求时生效 |
| 18 | `NewUserMinEngagementFilter` | 面向新账号展示但互动量不够的站外帖 | `EnableNewUserMinEngagementFilter = false`，阈值默认 0 |
| 19 | `InventoryHoldoutFilter` | 基于帖子和读者的确定性哈希直接抽检扣留一定比例 | 开关默认 false，三个比例默认都为 0 |
| 20 | `FavHoldoutFilter` | 按点赞数分桶的对照留出实验 | `EnableFavHoldout = false` |
| 21 | `FairShareRankingFilter` | 超过打分算力预算的多余候选帖 | `EnableFairShareRanking = true`，预算上限 `PhoenixScoresResultSize = 2800`；无打分序列或正在读缓存帖时不跑 |

48 小时限制其实同时出现在两个地方：一个是 SimClusters 里的 `SimclustersMaxCandidateAgeHours = 48`，另一个是 TweetMixer 源码里的 `MAX_POST_AGE`。不过在主推荐链路上真正一刀切裁掉老帖子的，是 `AgeFilter` 里的这个常量。

另外注意，`OONRetweetReplyFilter` 还会顺手干掉找不到父帖的断头回复，这可不限于站外。站内转帖以及链路完整的站内回复虽然会被保留，但在后面的排序阶段可能还会被乘上站外系数，具体可以看权重文档。

## 选取之后

| 顺序 | 过滤器 | 行为 | 默认状态 |
| --- | --- | --- | --- |
| 1 | `VFFilter` | 可见性判定为 Drop、Tombstone、NotEvaluated 的帖子直接扔掉 | 开 |
| 2 | `AncillaryVFFilter` | 标记了 `drop_ancillary_posts` 的帖子扔掉（说明其父帖、引用帖或被转原帖已被干掉了） | 开 |
| 3 | `AncestorVideoFilter` | 祖先节点是视频且当前请求排除了视频的帖子 | 仅在带 `exclude_videos` 时生效 |
| 4 | `DedupConversationFilter` | 过滤掉同一次对话里多余的分支回复 | 开 |
| 5 | `VideoCarouselFilter` | 视频轮播专用的额外过滤规则 | `EnableVideoCarousel = false` |

大家经常容易搞错顺序：`TopKScoreSelector` 是在这批过滤器**之前**执行的。系统是先按预测得分裁出前 50 条候选，然后再挨个去查可见性。这就导致一条模型打分极高的帖子，照样可能在临门一脚彻底蒸发——而它消失的原因纯粹是可见性卡掉了，并不是它的模型预测分临时变低了。

## 四种用户能感知到的处理结果

按 README 里的说明，系统针对「某一条特定帖子 × 某一个特定读者」会给出四种抽象处理：

| 动作 | 实际含义 |
| --- | --- |
| ALLOW | 正常展示 |
| NOTICE | 帖子照常出现，但上方挂一条提示说明 |
| INTERSTITIAL | 帖子还在，但默认被遮罩挡住，需要用户手动点开。成人内容或感官刺激强烈的画面会走这个逻辑。不过客户端那层毛玻璃具体怎么渲染，本仓库代码不管 |
| DROP | 彻底不展示 |

不过在客户端底层代码里，状态枚举其实分得比这四个词细得多。参考 [`visibility-filtering-client/models.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/visibility-filtering-client/models.rs) 定义的 `Action` 枚举：`Allow`、`Drop`、`Interstitial`、`Downrank`、`Tombstone`、`Avoid`、`NotEvaluated`。

在这些枚举里，`VFFilter` 真正会丢弃的只有 `Drop`、`Tombstone`、`NotEvaluated` 这三类；像 `Allow`、`Interstitial`、`Avoid`、`Downrank` 实际上**都留在了候选集里**。需要特别澄清的是：`Avoid` 和 `Downrank` 并不是价值模型里的打分权重，本仓库的 For You 过滤器也根本没有把它们转换成某种分数折扣系数。千万别想当然地把这两个状态理解成「排名被偷偷打了 0.几折」。

在规则引擎这端（比如 `visibility-filtering/rules/tweet_rules.rs`），还维护着海量具体的 DROP 规则：垃圾内容过滤、各国本地法律合规下架、受保护账号限制、特定社群隔离、针对未登录/未成年用户的敏感内容屏蔽，以及一整套「只对非关注者推荐生效」的过滤规则。关于这套逻辑，README 强调了两点：

- 只要命中第一条返回 DROP 的规则，整条帖子的可见性评估就直接短路终止。
- 有另一组规则专门只作用于「来自未关注账号的推荐流」，而且处理动作只能是 DROP。同一个作者发的内容，关注他的粉丝看依然是 ALLOW。完整的执行顺序定义在可见性规则注册表里。另外开源仓库也明确注明了：为了防止被黑灰产针对性绕过，一部分专门针对自动化账号（botmaker）的防护规则并没有对外公开。

## 它和排序的边界到底在哪

| 维度 | 排序（Ranking） | 可见性（Visibility） |
| --- | --- | --- |
| 核心问题 | 筛选后剩下的帖子，到底谁排前面？ | 这条帖子到底给不给这个用户看？怎么看？ |
| 核心输入 | 对该用户各类行为概率的打分预测 | 安全标签、屏蔽、静音、关注状态、账号保护、封禁暂停、订阅关系、国家地域、用户设置 |
| 公开权重 | 存在于 `param.rs` / `vm-ranker` | 压根没有「被举报一次扣 234 分」这种连续打分机制 |
| For You 流落地模块 | Phoenix + 价值模型 + VMRanker | `VFCandidateHydrator` + `VFFilter` |
| 表现形式 | 帖子还在流里，只是排得很靠后甚至根本没挤进 Top 50 | 帖子压根就没进流，或者进流了但带着警告横幅/警告遮罩 |

平时大家抱怨最多的“没流量”，绝大多数其实都是左边排序模块引起的：模型预估的回复率、转推率、完读率本来就偏低，要是站外内容还得先打个 0.75 折，同一作者连发的内容还要被多样性降权衰减，发布超过 48 小时的甚至连候选池都挤不进去。所有这些排序因素，都**绝对不会**让 Shadowban Radar 上的四项公开指标变红，也**绝对不会**在 Under the Hood 页面里显示成一个所谓的「降权标签」。只有右边的可见性系统出手，才会真正产生 DROP、警告提示或者遮罩层。

## Under the Hood 在这套架构里的定位

官方查询入口：[https://x.com/i/jf/under_the_hood](https://x.com/i/jf/under_the_hood)。仓库里的 `under-the-hood/` 目录，主要负责把挂在账号和帖子上的各类系统标签汇总成一份报告。在 `param.rs` 配置文件里，`EnableUnderTheHood` 默认值确实是 **false**（注意：这仅仅是 home-mixer 内部要不要走那条特定请求链路的内部开关，绝不代表「线上产品没有这个页面」）。

根据 README（2026-09-18）的描述：这份报告主要用来向用户解释其账号或帖子是否因合规等法律诉求被限制了可见范围，比如某个国家的法律要求下架。本质上，它是给登录后的账号所有者看的一份合规标签摘要，根本就不是每次刷 For You 时后台那一长串实时打分的明细单。关于它和各类第三方检测工具的深层差异，可以参考 [05-shadowban-radar.md](05-shadowban-radar.md)。

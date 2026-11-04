# 01 · For You 流水线

核对对象：[xai-org/x-algorithm](https://github.com/xai-org/x-algorithm) `b220448`（提交说明 Open-source X Recommendation Algorithm，2026-11-03）。权重默认值的镜像时间写在 [`home-mixer/params/param.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/param.rs) 第 1 行：`last sync 2026-11-02T16:00:39Z`。

For You 是按一次请求现拼的。站内帖（你关注的人）和站外帖（模型召回）进同一套排序。排序只决定次序。一条帖能不能出现，是另一套可见性规则的事。见仓库 README「Ranking and Visibility Are Separate」。

## 请求路径上的格子

代码落在 [`home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs) 的 `PhoenixCandidatePipeline`。外面再包一层混排流水线 `ForYouCandidatePipeline`。README 的请求路径图和这份源码对得上，顺序如下。

1. **查询补水。** 读者最近的互动序列、关注列表、屏蔽和静音、静音关键词、已经看过和已经下发过的帖。这是模型的主要输入。
2. **候选来源，并行查。** 见下一节。
3. **帖子补水。** 正文和媒体、作者、引用帖、语言、互动计数、订阅状态，以及是不是互关（`BidirectionalFollowHydrator`）。
4. **打分前过滤。** 详见 [03-filters-visibility.md](03-filters-visibility.md)。
5. **打分。** Phoenix 给每个动作一个预测；价值模型把它们收成一个数；冷启动可能抬一条新帖；`VMRanker` 再算一遍并可选做 DPP 重排。详见 [02-scoring-weights.md](02-scoring-weights.md)。
6. **选取。** `TopKScoreSelector` 按最终分排序，留下前 K。K 写死为 50：[`home-mixer/params/config.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/config.rs) 的 `TOP_K_CANDIDATES_TO_SELECT`。
7. **选取之后。** `VFCandidateHydrator` 问可见性服务；`VFFilter` 丢掉它说要丢的帖；`AncillaryVFFilter` 丢掉父帖、引用帖或被转原帖已被丢弃的帖；`DedupConversationFilter` 收起同一条对话的多余分支。
8. **混排。** 排好的帖只是来源之一。广告、Who to Follow、提示等插进去。默认广告混排会为了广告相邻再调有机帖的位置。Who to Follow 的固定位置是第 6 格（`WHO_TO_FOLLOW_POSITION = 6`）。

响应发出去之后还有副作用：记下这次下发了哪些帖、刷新缓存、打日志。那些不改变这一屏的次序。

## 候选从哪来

| 来源 | 默认开着吗 | 条数上限 | 在哪 |
| --- | --- | --- | --- |
| Thunder，关注的人最近的帖 | 没有缓存帖时会查 | `ThunderMaxResults = 1200` | `param.rs`；`thunder_source.rs` 还会把已看过的 id 排除掉 |
| Phoenix retrieval | `EnablePhoenixSource = true` | `PhoenixMaxResults = 1000` | 读者向量附近的帖 |
| SimClusters | `EnableSimclustersSource = true` | 源码常量 `MAX_RESULTS = 800`，不是 param | `sources/simclusters_source.rs`；候选年龄默认 48 小时 |
| Popular posts | `EnablePopularPostsSource = true` | `PopularPostsMaxResults = 500` | 一份共享的近期热帖列表 |
| TweetMixer | `EnableTweetMixerSource = false` | `TweetMixerMaxResults = 800` | 默认关 |
| Phoenix MOE | `EnablePhoenixMOESource = false` | `PhoenixMOEMaxResults = 0` | 默认关 |
| SID | `EnableSidSource = false` | `SidSourceMaxResults = 800` | 默认关 |
| Cached posts | `EnableCachedPosts = true` | `MaxPostsToCache = 750` | 有缓存时，Thunder / Phoenix 这条现查路径会让开 |

Thunder 在查询时就去掉已看过的帖。其他来源不这么做，重复的留给后面的「已看过 / 已下发」过滤器。

Phoenix 冷启动召回另有 `PhoenixColdStartMaxResults = 200`。那是召回配额，不是排序里的冷启动抬升。

## 打分在流水线里占哪一格

本地先算一版加权分（`home-mixer/scorers/value_model.rs` 的 `fuse_heads`）。这一版**把作者多样性、站外折扣都写死关掉**。接着 `AuthorColdStart` 可能改本地分，并记下 `cold_start_lift_to_rank`。

然后 [`home-mixer/scorers/vm_ranker_request.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/vm_ranker_request.rs) 组请求时把 `compute_value_model` **写死为 true**，`value_model_id` 为 `"dpp"`。所以正常路径上，读者看到的次序来自 `vm-ranker` 按 feature switch 重算的价值模型，再视进程是否打开 DPP 做一次重排。服务挂了就退回本地加权分（`vm_ranker.rs` 里的 fallback）。

## 和「标签从哪来」的关系

可见性用的标签不是这次请求里现算的。帖子和账号在发布后持续被分类、打标签、存起来。请求后半段才去读。规则正文在 `visibility-filtering/`，一部分 botmaker 规则仓库写明没有公开，避免被对着绕。

## 这一章不要读成

- 流水线每一格都能单独用 feature switch 关掉。`param.rs` 里开关很多，这里只记和主路径有关的默认值。
- 默认关着的来源（TweetMixer、SID、Phoenix MOE）不要写成「正在给 For You 供帖」。
- 生产仍会做实验。README 说，占流量比较明显的实验（大约一成或更多）希望能在仓库里看见；小流量实验不一定出现在这份默认值里。

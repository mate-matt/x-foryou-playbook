# 01 · For You 流水线

核对对象：[xai-org/x-algorithm](https://github.com/xai-org/x-algorithm) `b220448`（提交说明 Open-source X Recommendation Algorithm，2026-11-03）。权重默认值的镜像时间记录在 [`home-mixer/params/param.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/param.rs) 第 1 行：`last sync 2026-11-02T16:00:39Z`。

For You 信息流是在收到请求时实时拼装出来的。站内帖（你关注的人发的内容）和站外帖（算法模型召回的内容）会混在一起进同一套排序流程。但这里要注意：排序只管决定先展示谁、后展示谁；至于某条帖子到底能不能露出来，全看另一套独立的可见性规则。具体可以参考仓库 README 里的「Ranking and Visibility Are Separate」。

## 请求路径上的格子

核心业务代码落在 [`home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs) 的 `PhoenixCandidatePipeline` 里，外层还包了一套混排流水线 `ForYouCandidatePipeline`。README 里的请求链路图和源码完全对得上，具体执行顺序如下：

1. **查询补水。** 取出读者近期的互动记录、关注列表、拉黑与静音名单、静音关键词，以及已经看过和此前下发过的帖子。这部分是推荐模型最核心的上下文输入。
2. **候选来源，并行查。** 多路并发拉取候选帖，具体来源见下一节。
3. **帖子补水。** 补齐帖子的正文、多媒体附件、作者信息、引用的原帖、语种、互动计数、订阅状态，以及双方是否互关（由 `BidirectionalFollowHydrator` 负责）。
4. **打分前过滤。** 详见 [03-filters-visibility.md](03-filters-visibility.md)。
5. **打分。** Phoenix 会预测用户的各项操作概率；价值模型把这些预测值融合成一个综合分；遇到冷启动场景可能会把新帖往上抬一抬；接着交由 `VMRanker` 重算一遍，并按需执行 DPP 重排。详见 [02-scoring-weights.md](02-scoring-weights.md)。
6. **选取。** `TopKScoreSelector` 按最终得分从高到低排序，只截取前 K 条。这里的 K 在代码里写死了 50：见 [`home-mixer/params/config.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/config.rs) 的 `TOP_K_CANDIDATES_TO_SELECT`。
7. **选取之后。** `VFCandidateHydrator` 请求可见性服务获取策略判定；`VFFilter` 剔除该服务要求丢弃的帖子；`AncillaryVFFilter` 级联清理掉父帖、引用帖或转发原帖已被丢弃的相关内容；`DedupConversationFilter` 负责收起同一条会话里的多余分支。
8. **混排。** 上面挑出来的有机帖只是最终展示的一部分。广告、Who to Follow（推荐关注）、系统提示等内容会在这步插进来。默认的广告混排逻辑还会为了避免广告挨得太近而微调有机帖的占位；Who to Follow 的展示位则固定在第 6 格（`WHO_TO_FOLLOW_POSITION = 6`）。

响应发给客户端后，系统还会异步跑一些收尾工作：记录本次实际下发了哪些帖子、刷新缓存、落日志。这些后置逻辑不会改动当前这一屏的呈现次序。

## 候选从哪来

| 来源 | 默认开着吗 | 条数上限 | 在哪 |
| --- | --- | --- | --- |
| Thunder，关注的人最近的帖 | 没有缓存帖时会查 | `ThunderMaxResults = 1200` | 见 `param.rs`；另外 `thunder_source.rs` 在拉取时就会把已看过的 id 排除掉 |
| Phoenix retrieval | `EnablePhoenixSource = true` | `PhoenixMaxResults = 1000` | 召回读者兴趣向量附近的帖子 |
| SimClusters | `EnableSimclustersSource = true` | 源码常量 `MAX_RESULTS = 800`，不是 param | 见 `sources/simclusters_source.rs`；候选帖时间跨度默认 48 小时 |
| Popular posts | `EnablePopularPostsSource = true` | `PopularPostsMaxResults = 500` | 一份全局共享的近期全站热帖列表 |
| TweetMixer | `EnableTweetMixerSource = false` | `TweetMixerMaxResults = 800` | 默认关 |
| Phoenix MOE | `EnablePhoenixMOESource = false` | `PhoenixMOEMaxResults = 0` | 默认关 |
| SID | `EnableSidSource = false` | `SidSourceMaxResults = 800` | 默认关 |
| Cached posts | `EnableCachedPosts = true` | `MaxPostsToCache = 750` | 只要命中缓存，Thunder / Phoenix 这条实时查询链路就会直接跳过 |

Thunder 在召回查询阶段就会提前把已看过的帖子剔除；其他召回源则不在这里做过滤，重复的统一留给后面的「已看过 / 已下发」过滤器去洗。

另外，Phoenix 针对冷启动召回单独设了一个上限 `PhoenixColdStartMaxResults = 200`。请注意，这只是召回阶段捞取候选的配额，并不是排序阶段所谓的冷启动提权加分。

## 打分在流水线里占哪一格

系统首先会在本地算一版加权得分（实现见 `home-mixer/scorers/value_model.rs` 的 `fuse_heads`）。在这一版计算里，**作者多样性和站外折扣都被写死关掉了**。接着，`AuthorColdStart` 可能会调整这版打分，并记录下 `cold_start_lift_to_rank`。

随后，[`home-mixer/scorers/vm_ranker_request.rs`](https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/vm_ranker_request.rs) 拼装外部请求时，会把 `compute_value_model` **写死为 true**，并将 `value_model_id` 指向 `"dpp"`。也就是说在正常主路径上，读者最终看到的顺序来自外部 `vm-ranker` 服务按照 feature switch 重算后的价值模型结果，并结合当前进程配置看是否做一次 DPP 重排。只有当下游服务挂了，才会降级回退到本地算的那版加权分（参考 `vm_ranker.rs` 里的 fallback 逻辑）。

## 和「标签从哪来」的关系

可见性过滤依赖的各类标签，并不是在本次请求里现场临时算出来的。帖子发布和账号行为产生后，后台服务会持续对它们分类、打标签并写入存储；请求走到后半程时，直接去查现成的标签就行。具体的规则逻辑都在 `visibility-filtering/` 目录下；不过仓库也明确说明了，一部分 botmaker 反作弊规则并没有公开，目的是防止被黑产对照着针对性绕过。

## 这一章不要读成

- 流水线上的每个格子几乎都能单独通过 feature switch 关掉。`param.rs` 里的配置项非常多，这里只梳理和主路径直接相关的默认值。
- 那些默认关着的召回源（TweetMixer、SID、Phoenix MOE），千万别误写成「正在线上给 For You 供帖」。
- 生产环境随时在跑各种在线实验。README 里也明确提到，只有流量占比显著的实验（大约占到一成或更多），官方才尽量同步到开源仓库里；低流量的小实验不一定会反映在目前的这份默认配置中。

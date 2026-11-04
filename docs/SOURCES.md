# 引用与核对

核对日：2026-11-04。  
算法仓库提交：[`b220448766ab4ee4c83d58a67d51f0cb5bda86c2`](https://github.com/xai-org/x-algorithm/commit/b220448766ab4ee4c83d58a67d51f0cb5bda86c2)（2026-11-03，Open-source X Recommendation Algorithm）。  
`home-mixer/params/param.rs` 文件头：`mirrored from config feature-switch defaults; last sync 2026-11-02T16:00:39Z`。

本站和这些 Markdown 是独立解说，许可见仓库根目录 `LICENSE`（MIT）。x-algorithm 本身是 Apache-2.0。解说里的标识符、默认值和公式对应它的公开源码，不是 X 或 xAI 的官方文档。

中文是直接按源码写的。环境里没有可用的 Gemini CLI（`agy` / `gemini` 均不存在，也没有 API 密钥），所以没有做单独的 Gemini 润色。

## 算法

- 仓库：<https://github.com/xai-org/x-algorithm>
- README 流水线、过滤表、权重误读、2026-08 至 2026-10 更新：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/README.md>
- 权重镜像：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/param.rs>
- 常量（48 小时、TopK 50、偏移 0.001）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/config.rs>
- 价值模型算术：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/scoring.rs>
- 权重结构与互关加成：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/weights.rs>
- 本地加权分（多样性写死关闭）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/value_model.rs>
- 重算用的另一套字面量、多样性、OON、DPP 开关：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/params.rs>
- 重算入口：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/scoring/value_model.rs>
- 请求把 `compute_value_model` 设为 true：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/vm_ranker_request.rs>
- DPP 进程旗标默认关闭：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/args.rs>
- 冷启动：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/author_cold_start.rs>
- 互关变更说明：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/docs/BIDIRECTIONAL_BOOST_CHANGE.md>
- 流水线与过滤器顺序：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs>
- `VFFilter` 丢掉哪些动作：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/filters/vf_filter.rs>
- 动作枚举：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/visibility-filtering-client/models.rs>
- Under the Hood 产品入口：<https://x.com/i/jf/under_the_hood>

## 可见性检测

- Shadowban Radar：<https://shadowbanradar.com/>
- 方法论（4 项检查、Untestable、分数）：<https://shadowbanradar.com/methodology>
- 与 Under the Hood 的对照（站点转述）：<https://shadowbanradar.com/x-under-the-hood>

## 本仓库

- 流水线：[docs/01-pipeline.md](01-pipeline.md)
- 权重：[docs/02-scoring-weights.md](02-scoring-weights.md)
- 过滤与可见性：[docs/03-filters-visibility.md](03-filters-visibility.md)
- 创作取舍：[docs/04-ops-implications.md](04-ops-implications.md)
- 检测可信度：[docs/05-shadowban-radar.md](05-shadowban-radar.md)
- 抽取笔记：[docs/raw/code-extract.md](raw/code-extract.md)

## 核对过、因而写进页面的事实

- 主表全部权重与 0 权重，来自 param.rs 的 `param!` 默认值。
- vm-ranker 五处字面量分叉，来自两份 `param!` 的逐键比较。
- 多样性公式与 k = 0,1,2 的乘数，来自 `diversity_multiplier` 与默认 decay/floor。
- OON 0.75、话题 0.5、新用户阈值默认 0，来自 vm-ranker。
- 冷启动 200 / 15–16 / 50000 / 7200 / Beta(0.75, 49.25)，来自 param.rs 与 `author_cold_start.rs`。
- TopK 50、年龄 48 小时、负分偏移 0.001，来自 `config.rs`。
- 来源上限：Thunder 1200、Phoenix 1000、TweetMixer 800 且默认关、SimClusters 常量 800、Popular 500。
- `VFFilter` 不丢弃 Interstitial、Avoid、Downrank。
- Premium / Blue 不在公开打分权重里。
- Radar 的四项、Untestable 不进分、100 与 “No shadowban detected” 的含义，来自方法论页。
- @mate_mattt 的 100 分是本报告采用的 2026-11 读数例子，不是这次重新扫描的结果。

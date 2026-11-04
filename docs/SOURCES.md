# 引用与核对

核对日期：2026-11-04。  
算法仓库提交：[`b220448766ab4ee4c83d58a67d51f0cb5bda86c2`](https://github.com/xai-org/x-algorithm/commit/b220448766ab4ee4c83d58a67d51f0cb5bda86c2)（2026-11-03，Open-source X Recommendation Algorithm）。  
`home-mixer/params/param.rs` 文件头记录：`mirrored from config feature-switch defaults; last sync 2026-11-02T16:00:39Z`。

本站及相关 Markdown 文档均属于第三方独立技术解读，开源许可参见仓库根目录 `LICENSE`（MIT）。x-algorithm 本身采用 Apache-2.0 协议。文中所列的所有代码标识符、默认参数与计分公式，均严格对应公开源码本身，并非 X 或 xAI 官方出品的技术文档。

文档内容全部由人工直接撰写。截至 2026-11-04 复查时，本地环境中仍未配置 `agy` / `gemini` 及相关 API 密钥，因此 Shadowban 对应章节未做 Gemini 润色。

## 算法

- 源码仓库：<https://github.com/xai-org/x-algorithm>
- README（推荐流水线、过滤对照表、常见权重误读及 2026-08 至 2026-10 更新日志）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/README.md>
- 权重配置镜像：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/param.rs>
- 核心常量定义（48 小时半衰、TopK 50、平滑偏移 0.001）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/params/config.rs>
- 价值模型打分算法：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/scoring.rs>
- 权重数据结构与互关加成机制：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/xai-value-model/weights.rs>
- 本地加权打分逻辑（多样性降权硬编码关闭）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/value_model.rs>
- 二次重算参数（含另一套字面量、多样性、OON、DPP 开关）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/params.rs>
- 二次重算入口：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/scoring/value_model.rs>
- 向上游请求将 `compute_value_model` 设为 true 的调用点：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/vm_ranker_request.rs>
- DPP 进程级启动开关（默认关闭）：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/vm-ranker/args.rs>
- 作者冷启动打分实现：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/scorers/author_cold_start.rs>
- 互关机制变更说明：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/docs/BIDIRECTIONAL_BOOST_CHANGE.md>
- 候选流水线与过滤器执行时序：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs>
- `VFFilter` 实际丢弃动作清单：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/filters/vf_filter.rs>
- 动作枚举定义：<https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/visibility-filtering-client/models.rs>
- 官方 Under the Hood 产品入口：<https://x.com/i/jf/under_the_hood>

## 可见性检测

- Shadowban Radar 首页：<https://shadowbanradar.com/>
- 方法论说明（4 项基础检查、Untestable 状态与综合评分体系）：<https://shadowbanradar.com/methodology>
- 与官方 Under the Hood 的异同对照（第三方站点转述）：<https://shadowbanradar.com/x-under-the-hood>

## 本仓库

- 推荐流水线拆解：[docs/01-pipeline.md](01-pipeline.md)
- 计分模型与打分权重：[docs/02-scoring-weights.md](02-scoring-weights.md)
- 过滤机制与可见性规则：[docs/03-filters-visibility.md](03-filters-visibility.md)
- 面向创作者的运营取舍：[docs/04-ops-implications.md](04-ops-implications.md)
- 第三方检测工具可信度评估：[docs/05-shadowban-radar.md](05-shadowban-radar.md)
- 源码提取笔记：[docs/raw/code-extract.md](raw/code-extract.md)

## 核对过、因而写进页面的事实

- 主表中的所有打分权重以及 0 权重项，均取自 param.rs 中 `param!` 宏定义的默认值。
- vm-ranker 中发现的五处字面量分叉差异，来自对两份 `param!` 配置的逐键严格比对。
- 多样性惩罚公式以及 k = 0,1,2 对应的折扣乘数，均基于 `diversity_multiplier` 源码计算逻辑与默认 decay/floor 常量得出。
- 站外内容（OON）权重 0.75、话题权重 0.5、新用户判断阈值默认 0，均出自 vm-ranker 模块。
- 作者冷启动中的几个关键常数（200 / 15–16 / 50000 / 7200 / Beta(0.75, 49.25)），直接来自 param.rs 与 `author_cold_start.rs` 源码。
- 召回候选集截断 TopK 50、推文最大半衰/存活期 48 小时、负分分母平滑偏移量 0.001，均直接写在 `config.rs` 中。
- 各路召回源的数量上限：Thunder 1200 条、Phoenix 1000 条、TweetMixer 800 条（且线上配置默认关闭）、SimClusters 源码写死 800 条、Popular 500 条。
- `VFFilter` 过滤阶段不会丢弃带有 Interstitial、Avoid 或 Downrank 标记的推文。
- 官方开源的整套打分体系中，完全没有出现 Premium / Blue 相关的加权项。
- Radar 的 4 项基础检测、Untestable 状态不参与计分、以及 “No shadowban detected” 的具体判定含义，均对齐自其官方方法论页面（2026-11-04 再次核对确认）。
- ShadowCreed 的评分构成（画像权重 68 + 活跃度权重 32）、仅在四项排查全绿时才会展示得分、测试账号 @mate_mattt 测得 “No shadowban detected” 且评分为 60/100 Solid、实际曝光浏览量仅约占粉丝数的 2.9%、全网抽样中 Untestable 比例约为 40%–43% 等数据，均引自 2026-11-04 的可靠性专项评估报告及其引用的测试结果页、tweepcred-score 与统计页面，并非本手册自行重新全网扫描产出的数据。

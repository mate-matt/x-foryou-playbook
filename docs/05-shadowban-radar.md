# 05 · Shadowban Radar 可信度

研究日：2026-11-04（Asia/Shanghai）。  
对象：[Shadowban Radar](https://shadowbanradar.com/)。  
这一章把当时的可靠性评估收成中文，并和 [x-algorithm](https://github.com/xai-org/x-algorithm) 的可见性 / 排序分界对在一起。方法论页：<https://shadowbanradar.com/methodology>（页面 Open Graph 标记 2026-11-02）。对照页：<https://shadowbanradar.com/x-under-the-hood>。

环境里仍然没有 Gemini CLI，中文是按这份研究直接写的，链接和数字没有改。

## 执行结论

有用，置信度中等。适合当作一份**带日期的公开表面快照**，不适合当作终局判决。

它做四项检查：搜索建议、搜索、幽灵回复、回复降权。证据不够就标 Untestable，而不是猜。这是它比含糊的「限流分」强的地方。

它**不是**官方执法，**不是** For You 的排序质量，**也不是**内部可见性标签。ShadowCreed 只是用公开信号估出来的账号权重。回复降权和搜索的瞬时失败，是误报的主要来源。只作用于推荐、不作用于搜索的标签，以及排序分整体变低，是漏报的主要来源。站点自己统计里大约四成受检账号至少有一项限制，那是来查的人里的比例，不是全站患病率。

和 Under the Hood 是互补，不是替代。Under the Hood 是符合条件的登录主人看到的**上一个月**官方标签。Radar 是任意公开账号**此刻**的搜索和对话。时间窗和表面都不同，两边打架时可以同时为真。

四项都过，解释不了低曝光。硬可见性（搜索里没有、回复从对话里消失）和软排序（Phoenix 预测、互动、作者多样性）不是同一件事。四项通过时，去看内容和排序，不要去找「解封」。

## 四项检查

数据来自 X 对任何人给出的搜索和对话，经他们的数据提供方读取。不登录，不读内部旗标，也不从浏览量倒推这四项。

| 检查 | 在看什么 | 它自己承认看不到的 |
| --- | --- | --- |
| 搜索建议 | 输入 handle 时，下拉还出不出现。出现或不出现，是二元的 | 不同人会不会看到不同建议；「还在，但靠后」 |
| 搜索 | 这个账号最近的公开帖还回不回得来。不看排第几 | 个性化的搜索名次。没有可用响应，或手头只有转帖（X 搜索不返回转帖）时，是 Untestable。保护账号或没有帖，这项记成搜索限制，不是 Untestable |
| 幽灵回复 | 把回复所在的对话按公开方式读到头，回复还在不在 | 读不完的长楼、限制了谁能回复的楼，是 Untestable，不是失败。最近没回复过别人：这项算完成，不算失败，也不进分 |
| 回复降权 | 同一批回复：按时间读到的全文里还在，默认视图里没有 | 证明不了意图。安静的回复被高互动回复压下去，看起来一样。这是四项里最软的一项 |

每项带置信度和读取时间。搜索类检查跑起来时，站点把置信度标为高。

## 分数，以及 Untestable

- 分数 = 已经测出通过或失败的检查里，通过的占比。每一项一样重。
- Untestable **不进分数**。不当失败，也不当半分。
- 没有任何一项失败：文案是 “No shadowban detected”。
- 至少一项失败：“Shadowban detected”，并给出项数。
- 四项都测不了：“Visibility not measurable”。分数留空，不写成 0。

所以四项全过时的满分，只说明这次测成了的检查都通过。它不是可见性健康度，也不是 For You 正常。

还有一个容易看漏的洞：幽灵和回复降权如果是 Untestable，或因为最近没有回复而没进分，「No shadowban」**不能**证明回复没问题。

## ShadowCreed

四项的计分公式里没有 ShadowCreed。它写在 [tweepcred-score](https://shadowbanradar.com/tweepcred-score)：只在四项都没有发现限制时才显示，是 0–100 的账号「权重」估计，不是封禁测试。

研究里记下的结构是 9 条公开信号，加总为画像 68 加活跃 32。画像看受众、Premium、关注比、账号年龄和资料是否填全。活跃看 7 日互动、是否规律，以及按体量归一后的互动和浏览。它借用 2023 年 TweepCred 和 2026 年开源 `user-cred-v2` 的形状。`user-cred-v2` 在 x-algorithm 里是关注图和互动边上的 PageRank，**不是**这个网页上的 60 分。站点写明这不是 X 的生产分。

因此：ShadowCreed 可以当作资料和活跃度的粗卫生检查，证据弱于那四项能复看的二元结果。不要用它解释「被限流」，更不要用它解释 For You。

## 误报和漏报

值得用它的时候：你要的是**今天**、**任意公开账号**的答案，包括 Under the Hood 可能因账号太新或帖太少而看不到的号；你要把「搜索或回复表面坏了」和「只是没量」分开；你要留日期，过几天再测一次。

误报更常出在这些地方：

| 风险 | 原因 |
| --- | --- |
| 回复降权 | 默认排序不等于处罚。热闹的楼会把安静的回复压下去 |
| 搜索瞬时失败 | 接口或数据提供方抖一下，会暂时像搜索限制 |
| 只有一个观察点 | 建议和搜索会随读者、地区变 |
| 保护、空号、刚改过 handle | 老工具会公开提醒结果可能错。Radar 把一部分收成 Untestable 或私密，边角仍在 |
| 结果缓存大约 24 小时 | 他们的统计说明里提到跨日复用，判决可能是昨天的 |

漏报更常出在这些地方：

| 风险 | 原因 |
| --- | --- |
| 只限制推荐、不限制搜索 | 不关注的人的推荐里看不到，帖却仍能搜到。这接近 Under the Hood 里高召回垃圾标签的效果。Radar 可以是干净的 |
| 排序整体变低 | Phoenix 预测不高。搜索和幽灵都不会红 |
| 回复项没测成 | 见上一节。分数可以看起来很干净 |
| 根本不露在这四个表面上的限制 | 方法论写了：所有只读公开界面的工具都看不见 |

没有找到 2025–2026 年经过同行评议的误报率。独立比较文章把「查到了」当成排查的起点，不当成定案。HiSubway 的说明也写过：结果不是百分之百准确。

## 和 Under the Hood

官方入口：[https://x.com/i/jf/under_the_hood](https://x.com/i/jf/under_the_hood)，另一条路径是 <https://x.com/i/under_the_hood>。实现在 x-algorithm 的 `under-the-hood/`。

Radar 对照页转述的资格（本手册没有逐项重跑这些常量）：登录后的主人；账号大约满 1 年；那个月至少 10 条帖；报告不早于该月结束后大约 10 天。它汇报标签，不做搜索测试，也不比较排名。2026-09-19 起他们写到法律要求的可见性限制，2026-10-30 起可以列出带标签的帖。这些是站点对 X 帖子和公开代码的阅读。

| | Under the Hood | Shadowban Radar |
| --- | --- | --- |
| 来源 | 账号和帖子上的内部标签 | 公开搜索和对话 |
| 时间 | 已经结束的那个月 | 读取的那一刻 |
| 谁能看 | 符合条件的主人 | 任意公开 handle，无需登录 |
| 是不是官方 | 是，透明度报告，尽力而为 | 不是 |
| 对得上什么 | 标签带来的效果，例如不向未关注者推荐 | 搜索建议、搜索、幽灵、回复降权 |

权威顺序：X 自己的通知和 Under the Hood 标签，高于公开表面检查，高于互动启发式。第三方回答的是另一个问题。

## 和 x-algorithm

README 写的是：排序决定次序，一条帖能不能出现由 `visibility-filtering/` 另定。

- 硬路径：`VFFilter` 丢掉 `Drop`、`Tombstone`、`NotEvaluated`。`Allow`、`Interstitial`、`Avoid`、`Downrank` 留在候选里。见 [03-filters-visibility.md](03-filters-visibility.md)。
- 软路径：Avoid、Downrank、遮罩，再加上 Phoenix 对喜欢、回复、停留、举报的预测。多数「没流量」在这里。
- Under the Hood 展示的是一份公开标签名单，仓库没有说那就是生产环境的全部标签。一部分 botmaker 规则没有公开。

Radar 的四项，近似的是搜索索引和回复表面的一些症状。它既不等于「内部有一条 DROP 标签」，也不等于「For You 排名健康」。

## 别人家的检查器

同一谱系里，[shadowban.yuzurisa.com](https://shadowban.yuzurisa.com) 和 [hisubway.online/shadowban](https://hisubway.online/shadowban) 也是这四项。HiSubway 的说明写明不是百分之百准确。Circleboom 一类常常要连接 X 账号，命名不同，还有登录风险。amishadowbanned、Postory 看的面更宽，仍然是第三方。Radar 的长处是方法论写得细，并且 Untestable 不装成判决。它不因此变成官方。

站点统计页 [x-shadowban-statistics](https://shadowbanradar.com/x-shadowban-statistics) 上，受检账号里大约 40%–43% 至少有一项限制。样本是自己来查的人。不要把这个比例讲成 X 上有四成账号被影子封禁。

## @mate_mattt，2026-11-04

结果页：<https://shadowbanradar.com/r/mate_mattt>

研究记下的快照是：**No shadowban detected**，ShadowCreed **60/100 Solid**。四项没有失败。60 分是另一套公开信号估计，不是四项满分，也不是限流。同一则快照里，帖子浏览大约是粉丝数的 2.9%。这和「公开硬表面是干净的，曝光低来自排序和早期互动」一致，不是「先解封再发」。

这次数字来自该日的结果页记录，不是本手册重新扫描，也不是 X 的确认。

可以这样用：

1. 每周，或突然搜不到、回复像消失时，再查一次。记下日期、四项各自的结论和置信度。
2. 不要把 ShadowCreed 60 说成被限流。它至多反映资料和近期活跃。
3. 账号若符合 Under the Hood 的条件，按月看标签名称和作用，和 Radar 交叉，不要互相覆盖。
4. Radar 报了限制：用登出浏览器按方法论手测，再看应用内的 X 通知，然后改掉像垃圾的发法，隔日再测。
5. Radar 干净但浏览很低：看内容、发布时间、有没有人愿意回复或把链接带走。不要走「解限」叙事。公开打分权重里也没有 Premium 乘数，不要把开会员当成排序开关。ShadowCreed 的画像分会把 Premium 算进它自己的估计，那是另一套账。
6. 不要在公开场合说「X 官方确认影子封禁」，如果唯一依据是 Radar。
7. 优先用不需要登录的检查。没有必要，不要把运营账号授给要 OAuth 的检查器。

## 来源

- <https://shadowbanradar.com/>
- <https://shadowbanradar.com/methodology>
- <https://shadowbanradar.com/r/mate_mattt>
- <https://shadowbanradar.com/x-under-the-hood>
- <https://shadowbanradar.com/x-shadowban-statistics>
- <https://shadowbanradar.com/tweepcred-score>
- <https://shadowbanradar.com/best-x-shadowban-checkers>
- <https://x.com/i/under_the_hood>
- <https://x.com/i/jf/under_the_hood>
- <https://github.com/xai-org/x-algorithm>
- <https://github.com/xai-org/x-algorithm/blob/b220448766ab4ee4c83d58a67d51f0cb5bda86c2/home-mixer/filters/vf_filter.rs>
- <https://roboin.io/article/en/2026/09/04/checking-xs-official-shadowban-checker-under-the-hood/>
- <https://nav-ai.net/ai/shadowban-radar>
- <https://hisubway.online/articles/sbhelp/>
- <https://amishadowbanned.com/best-twitter-shadowban-checker>
- <https://tech-ish.com/2026/08/14/inside-xs-newly-published-visibility-filtering-code/>
- <https://help.x.com/rules-and-policies/x-reach-limited>

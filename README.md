# X 为你推荐 · 源码规则手册

一份静态解说站，说明公开仓库 [xai-org/x-algorithm](https://github.com/xai-org/x-algorithm)（Apache-2.0）里 For You 的流水线、打分权重、过滤和可见性，并单独评估 [Shadowban Radar](https://shadowbanradar.com/methodology) 能证明什么。

页面：<https://mate-matt.github.io/x-foryou-playbook/>

仓库：<https://github.com/mate-matt/x-foryou-playbook>

本解说使用 MIT 许可，见 [LICENSE](LICENSE)。算法仓库的规则原文仍归其 Apache-2.0 许可。本站与 X、xAI 无关。

## 怎么读

页面是给扫一遍的人看的。分类笔记在 `docs/`，数字和页面一致，句子更完整：

- [01 流水线](docs/01-pipeline.md)
- [02 权重与公式](docs/02-scoring-weights.md)
- [03 预过滤与可见性](docs/03-filters-visibility.md)
- [04 怎么发](docs/04-ops-implications.md)
- [05 Shadowban Radar](docs/05-shadowban-radar.md)
- [引用与核对](docs/SOURCES.md)

权重以 `home-mixer/params/param.rs` 文件头的镜像时间为准（2026-11-02）。`vm-ranker/params.rs` 有 5 个键的字面量不同，笔记里分开列了，没有揉成一个数。

## 本地打开

不需要构建。克隆后直接打开 `index.html`，或：

```bash
python3 -m http.server 8080
```

站点文件在 `main` 根目录，GitHub Pages 已从 `main` `/ (root)` 发布：

<https://mate-matt.github.io/x-foryou-playbook/>

## 关于中文

`docs/` 下的调研笔记已经过本机 Gemini（`agy` + `gemini-3.8-flash-medium`）润色：只改叙述句，**权重数字、路径、标识符、URL 保持原样**。页面 `index.html` 仍是源码核对后的原版中文。

## 不要误用

生产时间线会做实验。这里的默认值不是你此刻 For You 的保证。权重乘的是预测概率，不是互动次数。四项公开检测都通过时，低曝光不是 shadowban 证明。本仓库不会替你发帖。

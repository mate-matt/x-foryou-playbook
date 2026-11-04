(function () {
  var pos = [
    ["复制链接", 20],
    ["回复 / 引用 / 私信", 5],
    ["因此关注", 4],
    ["分享", 2],
    ["转帖", 1],
    ["喜欢", 0.66],
    ["点开", 0.3],
    ["打开链接", 0.2],
    ["看图 / 停留 / 点引用", 0.05],
    ["打开视频", 0.02],
    ["未探索帖", 0.015]
  ];
  var neg = [
    ["举报", 234],
    ["静音作者", 58.8],
    ["不感兴趣", 52.272],
    ["屏蔽作者", 31.2],
    ["没有停留", 0.02]
  ];

  function render(id, rows, negative) {
    var root = document.getElementById(id);
    if (!root) return;
    var max = Number(root.getAttribute("data-max")) || 1;
    root.innerHTML = rows.map(function (row) {
      var pct = Math.max(1.5, (row[1] / max) * 100);
      var label = negative ? "−" + row[1] : String(row[1]);
      return (
        '<div class="bar-row"><span>' + row[0] + '</span>' +
        '<span class="track"><span class="fill' + (negative ? " neg" : "") + '" style="--w:' + pct.toFixed(2) + '%"></span></span>' +
        '<span class="num">' + label + "</span></div>"
      );
    }).join("");
  }

  render("pos-bars", pos, false);
  render("neg-bars", neg, true);

  function paint() {
    document.querySelectorAll(".fill").forEach(function (el) {
      el.classList.add("on");
    });
  }
  if ("IntersectionObserver" in window) {
    var target = document.getElementById("weights");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          paint();
          io.disconnect();
        }
      });
    }, { threshold: 0.2 });
    if (target) io.observe(target);
  } else {
    paint();
  }

  var detail = document.getElementById("stage-detail");
  document.querySelectorAll(".stage").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".stage").forEach(function (other) {
        other.setAttribute("aria-pressed", other === btn ? "true" : "false");
      });
      if (detail) detail.textContent = btn.getAttribute("data-detail") || "";
    });
  });

  var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
  var sections = links.map(function (a) {
    return document.querySelector(a.getAttribute("href"));
  }).filter(Boolean);

  function spy() {
    var y = window.scrollY + 90;
    var current = sections[0];
    sections.forEach(function (sec) {
      if (sec.offsetTop <= y) current = sec;
    });
    links.forEach(function (a) {
      a.classList.toggle("active", current && a.getAttribute("href") === "#" + current.id);
    });
  }
  window.addEventListener("scroll", spy, { passive: true });
  spy();
})();

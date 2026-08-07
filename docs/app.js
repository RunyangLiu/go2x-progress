const statusMeta = {
  done: { label: "已完成" },
  doing: { label: "进行中" },
  blocked: { label: "阻塞" },
  planned: { label: "计划" }
};

const workList = document.querySelector("#work-list");
const filter = document.querySelector("#status-filter");
let progress = null;
let activeStatus = "all";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function metric(label, value, status) {
  return `<article class="metric">
    <p class="metric__label"><span class="status-dot status-dot--${status}"></span>${label}</p>
    <p class="metric__value">${value}</p>
  </article>`;
}

function renderSummary() {
  const { metrics } = progress;
  document.querySelector("#summary-grid").innerHTML = [
    metric("已完成", metrics.counts.done, "done"),
    metric("进行中", metrics.counts.doing, "doing"),
    metric("阻塞", metrics.counts.blocked, "blocked"),
    metric("计划", metrics.counts.planned, "planned")
  ].join("");

  document.querySelector("#updated-at").textContent = `更新于 ${formatDate(progress.updatedAt)}`;
  document.querySelector("#completion-value").textContent = `${metrics.completionPercent}%`;
  document.querySelector("#progress-fill").style.width = `${metrics.completionPercent}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", metrics.completionPercent);
  document.querySelector("#research-direction").textContent = progress.project.researchDirection;
  document.querySelector("#source-policy").textContent = progress.automation.sourcePolicy;
  document.querySelector("#quality-link").href = progress.quality.url;
  document.querySelector("#repo-link").href = `https://github.com/${progress.project.repository}`;
}

function renderWorkItems() {
  const items = activeStatus === "all" ? progress.items : progress.items.filter((item) => item.status === activeStatus);

  if (items.length === 0) {
    workList.innerHTML = '<p class="state-message">当前筛选没有工作项。</p>';
    return;
  }

  workList.innerHTML = items
    .map((item) => {
      const issueLink = item.issue
        ? `<a class="work-item__issue" href="${escapeHtml(item.issue.url)}">ISSUE #${item.issue.number}</a>`
        : "";
      return `<article class="work-item" data-status="${item.status}">
        <div class="work-item__top">
          <div>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="work-item__area">${escapeHtml(item.area)}</p>
          </div>
          <span class="status-label">
            <span class="status-dot status-dot--${item.status}"></span>
            ${statusMeta[item.status].label}
          </span>
        </div>
        <p class="work-item__summary">${escapeHtml(item.summary)}</p>
        <p class="work-item__next"><strong>下一步：</strong>${escapeHtml(item.nextStep)}</p>
        ${issueLink}
      </article>`;
    })
    .join("");
}

function renderActivity() {
  const activityList = document.querySelector("#activity-list");
  if (!progress.recentCommits.length) {
    activityList.innerHTML = '<p class="state-message">暂无与研发相关的仓库提交。</p>';
    return;
  }

  activityList.innerHTML = progress.recentCommits
    .map(
      (commit) => `<div class="activity-item">
        <a href="${escapeHtml(commit.url)}">${escapeHtml(commit.message)}</a>
        <code>${escapeHtml(commit.sha)}</code>
        <time datetime="${escapeHtml(commit.date)}">${formatDate(commit.date)}</time>
      </div>`
    )
    .join("");
}

filter.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-status]");
  if (!button) return;
  activeStatus = button.dataset.status;
  for (const candidate of filter.querySelectorAll("button")) {
    candidate.classList.toggle("is-active", candidate === button);
  }
  renderWorkItems();
});

try {
  const response = await fetch("progress.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  progress = await response.json();
  renderSummary();
  renderWorkItems();
  renderActivity();
} catch (error) {
  workList.innerHTML = `<p class="state-message">进度数据加载失败：${escapeHtml(error.message)}</p>`;
  document.querySelector("#updated-at").textContent = "同步异常";
}


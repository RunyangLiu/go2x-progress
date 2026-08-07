import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const observationsPath = path.join(rootDir, "progress", "codex-observations.json");
const progressPath = path.join(rootDir, "progress", "progress.json");
const docsProgressPath = path.join(rootDir, "docs", "progress.json");
const readmePath = path.join(rootDir, "README.md");
const observations = JSON.parse(fs.readFileSync(observationsPath, "utf8"));

const repository = process.env.GITHUB_REPOSITORY || observations.project.repository;
const token = process.env.GITHUB_TOKEN || "";
const apiBase = "https://api.github.com";
const pagesUrl = `https://${repository.split("/")[0].toLowerCase()}.github.io/${repository.split("/")[1]}/`;
const validStatuses = new Set(["done", "doing", "blocked", "planned"]);

const statusMeta = {
  done: { label: "status:done", color: "238636", title: "已完成" },
  doing: { label: "status:doing", color: "1f6feb", title: "进行中" },
  blocked: { label: "status:blocked", color: "da3633", title: "阻塞" },
  planned: { label: "status:planned", color: "8b949e", title: "计划" }
};

function writeIfChanged(filePath, content) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (previous === content) return false;
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

async function api(endpoint, options = {}) {
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "go2x-progress-sync",
      ...(options.headers || {})
    }
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `${response.status} ${response.statusText}`;
    throw new Error(`GitHub API ${endpoint}: ${message}`);
  }
  return payload;
}

function progressMarker(id) {
  return `<!-- go2x-progress-id:${id} -->`;
}

function areaLabel(area) {
  return `area:${area}`;
}

function renderIssueBody(item) {
  const evidence = item.evidence
    .map((entry) => `- ${entry.date}: ${entry.statement}`)
    .join("\n");

  return `${progressMarker(item.id)}

## 当前结论

${item.summary}

## 已验证证据

${evidence}

## 下一步

${item.nextStep}

> 此 Issue 由脱敏的 Codex 进展观察生成。原始会话、附件和本地路径不会上传。`;
}

async function ensureLabels(items) {
  const existingLabels = await api(`/repos/${repository}/labels?per_page=100`);
  const existingNames = new Set(existingLabels.map((label) => label.name));
  const labels = [
    ...Object.values(statusMeta).map((entry) => ({ name: entry.label, color: entry.color })),
    ...[...new Set(items.map((item) => item.area))].map((area) => ({
      name: areaLabel(area),
      color: "58a6ff"
    }))
  ];

  for (const label of labels) {
    if (existingNames.has(label.name)) continue;
    await api(`/repos/${repository}/labels`, {
      method: "POST",
      body: JSON.stringify(label)
    });
  }
}

async function fetchProgressIssues() {
  const issues = await api(`/repos/${repository}/issues?state=all&per_page=100&sort=updated`);
  return issues.filter(
    (issue) => !issue.pull_request && observations.items.some((item) => issue.body?.includes(progressMarker(item.id)))
  );
}

function labelsForItem(item) {
  return [statusMeta[item.status].label, areaLabel(item.area)];
}

async function syncIssues() {
  await ensureLabels(observations.items);
  let issues = await fetchProgressIssues();

  for (const item of observations.items) {
    const marker = progressMarker(item.id);
    const issue = issues.find((candidate) => candidate.body?.includes(marker));
    const payload = {
      title: `[${item.area}] ${item.title}`,
      body: renderIssueBody(item),
      labels: labelsForItem(item),
      state: item.status === "done" ? "closed" : "open"
    };

    if (!issue) {
      const { state, ...createPayload } = payload;
      const created = await api(`/repos/${repository}/issues`, {
        method: "POST",
        body: JSON.stringify(createPayload)
      });
      if (state === "closed") {
        await api(`/repos/${repository}/issues/${created.number}`, {
          method: "PATCH",
          body: JSON.stringify({ state: "closed" })
        });
      }
      continue;
    }

    const observationIsNewer = Date.parse(item.observedAt) > Date.parse(issue.updated_at);
    if (observationIsNewer || process.env.FORCE_CODEX_OBSERVATIONS === "1") {
      await api(`/repos/${repository}/issues/${issue.number}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    }
  }

  issues = await fetchProgressIssues();
  return issues;
}

function issueStatus(issue, fallback) {
  if (issue.state === "closed") return "done";
  const labels = new Set(issue.labels.map((label) => (typeof label === "string" ? label : label.name)));
  for (const status of ["blocked", "doing", "planned", "done"]) {
    if (labels.has(statusMeta[status].label)) return status;
  }
  return fallback;
}

async function fetchRepositorySignals() {
  const [commits, runs] = await Promise.all([
    api(`/repos/${repository}/commits?per_page=12`),
    api(`/repos/${repository}/actions/runs?status=completed&per_page=10`)
  ]);

  return {
    recentCommits: commits
      .filter((commit) => !commit.commit.message.startsWith("chore: sync progress"))
      .slice(0, 6)
      .map((commit) => ({
        sha: commit.sha.slice(0, 7),
        message: commit.commit.message.split("\n")[0],
        date: commit.commit.author.date,
        url: commit.html_url
      })),
    latestWorkflow: runs.workflow_runs.find((run) => run.name === "Sync Go2X progress") || null
  };
}

function buildItems(issues) {
  return observations.items.map((item) => {
    const issue = issues.find((candidate) => candidate.body?.includes(progressMarker(item.id)));
    return {
      ...item,
      status: issue ? issueStatus(issue, item.status) : item.status,
      issue: issue
        ? {
            number: issue.number,
            url: issue.html_url,
            updatedAt: issue.updated_at
          }
        : null
    };
  });
}

function buildMetrics(items) {
  const counts = Object.fromEntries([...validStatuses].map((status) => [status, 0]));
  for (const item of items) counts[item.status] += 1;
  return {
    total: items.length,
    counts,
    completionPercent: Math.round((counts.done / items.length) * 100)
  };
}

function markdownEscape(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderReadme(progress) {
  const rows = progress.items
    .map((item) => {
      const title = item.issue ? `[${item.title}](${item.issue.url})` : item.title;
      return `| ${title} | ${item.area} | ${statusMeta[item.status].title} | ${markdownEscape(item.nextStep)} |`;
    })
    .join("\n");

  return `# Go2X 二次开发进展

[![Sync Go2X progress](https://github.com/${repository}/actions/workflows/progress.yml/badge.svg)](https://github.com/${repository}/actions/workflows/progress.yml)

交互式进度面板：[${pagesUrl}](${pagesUrl})

当前完成度：**${progress.metrics.completionPercent}%**，已完成 ${progress.metrics.counts.done}/${progress.metrics.total} 项。

研究方向：**${progress.project.researchDirection}**

| 工作项 | 方向 | 状态 | 下一步 |
|---|---|---|---|
${rows}

## 数据边界

本仓库只保存脱敏后的进展观察、GitHub Issues、提交与自动检查结果。Codex 原始会话、附件、本地绝对路径和凭据不会上传。
`;
}

let issues = [];
let signals = { recentCommits: [], latestWorkflow: null };

if (token) {
  issues = await syncIssues();
  signals = await fetchRepositorySignals();
}

const items = buildItems(issues);
const itemUpdateTimes = items.map((item) => item.issue?.updatedAt || item.observedAt);
const updatedAt = [...itemUpdateTimes].sort().at(-1) || observations.lastReviewedAt;
const progress = {
  schemaVersion: 1,
  project: observations.project,
  updatedAt,
  metrics: buildMetrics(items),
  items,
  recentCommits: signals.recentCommits,
  quality: {
    status: signals.latestWorkflow?.conclusion || (token ? "pending" : "local"),
    url: signals.latestWorkflow?.html_url || `https://github.com/${repository}/actions/workflows/progress.yml`
  },
  automation: {
    issueSource: `https://github.com/${repository}/issues`,
    pagesUrl,
    sourcePolicy: observations.project.sourcePolicy
  }
};

const serialized = `${JSON.stringify(progress, null, 2)}\n`;
const changed = [
  writeIfChanged(progressPath, serialized),
  writeIfChanged(docsProgressPath, serialized),
  writeIfChanged(readmePath, renderReadme(progress))
].some(Boolean);

console.log(
  JSON.stringify(
    {
      ok: true,
      repository,
      issueCount: issues.length,
      completionPercent: progress.metrics.completionPercent,
      changed
    },
    null,
    2
  )
);

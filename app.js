const STORAGE_KEY = "my-github-work-homepage";
const COLLECTIONS = ["workLogs", "leetcode", "projects"];

const seedData = {
  workLogs: [
    {
      id: crypto.randomUUID(),
      date: today(),
      keyPoints: "搭建个人 GitHub Pages 主页；整理 LeetCode 打卡、项目记录和学习日志的数据结构。"
    }
  ],
  leetcode: [
    {
      id: crypto.randomUUID(),
      date: today(),
      number: "1",
      title: "Two Sum",
      difficulty: "Easy",
      tags: "数组, 哈希表",
      url: "https://leetcode.cn/problems/two-sum/",
      solution: "用哈希表保存已遍历数字及下标。遍历到 x 时查找 target - x 是否存在，时间复杂度 O(n)，空间复杂度 O(n)。"
    }
  ],
  projects: [
    {
      id: crypto.randomUUID(),
      date: today(),
      name: "个人 GitHub Pages 工作主页",
      stage: "开发",
      progress: "60",
      progressNote: "完成静态页面与本地数据结构设计。",
      summary: "先用纯静态方案降低维护成本，后续可以把数据迁移到云端，供协作者一起添加记录。"
    }
  ]
};

const config = window.APP_CONFIG || {};
const supabaseKey = config.supabasePublicKey || config.supabaseAnonKey || "";
const cloudEnabled = Boolean(config.supabaseUrl && supabaseKey);
const tableName = config.tableName || "work_records";
const authors = normalizeAuthors(config.authors);

let state = { workLogs: [], leetcode: [], projects: [] };
let activeDifficulty = "全部";
let activeAuthor = "全部";

const forms = {
  work: document.querySelector("#workForm"),
  leetcode: document.querySelector("#leetcodeForm"),
  project: document.querySelector("#projectForm")
};

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = today();
});

initAuthorControls();

forms.work.addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = { id: crypto.randomUUID(), ...formToObject(forms.work) };
  await addRecord("workLogs", item);
  forms.work.reset();
  forms.work.elements.date.value = today();
});

forms.leetcode.addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = { id: crypto.randomUUID(), ...formToObject(forms.leetcode) };
  await addRecord("leetcode", item);
  forms.leetcode.reset();
  forms.leetcode.elements.date.value = today();
  forms.leetcode.elements.difficulty.value = "Medium";
});

forms.project.addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = { id: crypto.randomUUID(), ...formToObject(forms.project) };
  await addRecord("projects", item);
  forms.project.reset();
  forms.project.elements.date.value = today();
  forms.project.elements.stage.value = "开发";
  forms.project.elements.progress.value = "30";
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeDifficulty = button.dataset.difficulty;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderLeetcode();
  });
});

function initAuthorControls() {
  const options = authors.map((author) => `<option value="${escapeAttribute(author.id)}">${escapeHtml(author.name)}</option>`).join("");
  document.querySelectorAll("[data-author-select]").forEach((select) => {
    select.innerHTML = options;
  });

  const target = document.querySelector("#authorFilters");
  if (!target) return;

  target.innerHTML = [
    `<button type="button" class="author-filter active" data-author="全部">全部</button>`,
    ...authors.map((author) => `
      <button type="button" class="author-filter" data-author="${escapeAttribute(author.id)}">
        <span class="author-dot" style="background:${escapeAttribute(author.color)}"></span>
        ${escapeHtml(author.name)}
      </button>
    `)
  ].join("");

  target.querySelectorAll(".author-filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeAuthor = button.dataset.author;
      target.querySelectorAll(".author-filter").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });
}

function normalizeAuthors(value) {
  const fallback = [
    { id: "me", name: "我", color: "#246b55" },
    { id: "friend", name: "朋友", color: "#2d5f91" }
  ];
  const source = Array.isArray(value) && value.length ? value : fallback;

  return source.map((author, index) => ({
    id: author.id || `person-${index + 1}`,
    name: author.name || `成员 ${index + 1}`,
    color: author.color || fallback[index % fallback.length].color
  }));
}

document.querySelector("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `work-homepage-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importData").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = normalizeState(JSON.parse(await file.text()));
    state = imported;
    await saveAll(imported);
    render();
  } catch {
    alert("导入失败：请选择符合格式的 JSON 文件。");
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#clearData").addEventListener("click", async () => {
  if (!confirm("确定清空所有记录吗？云同步模式下也会清空云端数据。")) return;
  state = { workLogs: [], leetcode: [], projects: [] };
  await saveAll(state);
  render();
});

init();

async function init() {
  setStatus(cloudEnabled ? "云同步模式" : "本地模式");

  try {
    state = cloudEnabled ? await loadCloudState() : loadLocalState();
  } catch (error) {
    console.error(error);
    setStatus("云同步失败，已使用本地模式");
    state = loadLocalState();
  }

  render();
}

async function addRecord(collection, item) {
  state[collection].unshift(item);
  render();

  try {
    if (cloudEnabled) {
      await insertCloudRecord(collection, item);
    } else {
      saveLocalState(state);
    }
  } catch (error) {
    console.error(error);
    alert("保存失败，请检查云端配置或网络连接。");
    state[collection] = state[collection].filter((record) => record.id !== item.id);
    render();
  }
}

async function deleteRecord(collection, id) {
  const previous = [...state[collection]];
  state[collection] = state[collection].filter((item) => item.id !== id);
  render();

  try {
    if (cloudEnabled) {
      await deleteCloudRecord(id);
    } else {
      saveLocalState(state);
    }
  } catch (error) {
    console.error(error);
    alert("删除失败，请检查云端配置或网络连接。");
    state[collection] = previous;
    render();
  }
}

async function saveAll(value) {
  if (!cloudEnabled) {
    saveLocalState(value);
    return;
  }

  await clearCloudRecords();
  const rows = COLLECTIONS.flatMap((collection) =>
    value[collection].map((item) => toCloudRow(collection, item))
  );
  if (rows.length) await requestCloud("", { method: "POST", body: JSON.stringify(rows) });
}

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    saveLocalState(seedData);
    return normalizeState(seedData);
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return normalizeState(seedData);
  }
}

function saveLocalState(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

async function loadCloudState() {
  const rows = await requestCloud("?select=id,collection,payload,created_at&order=created_at.desc");
  const next = { workLogs: [], leetcode: [], projects: [] };

  rows.forEach((row) => {
    if (!COLLECTIONS.includes(row.collection)) return;
    next[row.collection].push({ id: row.id, ...row.payload });
  });

  return normalizeState(next);
}

async function insertCloudRecord(collection, item) {
  await requestCloud("", {
    method: "POST",
    body: JSON.stringify(toCloudRow(collection, item))
  });
}

async function deleteCloudRecord(id) {
  await requestCloud(`?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function clearCloudRecords() {
  await requestCloud("?id=not.is.null", { method: "DELETE" });
}

function toCloudRow(collection, item) {
  const { id, ...payload } = item;
  return {
    id,
    collection,
    payload
  };
}

async function requestCloud(query = "", options = {}) {
  const response = await fetch(`${trimSlash(config.supabaseUrl)}/rest/v1/${tableName}${query}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: options.body
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return [];
  return response.json();
}

function normalizeState(value) {
  return {
    workLogs: Array.isArray(value.workLogs) ? value.workLogs.map(normalizeStudyLog) : [],
    leetcode: Array.isArray(value.leetcode) ? value.leetcode.map((item) => ({
      author: defaultAuthorId(),
      difficulty: "Medium",
      tags: "",
      solution: "",
      ...withId(item)
    })) : [],
    projects: Array.isArray(value.projects) ? value.projects.map((item) => ({
      author: defaultAuthorId(),
      stage: "开发",
      progress: "0",
      progressNote: "",
      summary: "",
      ...withId(item)
    })) : []
  };
}

function normalizeStudyLog(item) {
  const normalized = withId(item);
  normalized.author = normalized.author || defaultAuthorId();
  if (normalized.keyPoints) return normalized;

  const legacyParts = [normalized.title, normalized.done, normalized.blockers, normalized.next].filter(Boolean);
  return {
    id: normalized.id,
    date: normalized.date,
    author: normalized.author,
    keyPoints: legacyParts.join("\n")
  };
}

function withId(item) {
  return {
    ...item,
    id: item.id || crypto.randomUUID()
  };
}

function defaultAuthorId() {
  return authors[0]?.id || "me";
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function trimSlash(value) {
  return value.replace(/\/$/, "");
}

function setStatus(text) {
  const target = document.querySelector("#cloudStatus");
  if (target) target.textContent = text;
}

function render() {
  renderMetrics();
  renderWorkLogs();
  renderLeetcode();
  renderProjects();
  renderArchive();
}

function renderMetrics() {
  document.querySelector("#workCount").textContent = state.workLogs.length;
  document.querySelector("#leetcodeCount").textContent = state.leetcode.length;
  document.querySelector("#projectCount").textContent = state.projects.length;
  document.querySelector("#streakCount").textContent = calculateStreak(state.leetcode);
}

function renderWorkLogs() {
  const target = document.querySelector("#workList");
  const list = filterByAuthor(state.workLogs);
  if (!list.length) return renderEmpty(target);

  target.innerHTML = list
    .map((item) => `
      <article class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
        <header>
          <div>
            <div class="meta"><span>${escapeHtml(item.date)}</span>${authorPill(item.author)}<span class="pill">学习日志</span></div>
            <h3>学习关键点</h3>
          </div>
          ${deleteButton("workLogs", item.id)}
        </header>
        <p>${escapeHtml(item.keyPoints)}</p>
      </article>
    `)
    .join("");
  bindDeleteButtons(target);
}

function renderLeetcode() {
  const target = document.querySelector("#leetcodeList");
  const difficultyList = activeDifficulty === "全部"
    ? state.leetcode
    : state.leetcode.filter((item) => item.difficulty === activeDifficulty);
  const list = filterByAuthor(difficultyList);

  if (!list.length) return renderEmpty(target);

  target.innerHTML = list
    .map((item) => {
      const title = `#${escapeHtml(item.number)} ${escapeHtml(item.title)}`;
      return `
        <article class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
          <header>
            <div>
              <div class="meta">
                <span>${escapeHtml(item.date)}</span>
                ${authorPill(item.author)}
                <span class="pill ${item.difficulty.toLowerCase()}">${escapeHtml(item.difficulty)}</span>
              </div>
              <h3>${safeUrl(item.url) ? `<a href="${escapeAttribute(safeUrl(item.url))}" target="_blank" rel="noreferrer">${title}</a>` : title}</h3>
            </div>
            ${deleteButton("leetcode", item.id)}
          </header>
          <p>${escapeHtml(item.tags || "未填写标签")}</p>
          ${fieldBlock("题解与思路", item.solution)}
        </article>
      `;
    })
    .join("");
  bindDeleteButtons(target);
}

function renderProjects() {
  const target = document.querySelector("#projectList");
  const list = filterByAuthor(state.projects);
  if (!list.length) return renderEmpty(target);

  target.innerHTML = list
    .map((item) => `
      <article class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
        <header>
          <div>
            <div class="meta">
              <span>${escapeHtml(item.date)}</span>
              ${authorPill(item.author)}
              <span class="pill">${escapeHtml(item.stage)}</span>
            </div>
            <h3>${escapeHtml(item.name)}</h3>
          </div>
          ${deleteButton("projects", item.id)}
        </header>
        <div class="progress-track" aria-label="项目进度 ${escapeAttribute(item.progress)}%">
          <div class="progress-bar" style="width: ${Number(item.progress) || 0}%"></div>
        </div>
        <p>进度：${escapeHtml(item.progress)}%</p>
        ${fieldBlock("今日进展", item.progressNote)}
        ${fieldBlock("归纳总结", item.summary)}
      </article>
    `)
    .join("");
  bindDeleteButtons(target);
}

function renderArchive() {
  const target = document.querySelector("#archiveList");
  const combined = [
    ...filterByAuthor(state.workLogs).map((item) => ({ type: "学习", title: firstLine(item.keyPoints), date: item.date, author: item.author })),
    ...filterByAuthor(state.leetcode).map((item) => ({ type: "刷题", title: `#${item.number} ${item.title}`, date: item.date, author: item.author })),
    ...filterByAuthor(state.projects).map((item) => ({ type: "项目", title: item.name, date: item.date, author: item.author }))
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 9);

  if (!combined.length) return renderEmpty(target);

  target.innerHTML = combined
    .map((item) => `
      <article class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
        <div class="meta"><span>${escapeHtml(item.date)}</span>${authorPill(item.author)}<span class="pill">${escapeHtml(item.type)}</span></div>
        <h3>${escapeHtml(item.title)}</h3>
      </article>
    `)
    .join("");
}

function filterByAuthor(items) {
  if (activeAuthor === "全部") return items;
  return items.filter((item) => (item.author || defaultAuthorId()) === activeAuthor);
}

function authorFor(id) {
  return authors.find((author) => author.id === id) || authors[0];
}

function authorPill(id) {
  const author = authorFor(id);
  return `
    <span class="pill author-pill" style="--author-color:${escapeAttribute(author.color)}">
      <span class="author-dot" aria-hidden="true"></span>
      ${escapeHtml(author.name)}
    </span>
  `;
}

function firstLine(value = "") {
  return String(value).split(/\r?\n/).find(Boolean) || "学习日志";
}

function fieldBlock(label, value) {
  if (!value) return "";
  return `<section><div class="meta"><strong>${label}</strong></div><p>${escapeHtml(value)}</p></section>`;
}

function deleteButton(collection, id) {
  return `
    <div class="record-actions">
      <button type="button" data-collection="${collection}" data-id="${id}" title="删除" aria-label="删除">×</button>
    </div>
  `;
}

function bindDeleteButtons(scope) {
  scope.querySelectorAll("[data-collection][data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const { collection, id } = button.dataset;
      deleteRecord(collection, id);
    });
  });
}

function renderEmpty(target) {
  target.innerHTML = document.querySelector("#emptyState").innerHTML;
}

function calculateStreak(items) {
  const days = [...new Set(items.map((item) => item.date))].sort((a, b) => b.localeCompare(a));
  if (!days.length) return 0;

  let streak = 0;
  const cursor = new Date(today());
  const daySet = new Set(days);

  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function safeUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

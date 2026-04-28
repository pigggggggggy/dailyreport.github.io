const STORAGE_KEY = "my-github-work-homepage";
const AUTH_STORAGE_KEY = `${STORAGE_KEY}:supabase-session`;
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
const authUsers = normalizeAuthUsers(config.authUsers, authors);

let state = { workLogs: [], leetcode: [], projects: [] };
let activeDifficulty = "全部";
let activeAuthor = "全部";
let authSession = loadAuthSession();

const forms = {
  work: document.querySelector("#workForm"),
  leetcode: document.querySelector("#leetcodeForm"),
  project: document.querySelector("#projectForm"),
  login: document.querySelector("#loginForm")
};

document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.value = today();
});

initAuthorControls();
initAuthControls();

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
    { id: "zjw", name: "zjw", color: "#246b55" },
    { id: "sxk", name: "sxk", color: "#2d5f91" }
  ];
  const source = Array.isArray(value) && value.length ? value : fallback;

  return source.map((author, index) => ({
    id: author.id || `person-${index + 1}`,
    name: author.name || `成员 ${index + 1}`,
    color: author.color || fallback[index % fallback.length].color
  }));
}

function normalizeAuthUsers(value, authorList) {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      username: item.username || item.id,
      email: item.email,
      name: item.name || item.username || item.id
    })).filter((item) => item.username && item.email);
  }

  const source = value && typeof value === "object" ? value : {};
  return authorList.map((author) => ({
    username: author.id,
    name: author.name,
    email: source[author.id] || `${author.id}@dailyreport.local`
  }));
}

function initAuthControls() {
  if (!forms.login) return;

  const username = forms.login.elements.username;
  username.innerHTML = authUsers.map((user) =>
    `<option value="${escapeAttribute(user.username)}">${escapeHtml(user.name || user.username)}</option>`
  ).join("");

  forms.login.addEventListener("submit", async (event) => {
    event.preventDefault();
    await login(formToObject(forms.login));
  });

  document.querySelector("#logoutButton")?.addEventListener("click", logout);
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
  renderAuthState();

  if (cloudEnabled && !hasValidSession()) {
    setStatus("需要登录");
    render();
    return;
  }

  setStatus(cloudEnabled ? `已登录：${currentUsername() || "云同步"}` : "本地模式");

  try {
    state = cloudEnabled ? await loadCloudState() : loadLocalState();
  } catch (error) {
    console.error(error);
    setStatus("云同步失败，已使用本地模式");
    state = loadLocalState();
  }

  render();
}

async function login({ username, password }) {
  const user = authUsers.find((item) => item.username === username);
  if (!user) {
    setAuthMessage("账号不存在。");
    return;
  }

  setAuthMessage("正在登录...");

  try {
    const response = await fetch(`${trimSlash(config.supabaseUrl)}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: user.email,
        password
      })
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status}`);
    }

    const data = await response.json();
    authSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      username: user.username
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    forms.login.reset();
    setAuthMessage("");
    await init();
  } catch (error) {
    console.error(error);
    setAuthMessage("登录失败，请检查账号密码，或确认 Supabase Auth 里已经创建该用户。");
  }
}

function logout() {
  authSession = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  state = { workLogs: [], leetcode: [], projects: [] };
  renderAuthState();
  setStatus("需要登录");
  render();
}

function loadAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    return session && session.access_token ? session : null;
  } catch {
    return null;
  }
}

function hasValidSession() {
  return Boolean(authSession?.access_token && authSession.expires_at > Math.floor(Date.now() / 1000) + 30);
}

function currentUsername() {
  return authUsers.find((user) => user.username === authSession?.username)?.name || authSession?.username;
}

function renderAuthState() {
  const locked = cloudEnabled && !hasValidSession();
  document.body.classList.toggle("auth-locked", locked);
  document.querySelector("#authPanel").hidden = !locked;
  document.querySelector("#logoutButton").hidden = !cloudEnabled || locked;
}

function setAuthMessage(text) {
  const target = document.querySelector("#authMessage");
  if (target) target.textContent = text;
}

async function addRecord(collection, item) {
  if (cloudEnabled && !hasValidSession()) {
    alert("请先登录后再保存。");
    renderAuthState();
    return;
  }

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
  if (cloudEnabled && !hasValidSession()) {
    alert("请先登录后再删除。");
    renderAuthState();
    return;
  }

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

  if (!hasValidSession()) {
    throw new Error("Login required");
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
  if (cloudEnabled && !hasValidSession()) {
    throw new Error("Login required");
  }

  const response = await fetch(`${trimSlash(config.supabaseUrl)}/rest/v1/${tableName}${query}`, {
    method: options.method || "GET",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${authSession.access_token}`,
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
  return authors[0]?.id || "zjw";
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
      <details class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
        <summary>
          <span>
            <span class="meta"><span>${escapeHtml(item.date)}</span>${authorPill(item.author)}<span class="pill">学习日志</span></span>
            <strong>${escapeHtml(firstLine(item.keyPoints))}</strong>
          </span>
          ${deleteButton("workLogs", item.id)}
        </summary>
        <div class="record-detail">
          ${detailBlock("完整关键点", item.keyPoints)}
        </div>
      </details>
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
        <details class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
          <summary>
            <span>
              <span class="meta">
                <span>${escapeHtml(item.date)}</span>
                ${authorPill(item.author)}
                <span class="pill ${item.difficulty.toLowerCase()}">${escapeHtml(item.difficulty)}</span>
              </span>
              <strong>${safeUrl(item.url) ? `<a href="${escapeAttribute(safeUrl(item.url))}" target="_blank" rel="noreferrer">${title}</a>` : title}</strong>
              <span class="summary-line">${escapeHtml(item.tags || "未填写标签")}</span>
            </span>
            ${deleteButton("leetcode", item.id)}
          </summary>
          <div class="record-detail">
            ${detailBlock("标签", item.tags || "未填写标签")}
            ${detailBlock("题解与思路", item.solution)}
          </div>
        </details>
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
      <details class="record-card" style="--author-color:${escapeAttribute(authorFor(item.author).color)}">
        <summary>
          <span>
            <span class="meta">
              <span>${escapeHtml(item.date)}</span>
              ${authorPill(item.author)}
              <span class="pill">${escapeHtml(item.stage)}</span>
            </span>
            <strong>${escapeHtml(item.name)}</strong>
            <span class="summary-line">进度：${escapeHtml(item.progress)}%</span>
          </span>
          ${deleteButton("projects", item.id)}
        </summary>
        <div class="progress-track" aria-label="项目进度 ${escapeAttribute(item.progress)}%">
          <div class="progress-bar" style="width: ${Number(item.progress) || 0}%"></div>
        </div>
        <div class="record-detail">
          ${detailBlock("今日进展", item.progressNote)}
          ${detailBlock("归纳总结", item.summary)}
        </div>
      </details>
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

function detailBlock(label, value) {
  if (!value) return "";
  return `<section><div class="meta"><strong>${escapeHtml(label)}</strong></div><p>${escapeHtml(value)}</p></section>`;
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
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
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

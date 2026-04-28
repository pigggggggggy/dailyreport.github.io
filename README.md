# 我的 GitHub Pages 工作主页

这是一个纯静态的个人工作主页，适合直接部署到 `username.github.io` 仓库。

## 功能

- 每日学习日志：记录学习关键点
- LeetCode 打卡：记录题号、题名、难度、标签、链接和题解
- 项目记录：记录项目阶段、进度、每日进展和归纳总结
- 数据统计：日志数量、刷题数量、项目数量和连续刷题天数
- 本地保存：数据保存在浏览器 `localStorage`
- 导入导出：支持导出 JSON，也支持从 JSON 恢复数据
- 云同步：配置 Supabase 后，协作者可以访问同一个网页并添加记录

## 使用方式

直接用浏览器打开 `index.html` 即可使用。

部署到 GitHub Pages：

1. 创建名为 `你的用户名.github.io` 的 GitHub 仓库。
2. 将 `index.html`、`styles.css`、`app.js`、`README.md` 提交到仓库根目录。
3. 在仓库 Settings -> Pages 中确认发布分支为 `main` 或 `master` 的根目录。
4. 访问 `https://你的用户名.github.io`。

## 协作者共同添加

GitHub Pages 只能托管静态网页，不能直接把访问者新增的数据写回仓库。这个项目已经预留 Supabase 云同步：

1. 在 Supabase 创建一个项目。
2. 打开 Supabase SQL Editor，执行 `supabase-schema.sql`。
3. 在 Supabase Project Settings -> API 中复制 Project URL 和 Publishable key。
4. 编辑 `config.js`：

```js
window.APP_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabasePublicKey: "你的 Publishable key",
  tableName: "work_records"
};
```

5. 把修改后的文件提交到 GitHub Pages 仓库。

配置完成后，页面右上角会显示“云同步模式”。协作者打开同一个网址后，可以添加学习日志、LeetCode 记录和项目进展。

如果需要区分两位记录人，可以在 `config.js` 里修改 `authors`：

```js
authors: [
  { id: "me", name: "你的名字", color: "#246b55" },
  { id: "friend", name: "朋友的名字", color: "#2d5f91" }
]
```

当前 SQL 允许公开读取、添加和删除记录，适合小范围协作。如果页面会公开传播，建议后续接 Supabase Auth 或收紧 RLS 权限。

## 数据建议

未配置云同步时，记录保存在当前浏览器中。建议定期点击页面右上角的导出按钮，把生成的 JSON 文件提交到仓库，避免换设备或清理浏览器后丢失记录。

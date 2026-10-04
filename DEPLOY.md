# 部署与本地运行指南

> 适用版本：v0.1.0 ｜ 最后更新：2026-10-04

---

## 一、环境要求

| 项目 | 要求 | 怎么查 |
|---|---|---|
| **Node.js** | **≥ 20.9.0**（必需，Next.js 16 的硬性要求） | `node -v` |
| npm | 随 Node 一起装即可 | `npm -v` |
| 操作系统 | Windows / macOS / Linux 都行 | — |
| 磁盘 | 装依赖约需 **500 MB** | — |

**Node 版本太低会直接报错。** 如果你的版本低于 20.9：

- macOS / Linux：用 nvm
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  nvm install 22
  nvm use 22
  ```
- Windows：去 <https://nodejs.org> 装 LTS 版（当前是 22.x）
- 通用：去 <https://nodejs.org> 下载 LTS 安装包直接覆盖安装

---

## 二、需要下载哪些文件

打包文件是 `toolbox-v0.1.0.zip`，解压后应包含以下内容（**共约 127 KB**）：

```
toolbox/
├── package.json          ← 依赖清单（必需）
├── tsconfig.json         ← TypeScript 配置（必需）
├── .gitignore            ← 忽略规则（可选）
├── README.md             ← 架构说明 + 如何加工具
├── DEPLOY.md             ← 本文档
├── scripts/
│   └── list-tools.mjs    ← 开发辅助命令
└── src/                  ← ★ 源码，全部都在这里
    ├── app/
    │   ├── globals.css        设计系统
    │   ├── layout.tsx         全局布局
    │   ├── page.tsx           首页
    │   └── tools/[slug]/      工具详情页
    ├── lib/core/              ★ 扩展内核
    │   ├── types.ts
    │   ├── registry.ts
    │   ├── plans.ts
    │   ├── flags.ts
    │   └── quota.ts
    └── tools/                 ★ 插件目录
        ├── readability/
        ├── text-diff/
        └── case-convert/
```

### ❌ 不需要下载（也不要下）

| 目录 | 大小 | 为什么不下载 |
|---|---|---|
| `node_modules/` | ~455 MB | 依赖包，`npm install` 会按 `package.json` 自动重新装 |
| `.next/` | ~41 MB | 构建产物，`npm run build` 会重新生成 |
| `next-env.d.ts` | 极小 | Next.js 自动生成 |

> 如果你是从 Git 拉取，`node_modules` 和 `.next` 已经写进 `.gitignore`，不会被拉下来。

---

## 三、本地运行（3 步）

```bash
# 1. 解压后进入项目目录
cd toolbox

# 2. 安装依赖（首次约 2-5 分钟，之后有缓存会快很多）
npm install

# 3. 启动开发服务器
npm run dev
```

看到这样的输出就成功了：

```
▲ Next.js 16.3.8 (Turbopack)
- Local:   http://localhost:3000
✓ Ready in xxxms
```

浏览器打开 **<http://localhost:3000>** 即可。

停止服务：在终端按 `Ctrl + C`。

---

## 四、生产模式运行（部署到自己机器给别人访问）

开发模式慢，给别人用请用生产模式：

```bash
npm run build     # 构建（首次约 30 秒）
npm run start     # 启动生产服务，默认 3000 端口
```

指定端口：

```bash
npx next start -p 8080
```

想让它在后台长期跑（Linux / macOS）：

```bash
# 用 pm2 管理进程，崩溃自动重启
npm install -g pm2
pm2 start npm --name toolbox -- start
pm2 save
pm2 status
```

---

## 五、其它常用命令

```bash
npm run tools:list   # 查看已注册的工具清单
```

---

## 六、常见问题

### 1. `npm install` 很慢 / 卡住
换成国内镜像源：
```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 2. 报错 `Unsupported engine` 或 `requires Node >= 20.9.0`
Node 版本太低，按第一节升级 Node。

### 3. 端口被占用 `EADDRINUSE`
换一个端口：
```bash
npx next start -p 8080
```

### 4. Windows 上 `npm run dev` 报错找不到命令
确认是先 `cd` 到项目目录再执行；仍不行就删掉 `node_modules` 重新 `npm install`。

### 5. 改了代码页面没更新
开发模式（`npm run dev`）是热更新的，保存即生效。
生产模式（`npm run start`）需要重新 `npm run build`。

### 6. 想改配色 / 字体 / 间距
全部集中在 **`src/app/globals.css`** 顶部的 CSS 变量里：

```css
:root {
  --paper:  oklch(0.968 0.014 92);   /* 纸张底色 */
  --ink:    oklch(0.235 0.012 65);   /* 正文墨色 */
  --zhu:    oklch(0.545 0.185 32);   /* 朱红强调色 */
  ...
}
```

改这几个变量就能整体换风格，不用动组件。

---

## 七、想部署到公网（可选）

本地跑通之后，如果要给别人用，三个选择：

| 方式 | 成本 | 适合 | 备注 |
|---|---|---|---|
| **Vercel** | 免费额度够用 | 最省事 | 连上 Git 仓库自动部署，绑域名即可 |
| **阿里云 / 腾讯云轻量服务器** | 约 60 元/月 | 国内访问快 | **需 ICP 备案**，按第四节用 pm2 跑 |
| **自己的机器 + 内网穿透** | 免费 | 临时给人看 | frp / cloudflared 等 |

> 提醒：部署到**国内服务器**必须做 ICP 备案，否则域名无法解析。
> 部署到 Vercel 等境外平台则不需要备案，但国内访问速度可能偏慢。

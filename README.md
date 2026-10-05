# 工具箱 · Toolbox

一个**模块化、可无限扩展**的在线工具站。
当前阶段：**免费版**（无需注册、无需支付），架构已为后续商业化预留好开关。

---

## 🎯 设计目标

| 目标 | 实现方式 |
|---|---|
| 免费版先跑起来 | `flags.payment = false`，所有工具不设付费墙 |
| 后期功能无限扩展 | 工具注册表 + 插件化目录，加功能零改动 |
| 后期随时收费 | `PLANS` 配置 + `flags.payment` 开关，工具代码不用动 |
| 随时灰度/回滚 | `flags` 功能开关面板 |
| 用量可控 | `QuotaAdapter` 抽象，本地存储 → 服务端无缝替换 |

---

## 🧱 架构总览

```
toolbox/
├── src/
│   ├── lib/
│   │   └── core/              ★ 扩展内核（不要随便改，改了影响所有工具）
│   │       ├── types.ts       类型契约
│   │       ├── registry.ts    工具注册表 —— 新增功能的唯一入口
│   │       ├── plans.ts       套餐与限额 —— 收费逻辑唯一事实来源
│   │       ├── flags.ts       功能开关 —— 灰度/回滚面板
│   │       └── quota.ts       用量配额 —— 免费版每日限额
│   ├── tools/                 ★ 每个功能一个目录（插件式，当前 8 个）
│   │   ├── readability/       可读性分析        text
│   │   │   └── ui.tsx
│   │   ├── text-diff/         文本对比          text
│   │   │   └── ui.tsx
│   │   ├── case-convert/      命名转换          convert
│   │   │   └── ui.tsx
│   │   ├── image-compress/    批量图片压缩      image
│   │   │   └── ui.tsx
│   │   ├── remove-bg/         AI 智能去背景     ai (beta)
│   │   │   └── ui.tsx
│   │   ├── pdf-tools/         PDF 处理          doc
│   │   │   └── ui.tsx
│   │   ├── resume-builder/    简历生成器        doc
│   │   │   └── ui.tsx
│   │   └── xhs-copy/          小红书文案生成    text
│   │       └── ui.tsx
│   └── app/                   页面（Next.js App Router）
├── scripts/
│   └── list-tools.mjs         开发辅助：npm run tools:list
└── package.json
```

**核心思想：`core/` 是稳定的地基，`tools/` 是可以随意生长的积木。**

---

## 🚀 新增一个功能（3 步，约 10 分钟）

### 1. 新建插件目录

```
src/tools/<slug>/ui.tsx
```

```tsx
// src/tools/json-format/ui.tsx
'use client';

import { useState } from 'react';
import type { ToolProps } from '../../lib/core/types';

export default function JsonFormat({ tool, capabilities }: ToolProps) {
  const [input, setInput] = useState('');
  // capabilities 已按当前套餐裁剪，直接用即可，不要自己判断 plan
  return (
    <div>
      <textarea
        value={input}
        maxLength={capabilities.maxInputLength}
        onChange={(e) => setInput(e.target.value)}
      />
      <button>格式化</button>
    </div>
  );
}
```

### 2. 在注册表加一行

```ts
// src/lib/core/registry.ts
register({
  slug: 'json-format',
  name: 'JSON 格式化',
  summary: '一键美化 / 压缩 / 校验 JSON。',
  category: 'dev',
  tags: ['开发', '格式化'],
  plan: 'free',        // 想收费就写 'pro'
  status: 'live',
  icon: '{ }',
  component: () => import('../../tools/json-format/ui'),
});
```

### 3. 完成 ✅

以下全部**自动生效**，无需额外代码：

- 路由 `/tools/json-format`
- 首页/列表页卡片
- 分类与标签筛选
- 免费/付费判定与解锁提示
- 每日用量配额拦截

```bash
npm run tools:list   # 体检：确认注册成功
```

---

## 💰 将来要收费时（不用改任何工具代码）

```ts
// src/lib/core/flags.ts
export const flags = {
  auth: true,        // ← 打开账号体系
  payment: true,     // ← 打开支付
  ...
};
```

```ts
// src/lib/core/plans.ts
export async function getUserPlan(userId?: string): Promise<PlanId> {
  // ← 改成查你的订阅表 / 支付平台回调
  return 'free';
}
```

工具本身**一个字都不用改** —— 它只认 `capabilities`，不认套餐名。

---

## 📦 免费版 / 专业版 差异

| 能力 | 免费版 | 专业版 |
|---|---|---|
| 核心处理 | ✅ | ✅ |
| 每日次数 | 20 | 无限 |
| 单次字符数 | 2 万 | 50 万 |
| 批量处理 | ❌ | ✅ |
| 结果导出 | ❌ | ✅ |
| API 接入 | ❌ | ✅ |

> 现阶段**全部按免费版放行**，先验证有人用，再谈收费。

---

## 🛠 常用命令

```bash
npm run dev          # 本地开发
npm run build        # 生产构建
npm run tools:list   # 查看已注册工具
```

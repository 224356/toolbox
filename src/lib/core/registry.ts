import type { PlanId, ToolCategory, ToolDefinition, ToolLimits } from './types';
import { isToolUnlocked, resolveCapabilities } from './plans';

/**
 * 工具注册表 —— 新增功能的唯一入口。
 *
 * ══════════════════════════════════════════════════════════
 *  加一个新工具 = 3 步：
 *    1. 新建目录  src/tools/<slug>/
 *    2. 写 UI     src/tools/<slug>/ui.tsx   (default export 组件)
 *    3. 加一行    在下面 TOOLS 数组里 register(...)
 *  完成。路由、列表页、套餐校验、配额拦截全部自动生效。
 * ══════════════════════════════════════════════════════════
 */

const TOOLS: ToolDefinition[] = [];

/** 注册一个工具。可直接内联调用，保持声明式。 */
export function register(def: ToolDefinition): ToolDefinition {
  if (TOOLS.some((t) => t.slug === def.slug)) {
    throw new Error(`[registry] slug 重复: ${def.slug}`);
  }
  TOOLS.push(def);
  return def;
}

// ─────────────────────────────────────────────
//  注册区（新增功能加在这里，按分类分组）
// ─────────────────────────────────────────────

// —— 文本处理 ——
register({
  slug: 'readability',
  name: '可读性分析',
  summary: '统计字数、句长、难度等级，一眼看懂文章好不好读。',
  category: 'text',
  tags: ['写作', '统计', '分析'],
  plan: 'free',
  status: 'live',
  priority: 90,
  icon: '¶',
  limits: { maxInputLength: 50000 },
  component: () => import('../../tools/readability/ui'),
});

register({
  slug: 'text-diff',
  name: '文本对比',
  summary: '逐行对比两段文本，高亮新增、删除与改动。',
  category: 'text',
  tags: ['对比', '校对'],
  plan: 'free',
  status: 'live',
  priority: 80,
  icon: '≠',
  component: () => import('../../tools/text-diff/ui'),
});

// —— 格式转换 ——
register({
  slug: 'case-convert',
  name: '大小写与命名转换',
  summary: '驼峰、下划线、短横线、常量命名之间自由互转。',
  category: 'convert',
  tags: ['开发', '命名'],
  plan: 'free',
  status: 'live',
  priority: 70,
  icon: 'Aa',
  component: () => import('../../tools/case-convert/ui'),
});

// ─────────────────────────────────────────────
//  查询 API
// ─────────────────────────────────────────────

export function getAllTools(): ToolDefinition[] {
  return [...TOOLS].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function getTool(slug: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getToolsByCategory(): Map<ToolCategory, ToolDefinition[]> {
  const map = new Map<ToolCategory, ToolDefinition[]>();
  for (const t of getAllTools()) {
    const list = map.get(t.category) ?? [];
    list.push(t);
    map.set(t.category, list);
  }
  return map;
}

export function getToolsByTag(tag: string): ToolDefinition[] {
  return TOOLS.filter((t) => t.tags.includes(tag));
}

/** 首页/列表页用：只返回元数据，不含组件引用（利于序列化与缓存） */
export function getToolSummaries(plan: PlanId = 'free') {
  return getAllTools().map((t) => ({
    slug: t.slug,
    name: t.name,
    summary: t.summary,
    category: t.category,
    tags: t.tags,
    icon: t.icon,
    status: t.status,
    locked: !isToolUnlocked(t, plan),
    limits: resolveCapabilities(t, plan),
  }));
}

/** 套餐对比页用 */
export function countTools(plan: PlanId = 'free'): number {
  return TOOLS.filter((t) => isToolUnlocked(t, plan)).length;
}

/** 类型辅助：让 register 时获得补全 */
export type { ToolDefinition, ToolLimits };

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

// —— 图片处理 ——
register({
  slug: 'image-compress',
  name: '批量图片压缩',
  summary: '批量压缩、缩放、转格式。质量可调，全部在浏览器本地完成。',
  description:
    '拖进多张图片，调质量、定尺寸、选格式，一键批量压缩。采用 canvas 高质量降采样，大图缩小时分两级重绘以避免锯齿。图片不上传，处理结果可一键打包下载。',
  category: 'image',
  tags: ['图片', '压缩', '批量'],
  plan: 'free',
  status: 'live',
  priority: 88,
  icon: '▣',
  component: () => import('../../tools/image-compress/ui'),
});

// —— AI 能力 ——
register({
  slug: 'remove-bg',
  name: 'AI 智能去背景',
  summary: '一键抠图，输出透明背景 PNG。推理在浏览器本地进行。',
  description:
    '基于浏览器内的 ONNX 语义分割模型自动识别人物、商品、动物主体，输出透明背景的 PNG。首次使用需下载模型（之后走浏览器缓存），图片全程不上传。',
  category: 'ai',
  tags: ['图片', '抠图', 'AI'],
  plan: 'free',
  status: 'beta',
  priority: 86,
  icon: '◧',
  component: () => import('../../tools/remove-bg/ui'),
});

// —— 文档处理 ——
register({
  slug: 'pdf-tools',
  name: 'PDF 处理',
  summary: '合并、拆分提取、旋转、删页。常用一次性处理一站搞定。',
  description:
    '不用装 Acrobat，四个最常用的 PDF 一次性处理都在这里。支持页码范围写法（如 1-3,5,7-9），基于 pdf-lib 在浏览器本地完成，文件不上传。',
  category: 'doc',
  tags: ['PDF', '合并', '拆分'],
  plan: 'free',
  status: 'live',
  priority: 84,
  icon: '¶',
  component: () => import('../../tools/pdf-tools/ui'),
});

register({
  slug: 'resume-builder',
  name: '简历生成器',
  summary: '填表就能出一份排版干净的中文简历，实时预览，导出 PDF。',
  description:
    '左边填表、右边实时预览 A4 简历。内置好用的默认示例，改改就能用。导出走浏览器「打印为 PDF」，能直接调用系统中文字体，排版与预览一致。',
  category: 'doc',
  tags: ['简历', '求职', 'PDF'],
  plan: 'free',
  status: 'live',
  priority: 82,
  icon: '▤',
  component: () => import('../../tools/resume-builder/ui'),
});

// —— 文本生成 ——
register({
  slug: 'xhs-copy',
  name: '小红书文案生成',
  summary: '标题公式 + 正文骨架一键生成，可接入自己的 AI 模型出真成稿。',
  description:
    '双模式：本地模板引擎零成本产出能直接改着发的初稿（标题公式、正文结构、话题标签）；填入你自己的 OpenAI 兼容 API Key，即可升级为大模型原创成稿。',
  category: 'text',
  tags: ['文案', '小红书', '运营'],
  plan: 'free',
  status: 'live',
  priority: 80,
  icon: '✎',
  component: () => import('../../tools/xhs-copy/ui'),
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

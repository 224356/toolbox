/**
 * 扩展内核 —— 类型定义
 *
 * 设计目标：新增一个功能 = 新增一个模块 + 注册一行，不改动任何已有代码。
 * 这就是「后期更多功能扩展」的实现方式。
 */

import type { ComponentType } from 'react';

export type PlanId = 'free' | 'pro';

export type ToolStatus = 'live' | 'beta' | 'coming-soon';

export type ToolCategory =
  | 'text'      // 文本处理
  | 'convert'   // 格式转换
  | 'doc'       // 文档处理（PDF / 简历 / 表格）
  | 'dev'       // 开发者
  | 'image'     // 图片
  | 'ai'        // AI 能力（多为 pro）
  | 'data';     // 数据

export interface ToolLimits {
  /** 免费用户每日可用次数，undefined = 不限 */
  dailyUse?: number;
  /** 单次输入最大字符数 */
  maxInputLength?: number;
  /** 是否允许批量处理 */
  batch?: boolean;
  /** 是否允许导出结果 */
  export?: boolean;
  /** 是否开放 API 访问 */
  api?: boolean;
}

/**
 * 一个「工具」的完整描述。它是注册表的基本单元。
 */
export interface ToolDefinition {
  /** 唯一 slug，同时决定路由 /tools/<slug> */
  slug: string;
  name: string;
  /** 一句话说明，用于列表页卡片 */
  summary: string;
  /** 详细描述，用于详情页 */
  description?: string;
  category: ToolCategory;
  tags: string[];
  /** 归属套餐：决定是否需要付费 */
  plan: PlanId;
  status: ToolStatus;
  /** 排序权重，越大越靠前 */
  priority?: number;
  /** 图标：emoji 或图标名 */
  icon?: string;
  /** 各套餐下的使用上限，未声明的用 plan 默认值 */
  limits?: ToolLimits;
  /**
   * 懒加载组件。必须是动态 import，保证首屏只加载注册表元数据。
   * 示例： component: () => import('./ui')
   */
  component: () => Promise<{ default: ComponentType<ToolProps> }>;
  /** 可选的服务端处理函数（纯前端工具可省略） */
  handler?: (input: ToolInput) => Promise<ToolOutput> | ToolOutput;
}

export interface ToolProps {
  tool: ToolDefinition;
  /** 当前用户的可用能力（已按套餐裁剪） */
  capabilities: ToolCapabilities;
}

export interface ToolInput {
  payload: unknown;
  options?: Record<string, unknown>;
}

export interface ToolOutput {
  result: unknown;
  /** 耗时（ms），用于统计 */
  elapsedMs?: number;
  /** 用量消耗，用于扣减配额 */
  consume?: number;
}

/** 按套餐裁剪后的实际能力，UI 只认这个，不认 plan */
export interface ToolCapabilities {
  plan: PlanId;
  dailyUse: number;
  maxInputLength: number;
  batch: boolean;
  export: boolean;
  api: boolean;
}

/** 功能开关：用于灰度发布 / 快速回滚 */
export type FeatureFlags = {
  /** 账号体系 */
  auth: boolean;
  /** 支付与订阅 */
  payment: boolean;
  /** 用量埋点 */
  analytics: boolean;
  /** 广告位 */
  ads: boolean;
  /** 内测功能入口 */
  betaFeatures: boolean;
};

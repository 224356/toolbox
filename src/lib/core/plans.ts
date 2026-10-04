import type { PlanId, ToolCapabilities, ToolDefinition, ToolLimits } from './types';

/**
 * 套餐配置 —— 收费逻辑的唯一事实来源。
 *
 * 今天只开 free；将来接支付时只需要：
 *   1. flags.payment = true
 *   2. 实现 getUserPlan() 从订阅表读取
 * 不需要动任何工具代码。
 */

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline: string;
  price?: { monthly: number; yearly: number; currency: 'CNY' | 'USD' };
  /** 默认限额，工具可在自己的 limits 里覆盖 */
  defaults: Required<Pick<ToolLimits, 'dailyUse' | 'maxInputLength' | 'batch' | 'export' | 'api'>>;
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: '免费版',
    tagline: '核心功能永久免费，无需注册',
    defaults: {
      dailyUse: 20,
      maxInputLength: 20000,
      batch: false,
      export: false,
      api: false,
    },
    features: [
      '全部免费工具无限次核心处理',
      '每日 20 次使用额度',
      '单次 2 万字符',
      '无需注册即可使用',
    ],
  },
  pro: {
    id: 'pro',
    name: '专业版',
    tagline: '解锁批量、导出与 API，适合重度使用',
    price: { monthly: 29, yearly: 290, currency: 'CNY' },
    defaults: {
      dailyUse: Infinity,
      maxInputLength: 500000,
      batch: true,
      export: true,
      api: true,
    },
    features: [
      '包含免费版全部功能',
      '无限使用额度',
      '批量处理与结果导出',
      '开放 API 接入',
      '单次 50 万字符',
      '优先客服支持',
    ],
  },
};

/**
 * 计算某个工具对某个套餐的实际能力。
 * 工具自带 limits 会覆盖套餐默认值（用于给单个工具定制上限）。
 */
export function resolveCapabilities(
  tool: Pick<ToolDefinition, 'plan' | 'limits'>,
  plan: PlanId = 'free',
): ToolCapabilities {
  const cfg = PLANS[plan];
  const l = tool.limits ?? {};
  return {
    plan,
    dailyUse: l.dailyUse ?? cfg.defaults.dailyUse,
    maxInputLength: l.maxInputLength ?? cfg.defaults.maxInputLength,
    batch: l.batch ?? cfg.defaults.batch,
    export: l.export ?? cfg.defaults.export,
    api: l.api ?? cfg.defaults.api,
  };
}

/** 该工具是否对当前套餐开放 */
export function isToolUnlocked(tool: Pick<ToolDefinition, 'plan'>, plan: PlanId): boolean {
  return tool.plan === 'free' || plan === 'pro';
}

/** 未来接支付时，只需要替换这个函数的实现 */
export async function getUserPlan(_userId?: string): Promise<PlanId> {
  // TODO(flags.payment 打开后)：从订阅表 / 支付平台回调读取
  return 'free';
}

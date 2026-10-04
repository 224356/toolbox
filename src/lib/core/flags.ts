import type { FeatureFlags } from './types';

/**
 * 功能开关 —— 灰度发布 / 快速回滚的开关面板。
 *
 * 用法：if (flags.payment) { showPaywall() }
 * 未来可改为从环境变量 / 配置中心读取，实现不发版改开关。
 */
export const flags: FeatureFlags = {
  auth: false,       // 账号体系：免费版阶段不开
  payment: false,    // 支付：先验证有人用，再开
  analytics: true,   // 埋点：必须开，否则不知道有没有人用
  ads: false,        // 广告：暂不接
  betaFeatures: true // 内测功能入口：开着，方便自己看
};

export function isFeatureEnabled<K extends keyof FeatureFlags>(key: K): boolean {
  return flags[key];
}

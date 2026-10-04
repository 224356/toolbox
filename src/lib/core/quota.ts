/**
 * 用量配额 —— 免费版「每日 N 次」的实现。
 *
 * 现阶段用 localStorage 落地（无需账号、零成本）。
 * 将来 flags.auth / flags.payment 打开后，
 * 只需把 StorageQuota 换成 ServerQuota，接口不变。
 */

import type { ToolCapabilities } from './types';

export interface QuotaState {
  used: number;
  limit: number;
  resetAt: number; // 时间戳
}

export interface QuotaAdapter {
  get(toolSlug: string, cap: ToolCapabilities): QuotaState;
  consume(toolSlug: string, cap: ToolCapabilities, amount?: number): QuotaState;
  canUse(toolSlug: string, cap: ToolCapabilities, amount?: number): boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function nextMidnight(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function read(key: string): QuotaState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as QuotaState) : null;
  } catch {
    return null;
  }
}

function write(key: string, state: QuotaState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* 隐私模式等场景静默降级 */
  }
}

export class StorageQuota implements QuotaAdapter {
  private key(slug: string) {
    return `quota:${slug}`;
  }

  get(toolSlug: string, cap: ToolCapabilities): QuotaState {
    const key = this.key(toolSlug);
    const now = Date.now();
    const state = read(key);

    // 跨天自动重置
    if (!state || state.resetAt <= now) {
      const fresh: QuotaState = { used: 0, limit: cap.dailyUse, resetAt: nextMidnight() };
      write(key, fresh);
      return fresh;
    }
    return { ...state, limit: cap.dailyUse };
  }

  consume(toolSlug: string, cap: ToolCapabilities, amount = 1): QuotaState {
    const state = this.get(toolSlug, cap);
    const next: QuotaState = {
      used: state.used + amount,
      limit: cap.dailyUse,
      resetAt: state.resetAt,
    };
    write(this.key(toolSlug), next);
    return next;
  }

  canUse(toolSlug: string, cap: ToolCapabilities, amount = 1): boolean {
    if (cap.dailyUse === Infinity) return true;
    const state = this.get(toolSlug, cap);
    return state.used + amount <= state.limit;
  }
}

/** 默认单例；测试或接服务端时可注入其它实现 */
export const quota: QuotaAdapter = new StorageQuota();

/** 剩余次数（Infinity 表示不限） */
export function remaining(slug: string, cap: ToolCapabilities): number {
  if (cap.dailyUse === Infinity) return Infinity;
  return Math.max(0, cap.dailyUse - quota.get(slug, cap).used);
}

export { DAY_MS };

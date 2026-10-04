'use client';

/**
 * 工作台外壳 —— 客户端容器。
 *
 * 只接收 slug（可序列化），组件与元数据都在客户端从注册表取。
 * 这样避免了 RSC 无法序列化函数引用的问题。
 */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { getTool } from '@/lib/core/registry';
import { resolveCapabilities, isToolUnlocked, PLANS } from '@/lib/core/plans';
import { quota, remaining } from '@/lib/core/quota';
import type { ToolProps } from '@/lib/core/types';

const CATEGORY_LABEL: Record<string, string> = {
  text: '文本处理',
  convert: '格式转换',
  dev: '开发者',
  image: '图片',
  ai: '人工智能',
  data: '数据',
};

export default function Workbench({ slug }: { slug: string }) {
  const tool = getTool(slug);
  const capabilities = useMemo(
    () => (tool ? resolveCapabilities(tool, 'free') : null),
    [tool],
  );

  const [left, setLeft] = useState<number | null>(null);
  const [Tool, setTool] = useState<ComponentType<ToolProps> | null>(null);

  // 懒加载插件组件
  useEffect(() => {
    if (!tool) return;
    let alive = true;
    tool.component().then((mod) => {
      if (alive) setTool(() => mod.default);
    });
    return () => {
      alive = false;
    };
  }, [tool]);

  // 剩余额度（客户端挂载后才可读 localStorage）
  useEffect(() => {
    if (!tool || !capabilities) return;
    setLeft(remaining(tool.slug, capabilities));
    const onStorage = () => setLeft(remaining(tool.slug, capabilities));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [tool, capabilities]);

  if (!tool || !capabilities) {
    return (
      <div className="shell" style={{ paddingBlock: '6rem' }}>
        <div className="empty">
          <div className="empty__mark">？</div>
          <div className="empty__title">没找到这个工具</div>
          <p className="empty__hint">可能是链接写错了，或者这个工具还没做出来。</p>
          <p style={{ marginTop: '1.5rem' }}>
            <Link href="/" className="btn btn--ghost">
              回首页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const unlocked = isToolUnlocked(tool, 'free');
  const pct =
    capabilities.dailyUse === Infinity
      ? 0
      : Math.min(100, ((capabilities.dailyUse - (left ?? 0)) / capabilities.dailyUse) * 100);
  const lowQuota = left !== null && capabilities.dailyUse !== Infinity && left <= 3;

  return (
    <div className="shell">
      {/* 面包屑 + 标题 */}
      <div style={{ paddingTop: 'var(--s-4)' }}>
        <div className="meta" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href="/#tools" style={{ color: 'var(--ink-3)' }}>
            工具台
          </Link>
          <span aria-hidden>/</span>
          <span className="meta--zhu">{CATEGORY_LABEL[tool.category] ?? tool.category}</span>
        </div>

        <h1
          style={{ fontSize: 'var(--t-title)', marginTop: '0.85rem', display: 'flex', gap: '0.9rem', alignItems: 'baseline' }}
        >
          <span
            aria-hidden
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.42em', color: 'var(--zhu)' }}
          >
            {tool.icon}
          </span>
          {tool.name}
        </h1>

        <p
          style={{
            marginTop: '1rem',
            color: 'var(--ink-2)',
            maxWidth: '52ch',
            fontSize: 'clamp(1rem, 0.95rem + 0.3vw, 1.18rem)',
            lineHeight: 1.85,
          }}
        >
          {tool.description ?? tool.summary}
        </p>
      </div>

      <hr className="rule rule--strong" style={{ marginTop: 'var(--s-4)' }} />

      {/* 主体：工具区 + 侧栏 */}
      <div className="workbench">
        <div>
          {!unlocked ? (
            <Paywall plan={PLANS.pro} />
          ) : Tool ? (
            <Suspense fallback={<ToolLoading />}>
              <Tool tool={tool} capabilities={capabilities} />
            </Suspense>
          ) : (
            <ToolLoading />
          )}
        </div>

        <aside>
          <div className="aside-block">
            <dt>分类</dt>
            <dd>{CATEGORY_LABEL[tool.category] ?? tool.category}</dd>
          </div>
          <div className="aside-block">
            <dt>单次上限</dt>
            <dd>
              {capabilities.maxInputLength.toLocaleString()} 字符
            </dd>
          </div>
          <div className="aside-block">
            <dt>批量处理</dt>
            <dd>{capabilities.batch ? '支持' : '不支持'}</dd>
          </div>
          <div className="aside-block">
            <dt>导出结果</dt>
            <dd>{capabilities.export ? '支持' : '不支持'}</dd>
          </div>

          <div style={{ paddingTop: 'var(--s-3)' }}>
            <div className={`quota ${lowQuota ? 'quota--warn' : ''}`}>
              <span>今日剩余</span>
              <span className="quota__track">
                <span className="quota__fill" style={{ width: `${pct}%` }} />
              </span>
              <span>{capabilities.dailyUse === Infinity ? '不限' : `${left ?? '—'} 次`}</span>
            </div>
            <p className="meta" style={{ marginTop: '0.85rem', lineHeight: 1.95, letterSpacing: '0.11em' }}>
              所有运算都在你的浏览器里完成，<br />内容不会离开这台设备。
            </p>
          </div>

          <div style={{ marginTop: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <Link href="/#tools" className="btn btn--ghost" style={{ justifyContent: 'center' }}>
              其它工具
            </Link>
            <button
              className="btn btn--ghost"
              style={{ justifyContent: 'center' }}
              onClick={() => {
                if (tool) {
                  quota.consume(tool.slug, capabilities, 0);
                  setLeft(remaining(tool.slug, capabilities));
                }
              }}
            >
              重置今日额度
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ToolLoading() {
  return (
    <div className="panel">
      <div className="panel__body">
        <div className="empty">
          <div className="empty__mark">…</div>
          <div className="empty__title">正在装配工具</div>
          <p className="empty__hint">马上就好。</p>
        </div>
      </div>
    </div>
  );
}

function Paywall({ plan }: { plan: typeof PLANS.pro }) {
  return (
    <div className="panel">
      <div className="panel__body">
        <div className="empty">
          <div className="empty__mark">◆</div>
          <div className="empty__title">这个工具属于{plan.name}</div>
          <p className="empty__hint">{plan.tagline}</p>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '1.75rem auto 0',
              maxWidth: '30ch',
              textAlign: 'left',
            }}
          >
            {plan.features.slice(0, 4).map((f) => (
              <li
                key={f}
                style={{
                  padding: '0.55rem 0',
                  borderBottom: 'var(--rule)',
                  fontSize: 'var(--t-small)',
                  display: 'flex',
                  gap: '0.75rem',
                }}
              >
                <span style={{ color: 'var(--zhu)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>✓</span>
                {f}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '1.75rem' }}>
            <Link href="/#pricing" className="btn btn--zhu">
              了解{plan.name}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

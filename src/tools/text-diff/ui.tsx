'use client';

/**
 * 插件：文本对比
 * 逐行 LCS 对比，高亮新增 / 删除 / 改动。纯前端实现。
 */

import { useMemo, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

type Kind = 'ctx' | 'add' | 'del' | 'mod';

interface Row {
  kind: Kind;
  no: number;
  text: string;
}

/**
 * 最长公共子序列（LCS）—— 文本量不大时足够快。
 * 大文本场景可换成 diff-match-patch 等库，接口不变。
 */
function diffLines(a: string[], b: string[]): Row[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: Row[] = [];
  let i = 0;
  let j = 0;
  let no = 1;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: 'ctx', no: no++, text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: 'del', no: no++, text: a[i] });
      i++;
    } else {
      rows.push({ kind: 'add', no: no++, text: b[j] });
      j++;
    }
  }
  while (i < n) rows.push({ kind: 'del', no: no++, text: a[i++] });
  while (j < m) rows.push({ kind: 'add', no: no++, text: b[j++] });

  // 相邻的 del+add 视为「改动」，更好读
  return rows.map((r, idx, arr) => {
    if (r.kind === 'del' && arr[idx + 1]?.kind === 'add') return { ...r, kind: 'mod' as Kind };
    if (r.kind === 'add' && arr[idx - 1]?.kind === 'del') return { ...r, kind: 'mod' as Kind };
    return r;
  });
}

const SIGN: Record<Kind, string> = { ctx: ' ', add: '+', del: '−', mod: '~' };
const LABEL: Record<Kind, string> = {
  ctx: '未改动',
  add: '新增',
  del: '删除',
  mod: '改动',
};

export default function TextDiff({ tool, capabilities }: ToolProps) {
  const [left, setLeft] = useState<number | null>(null);
  const [original, setOriginal] = useState('');
  const [revised, setRevised] = useState('');
  const [showCtx, setShowCtx] = useState(true);

  const rows = useMemo(() => {
    const a = original.split('\n');
    const b = revised.split('\n');
    return diffLines(a, b);
  }, [original, revised]);

  const counts = useMemo(() => {
    const c = { add: 0, del: 0, mod: 0, ctx: 0 };
    for (const r of rows) c[r.kind]++;
    return c;
  }, [rows]);

  const has = original.trim().length > 0 || revised.trim().length > 0;
  const visible = showCtx ? rows : rows.filter((r) => r.kind !== 'ctx');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))', gap: 'var(--s-3)' }}>
        <div className="panel">
          <div className="panel__head">
            <span className="meta">原文</span>
            <span className="meta meta--zhu">{original.split('\n').length} 行</span>
          </div>
          <div className="panel__body">
            <textarea
              value={original}
              rows={8}
              placeholder="粘贴修改前的版本"
              onChange={(e) => setOriginal(e.target.value)}
              style={{ border: 0, padding: 0, background: 'transparent' }}
            />
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <span className="meta">新文</span>
            <span className="meta meta--zhu">{revised.split('\n').length} 行</span>
          </div>
          <div className="panel__body">
            <textarea
              value={revised}
              rows={8}
              placeholder="粘贴修改后的版本"
              onChange={(e) => setRevised(e.target.value)}
              style={{ border: 0, padding: 0, background: 'transparent' }}
            />
          </div>
        </div>
      </div>

      {!has ? (
        <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
          <div className="empty">
            <div className="empty__mark">≠</div>
            <div className="empty__title">把两个版本都贴进来</div>
            <p className="empty__hint">
              逐行对比，新增、删除、改动一目了然。
              <br />
              改稿、校对、核对配置文件差异都好用。
            </p>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <div className="stats" style={{ marginBottom: 'var(--s-3)' }}>
            <MiniStat n={counts.add} label="新增" tone="var(--add)" />
            <MiniStat n={counts.del} label="删除" tone="var(--del)" />
            <MiniStat n={counts.mod} label="改动" tone="var(--mod)" />
            <MiniStat n={counts.ctx} label="未改动" tone="var(--ink-3)" />
          </div>

          <div className="panel">
            <div className="panel__head">
              <span className="meta">对比结果 · {visible.length} 行</span>
              <button
                className="btn btn--ghost"
                style={{ padding: '0.35rem 0.85rem', fontSize: 'var(--t-meta)', letterSpacing: '0.14em' }}
                onClick={() => setShowCtx((v) => !v)}
              >
                {showCtx ? '只看改动' : '显示全部'}
              </button>
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {visible.length === 0 ? (
                <div className="empty">
                  <div className="empty__mark">✓</div>
                  <div className="empty__title">完全一致</div>
                  <p className="empty__hint">两个版本没有任何差异。</p>
                </div>
              ) : (
                <div className="diff">
                  {visible.map((r, i) => (
                    <div key={i} className={`diff__line diff__line--${r.kind}`}>
                      <span className="diff__no">{r.no}</span>
                      <span className="diff__sign">{SIGN[r.kind]}</span>
                      <span>{r.text || ' '}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn--zhu"
              disabled={left === 0}
              onClick={() => {
                quota.consume(tool.slug, capabilities);
                setLeft(remaining(tool.slug, capabilities));
              }}
            >
              记录这次对比
            </button>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setOriginal(revised);
                setRevised('');
              }}
            >
              以新文为原文
            </button>
            <span className="quota" style={{ marginLeft: 'auto' }}>
              今日剩余 <strong style={{ color: 'var(--ink)', letterSpacing: 0 }}>{left ?? '—'}</strong> 次
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="stat">
      <div className="stat__val" style={{ color: tone }}>
        {n}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

export { LABEL };

'use client';

/**
 * 插件：大小写与命名转换
 * 驼峰 / 下划线 / 短横线 / 常量命名互转。纯前端实现。
 */

import { useMemo, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

/** 把任意命名切成词数组 */
function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-./:]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const FORMATS: Array<{
  key: string;
  label: string;
  hint: string;
  render: (w: string[]) => string;
}> = [
  {
    key: 'camel',
    label: 'camelCase',
    hint: '小驼峰 · JS 变量',
    render: (w) => w.map((x, i) => (i === 0 ? x : x[0].toUpperCase() + x.slice(1))).join(''),
  },
  {
    key: 'pascal',
    label: 'PascalCase',
    hint: '大驼峰 · 类名',
    render: (w) => w.map((x) => x[0].toUpperCase() + x.slice(1)).join(''),
  },
  {
    key: 'snake',
    label: 'snake_case',
    hint: '下划线 · Python / 数据库',
    render: (w) => w.join('_'),
  },
  {
    key: 'kebab',
    label: 'kebab-case',
    hint: '短横线 · URL / CSS 类名',
    render: (w) => w.join('-'),
  },
  {
    key: 'const',
    label: 'CONSTANT_CASE',
    hint: '全大写常量',
    render: (w) => w.map((x) => x.toUpperCase()).join('_'),
  },
  {
    key: 'title',
    label: 'Title Case',
    hint: '标题大小写',
    render: (w) => w.map((x) => x[0].toUpperCase() + x.slice(1)).join(' '),
  },
  {
    key: 'upper',
    label: 'UPPER',
    hint: '全大写',
    render: (w) => w.join(' ').toUpperCase(),
  },
  {
    key: 'lower',
    label: 'lower',
    hint: '全小写',
    render: (w) => w.join(' ').toLowerCase(),
  },
];

export default function CaseConvert({ tool, capabilities }: ToolProps) {
  const [input, setInput] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const w = useMemo(() => words(input), [input]);
  const has = w.length > 0;

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div>
      <div className="panel">
        <div className="panel__head">
          <span className="meta">输入 · 任意命名写法</span>
          <span className="meta meta--zhu">
            {[...input].length.toLocaleString()} / {capabilities.maxInputLength.toLocaleString()}
          </span>
        </div>
        <div className="panel__body">
          <input
            type="text"
            value={input}
            maxLength={capabilities.maxInputLength}
            placeholder="比如：user profile card  或  user_profile_card  或  UserProfileCard"
            onChange={(e) => setInput(e.target.value)}
            style={{ border: 0, padding: 0, background: 'transparent', fontSize: '1.05rem' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && has) {
                quota.consume(tool.slug, capabilities);
                setLeft(remaining(tool.slug, capabilities));
              }
            }}
          />
        </div>
      </div>

      {!has ? (
        <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
          <div className="empty">
            <div className="empty__mark">Aa</div>
            <div className="empty__title">写一个名字试试</div>
            <p className="empty__hint">
              无论你输入哪种写法，下面会一次性给出全部八种规范命名。
              <br />
              命名统一是代码评审里最常见的返工项，先在这一致了再说。
            </p>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <div className="meta" style={{ marginBottom: '0.85rem' }}>
            识别到 {w.length} 个词：
            <span className="meta--zhu" style={{ marginLeft: '0.65rem', letterSpacing: '0.12em' }}>
              {w.join(' · ')}
            </span>
          </div>

          <div>
            {FORMATS.map((f) => {
              const value = f.render(w);
              return (
                <div className="out-row" key={f.key}>
                  <div>
                    <div className="out-row__label">{f.label}</div>
                    <div className="meta" style={{ marginTop: '0.25rem', letterSpacing: '0.1em', textTransform: 'none' }}>
                      {f.hint}
                    </div>
                  </div>
                  <div className="out-row__val">{value}</div>
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '0.35rem 0.85rem', fontSize: 'var(--t-meta)', letterSpacing: '0.14em' }}
                    onClick={() => copy(f.key, value)}
                  >
                    {copied === f.key ? '已复制' : '复制'}
                  </button>
                </div>
              );
            })}
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
              记录一次转换
            </button>
            <button className="btn btn--ghost" onClick={() => setInput('')}>
              清空
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

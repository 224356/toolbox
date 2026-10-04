'use client';

/**
 * 插件：可读性分析
 * 演示一个「纯前端工具」的完整写法——零服务成本，免费版首选。
 */

import { useEffect, useMemo, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

interface Stats {
  chars: number;
  charsNoSpace: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLen: number;
  longestSentence: number;
  difficulty: { label: string; score: number; hint: string };
  topWords: Array<[string, number]>;
}

const STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很',
  '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她', '它',
  '我们', '你们', '他们', '与', '及', '或', '而', '并', '被', '把', '对', '从', '为', '以', '于',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'that', 'this', 'was', 'for', 'on',
]);

function analyze(text: string): Stats {
  const trimmed = text.trim();
  const chars = [...text].length;
  const charsNoSpace = [...text.replace(/\s/g, '')].length;

  // 中英文混排的句子切分
  const sentences = trimmed
    ? trimmed.split(/[。！？!?；;\n]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];

  const sentenceLens = sentences.map((s) => [...s.replace(/\s/g, '')].length);
  const avg = sentenceLens.length ? sentenceLens.reduce((a, b) => a + b, 0) / sentenceLens.length : 0;
  const longest = sentenceLens.length ? Math.max(...sentenceLens) : 0;

  // 难度：以平均句长为主（句长是最稳定的可读性信号）
  const score = Math.max(0, Math.min(100, Math.round(avg * 3.2)));
  const difficulty =
    avg < 18
      ? { label: '轻松', hint: '句子短，读起来不费劲。适合大众传播与移动端阅读。' }
      : avg < 32
        ? { label: '适中', hint: '节奏正常，信息密度合适。适合博客、说明文档。' }
        : avg < 55
          ? { label: '偏硬', hint: '长句偏多，读者需要集中注意力。建议拆分一些句子。' }
          : { label: '艰深', hint: '句子很长，容易读丢主语。强烈建议多断句。' };

  // 词频（中英混排：中文按 2-gram，英文按单词）
  const freq = new Map<string, number>();
  const zh = text.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  const en = (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) as string[];
  for (const w of [...zh.map((s) => s.slice(0, 2)), ...en]) {
    if (STOPWORDS.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const topWords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return {
    chars,
    charsNoSpace,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    avgSentenceLen: Math.round(avg * 10) / 10,
    longestSentence: longest,
    difficulty: { label: difficulty.label, score, hint: difficulty.hint },
    topWords,
  };
}

export default function Readability({ tool, capabilities }: ToolProps) {
  const [text, setText] = useState('');
  const [left, setLeft] = useState<number | null>(null);

  const stats = useMemo(() => analyze(text), [text]);

  useEffect(() => {
    setLeft(remaining(tool.slug, capabilities));
  }, [tool.slug, capabilities]);

  const has = text.trim().length > 0;

  return (
    <div>
      {/* 输入 */}
      <div className="panel">
        <div className="panel__head">
          <span className="meta">输入 · 粘贴任意中文或英文文本</span>
          <span className="meta meta--zhu">
            {[...text].length.toLocaleString()} / {capabilities.maxInputLength.toLocaleString()}
          </span>
        </div>
        <div className="panel__body">
          <textarea
            value={text}
            rows={9}
            maxLength={capabilities.maxInputLength}
            placeholder="把文章粘进来。这里的所有分析都在你的浏览器里跑，内容不会被上传。"
            onChange={(e) => setText(e.target.value)}
            style={{ border: 0, padding: 0, background: 'transparent' }}
          />
        </div>
      </div>

      {/* 结果 */}
      {!has ? (
        <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
          <div className="empty">
            <div className="empty__mark">¶</div>
            <div className="empty__title">还没开始分析</div>
            <p className="empty__hint">
              粘贴一段文字，立刻看到字数、句长分布和阅读难度。
              <br />
              适合发稿前自查：太长的句子是读者读不下去的头号原因。
            </p>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <div className="stats">
            <Stat label="总字数" value={stats.chars} />
            <Stat label="不含空格" value={stats.charsNoSpace} />
            <Stat label="句子数" value={stats.sentences} />
            <Stat label="段落数" value={stats.paragraphs} />
            <Stat label="平均句长" value={stats.avgSentenceLen} unit="字" />
            <Stat label="最长句" value={stats.longestSentence} unit="字" />
          </div>

          {/* 难度 */}
          <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
            <div className="panel__head">
              <span className="meta">阅读难度</span>
              <span className="meta meta--zhu">{stats.difficulty.label}</span>
            </div>
            <div className="panel__body">
              <div className="bar" role="meter" aria-valuenow={stats.difficulty.score} aria-valuemin={0} aria-valuemax={100}>
                <div className="bar__fill" style={{ width: `${stats.difficulty.score}%` }} />
              </div>
              <p
                style={{
                  marginTop: '1.15rem',
                  color: 'var(--ink-2)',
                  fontSize: 'var(--t-small)',
                  lineHeight: 1.9,
                  maxWidth: '52ch',
                }}
              >
                {stats.difficulty.hint}
              </p>
            </div>
          </div>

          {/* 词频 */}
          {stats.topWords.length > 0 && (
            <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
              <div className="panel__head">
                <span className="meta">高频词 · 检查是否重复</span>
              </div>
              <div className="panel__body" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {stats.topWords.map(([w, n]) => (
                  <span
                    key={w}
                    className="tag"
                    style={{
                      fontSize: 'var(--t-small)',
                      letterSpacing: 0,
                      padding: '0.32rem 0.72rem',
                      textTransform: 'none',
                    }}
                  >
                    {w}
                    <span style={{ color: 'var(--zhu)', marginLeft: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                      ×{n}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 操作 */}
          <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn--zhu"
              disabled={left === 0}
              onClick={() => {
                quota.consume(tool.slug, capabilities);
                setLeft(remaining(tool.slug, capabilities));
              }}
            >
              保存这次分析
            </button>
            <button className="btn btn--ghost" onClick={() => setText('')}>
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

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="stat">
      <div className="stat__val">
        {value.toLocaleString()}
        {unit && <small>{unit}</small>}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

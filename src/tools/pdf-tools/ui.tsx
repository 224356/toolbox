'use client';

/**
 * 插件：PDF 处理
 * 基于 pdf-lib 纯前端实现：合并、拆分提取、旋转、删除页面。文件不离开浏览器。
 */

import { useRef, useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

type Mode = 'merge' | 'extract' | 'rotate' | 'remove';

const MODES: Array<{ key: Mode; label: string; hint: string }> = [
  { key: 'merge', label: '合并', hint: '把多个 PDF 按顺序合成一个' },
  { key: 'extract', label: '拆分提取', hint: '按页码范围提取出新的 PDF' },
  { key: 'rotate', label: '旋转页面', hint: '把指定页面整体旋转 90° 的倍数' },
  { key: 'remove', label: '删除页面', hint: '去掉指定页面，输出剩余部分' },
];

interface Doc {
  id: string;
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}

function fmtSize(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** 解析 "1-3,5,7-9" 形式的页码（1 基），返回 0 基索引 */
function parseRange(input: string, max: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(/[,，]/)) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*[-–~]\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) out.add(i - 1);
    } else if (/^\d+$/.test(seg)) {
      const n = parseInt(seg, 10);
      if (n >= 1 && n <= max) out.add(n - 1);
    }
  }
  return [...out].sort((x, y) => x - y);
}

export default function PdfTools({ tool, capabilities }: ToolProps) {
  const [mode, setMode] = useState<Mode>('merge');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [range, setRange] = useState('1-');
  const [rotate, setRotate] = useState(90);
  const [busy, setBusy] = useState(false);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState('output.pdf');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | File[]) {
    const next: Doc[] = [];
    for (const f of Array.from(files)) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) continue;
      try {
        const bytes = await f.arrayBuffer();
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        next.push({ id: `${Date.now()}-${next.length}`, name: f.name, bytes, pages: pdf.getPageCount() });
      } catch {
        setErr(`无法读取 ${f.name}（可能已加密或损坏）`);
      }
    }
    setDocs((p) => [...p, ...next]);
    setMsg(null);
    setErr(null);
    setOutUrl(null);
  }

  async function run() {
    if (docs.length === 0) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    setOutUrl(null);
    try {
      const out = await PDFDocument.create();

      if (mode === 'merge') {
        for (const d of docs) {
          const src = await PDFDocument.load(d.bytes, { ignoreEncryption: true });
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        }
        setOutName('merged.pdf');
      } else {
        const d = docs[0];
        const src = await PDFDocument.load(d.bytes, { ignoreEncryption: true });
        const total = src.getPageCount();

        if (mode === 'extract') {
          const idx = parseRange(range, total);
          if (idx.length === 0) throw new Error(`页码无效，请输入 1 到 ${total} 之间的范围`);
          const pages = await out.copyPages(src, idx);
          pages.forEach((p) => out.addPage(p));
          setOutName(`${d.name.replace(/\.pdf$/i, '')}-提取.pdf`);
        } else if (mode === 'rotate') {
          const idx = range.trim() === '' || range.trim() === '1-'
            ? src.getPageIndices()
            : parseRange(range, total);
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p, i) => {
            if (idx.includes(i)) p.setRotation(degrees((p.getRotation().angle + rotate) % 360));
            out.addPage(p);
          });
          setOutName(`${d.name.replace(/\.pdf$/i, '')}-旋转.pdf`);
        } else {
          const idx = new Set(parseRange(range, total));
          const keep = src.getPageIndices().filter((i) => !idx.has(i));
          if (keep.length === 0) throw new Error('不能删除全部页面');
          const pages = await out.copyPages(src, keep);
          pages.forEach((p) => out.addPage(p));
          setOutName(`${d.name.replace(/\.pdf$/i, '')}-删页.pdf`);
        }
      }

      const bytes = await out.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      setOutUrl(URL.createObjectURL(blob));
      setMsg(`完成，共 ${out.getPageCount()} 页，${fmtSize(blob.size)}`);
      quota.consume(tool.slug, capabilities);
      setLeft(remaining(tool.slug, capabilities));
    } catch (e) {
      setErr(e instanceof Error ? e.message : '处理失败');
    }
    setBusy(false);
  }

  const first = docs[0];

  return (
    <div>
      {/* 模式选择 */}
      <div className="panel">
        <div className="panel__head">
          <span className="meta">选择操作</span>
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => { setMode(m.key); setOutUrl(null); setMsg(null); setErr(null); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer',
                background: mode === m.key ? 'var(--zhu-soft)' : 'transparent',
                padding: '0.95rem var(--s-3)', borderBottom: 'var(--rule)',
                fontFamily: 'var(--font-body)', color: 'var(--ink)',
                borderLeft: mode === m.key ? '3px solid var(--zhu)' : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.85rem' }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.02rem',
                  color: mode === m.key ? 'var(--zhu-deep)' : 'var(--ink)',
                }}>{m.label}</span>
                <span style={{ fontSize: 'var(--t-small)', color: 'var(--ink-2)' }}>{m.hint}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 文件 */}
      <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
        <div className="panel__head">
          <span className="meta">
            {mode === 'merge' ? '添加多个 PDF（按顺序合并）' : '选择一个 PDF'}
          </span>
          <span className="meta meta--zhu">{docs.length} 个文件</span>
        </div>
        <div className="panel__body">
          <input
            ref={inputRef} type="file" accept="application/pdf,.pdf"
            multiple={mode === 'merge'} hidden
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <button className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
            ＋ 选择 PDF
          </button>

          {docs.length > 0 && (
            <div style={{ marginTop: 'var(--s-3)' }}>
              {docs.map((d, i) => (
                <div
                  key={d.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '2.25rem 1fr auto auto',
                    gap: '0.85rem', alignItems: 'center',
                    padding: '0.72rem 0', borderTop: 'var(--rule)',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--zhu)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 'var(--t-small)', wordBreak: 'break-all' }}>{d.name}</span>
                  <span className="meta">{d.pages} 页</span>
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '0.28rem 0.72rem', fontSize: 'var(--t-meta)' }}
                    onClick={() => setDocs((p) => p.filter((x) => x.id !== d.id))}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 参数 */}
      {docs.length > 0 && mode !== 'merge' && (
        <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
          <div className="panel__head">
            <span className="meta">
              {mode === 'extract' ? '要提取的页码' : mode === 'rotate' ? '要旋转的页码' : '要删除的页码'}
            </span>
            <span className="meta meta--zhu">
              共 {first?.pages ?? 0} 页 · 支持 1-3,5,7-9 写法
            </span>
          </div>
          <div className="panel__body">
            <input
              type="text" value={range} onChange={(e) => setRange(e.target.value)}
              placeholder="例如：1-3,5,7-9"
            />
            {mode === 'rotate' && (
              <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <span className="meta">旋转角度</span>
                {[90, 180, 270].map((a) => (
                  <button
                    key={a}
                    className={`btn ${rotate === a ? 'btn--zhu' : 'btn--ghost'}`}
                    style={{ padding: '0.42rem 0.95rem', fontSize: 'var(--t-meta)' }}
                    onClick={() => setRotate(a)}
                  >
                    {a}°
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 执行 */}
      <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn--zhu" onClick={run} disabled={busy || docs.length === 0}>
          {busy ? '处理中…' : '开始处理'}
        </button>
        <button className="btn btn--ghost" onClick={() => { setDocs([]); setOutUrl(null); setMsg(null); setErr(null); }}>
          清空
        </button>
        <span className="quota" style={{ marginLeft: 'auto' }}>
          今日剩余 <strong style={{ color: 'var(--ink)', letterSpacing: 0 }}>{left ?? '—'}</strong> 次
        </span>
      </div>

      {err && (
        <div className="panel" style={{ marginTop: 'var(--s-3)', borderColor: 'oklch(0.55 0.175 28 / 0.4)' }}>
          <div className="empty" style={{ padding: 'var(--s-3)' }}>
            <div className="empty__title" style={{ color: 'var(--del)' }}>出错了</div>
            <p className="empty__hint">{err}</p>
          </div>
        </div>
      )}

      {outUrl && (
        <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
          <div className="panel__head">
            <span className="meta">处理完成</span>
            <span className="meta meta--zhu">{msg}</span>
          </div>
          <div className="panel__body" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a className="btn btn--zhu" href={outUrl} download={outName}>
              下载 {outName}
            </a>
            <span className="meta" style={{ alignSelf: 'center' }}>文件只存在于你的浏览器内存中</span>
          </div>
        </div>
      )}

      {docs.length === 0 && (
        <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
          <div className="empty">
            <div className="empty__mark">¶</div>
            <div className="empty__title">先放一个 PDF 进来</div>
            <p className="empty__hint">
              合并、拆分、旋转、删页——常用的一次性处理都在这，不用装 Acrobat。
              <br />
              全程浏览器本地运算，文件不会上传。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

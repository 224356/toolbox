'use client';

/**
 * 插件：AI 智能去背景
 * 使用 @imgly/background-removal 在浏览器内运行 ONNX 语义分割模型。
 * 图片全程留在本地，不上传；模型文件首次使用时由 CDN 下载到浏览器。
 */

import { useCallback, useRef, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

type Stage = 'idle' | 'loading-lib' | 'loading-model' | 'working' | 'done' | 'error';

const STAGE_TEXT: Record<Stage, string> = {
  idle: '等待开始',
  'loading-lib': '正在加载推理引擎…',
  'loading-model': '首次使用需下载模型（约 25-40 MB），请稍候…',
  working: '正在推理分割…',
  done: '完成',
  error: '出错了',
};

function fmtSize(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function RemoveBg({ tool, capabilities }: ToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [outSize, setOutSize] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) return;
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    if (outUrl) URL.revokeObjectURL(outUrl);
    setFile(f);
    setSrcUrl(URL.createObjectURL(f));
    setOutUrl(null);
    setErr(null);
    setStage('idle');
    setProgress(0);
  }, [srcUrl, outUrl]);

  async function run() {
    if (!file) return;
    setErr(null);
    setOutUrl(null);
    setProgress(0);

    try {
      setStage('loading-lib');
      // 动态加载：重库不进首屏
      const mod = await import('@imgly/background-removal');
      const removeBackground = mod.removeBackground ?? (mod as unknown as { default: (i: unknown, o?: unknown) => Promise<Blob> }).default;

      setStage('loading-model');
      const blob = await removeBackground(file, {
        progress: (key: string, current: number, total: number) => {
          if (key.startsWith('fetch')) {
            const p = total ? Math.round((current / total) * 100) : 0;
            setProgress(p);
            if (current >= total && total > 0) setStage('working');
          }
        },
        output: { format: 'image/png', quality: 1 },
      });

      setStage('done');
      setOutUrl(URL.createObjectURL(blob));
      setOutSize(blob.size);
      quota.consume(tool.slug, capabilities);
      setLeft(remaining(tool.slug, capabilities));
    } catch (e) {
      setStage('error');
      const m = e instanceof Error ? e.message : String(e);
      setErr(
        /fetch|network|Failed to|ERR_/i.test(m)
          ? '模型下载失败。这通常是网络原因——模型文件托管在境外 CDN，国内网络可能较慢或不通。可以稍后重试。'
          : m,
      );
    }
  }

  function download() {
    if (!outUrl || !file) return;
    const a = document.createElement('a');
    a.href = outUrl;
    a.download = file.name.replace(/\.[^.]+$/, '') + '-去背景.png';
    a.click();
  }

  const working = stage === 'loading-lib' || stage === 'loading-model' || stage === 'working';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--s-3)' }} className="rbg-grid">
        {/* 原图 */}
        <div className="panel">
          <div className="panel__head">
            <span className="meta">原图</span>
            {file && <span className="meta meta--zhu">{fmtSize(file.size)}</span>}
          </div>
          <div
            className="panel__body"
            style={{
              padding: 0, minHeight: '15rem', display: 'grid', placeItems: 'center',
              background: dragging ? 'var(--zhu-soft)' : 'transparent',
              transition: 'background 0.25s var(--ease)',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) pick(f);
            }}
          >
            <input
              ref={inputRef} type="file" accept="image/*" hidden
              onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
            />
            {srcUrl ? (
              <img src={srcUrl} alt="原图"
                style={{ maxWidth: '100%', maxHeight: '22rem', objectFit: 'contain', display: 'block' }} />
            ) : (
              <div className="empty">
                <div className="empty__mark">◧</div>
                <div className="empty__title">把图片拖进来</div>
                <p className="empty__hint">支持 JPG / PNG / WebP。人物、商品、动物效果较好。</p>
                <p style={{ marginTop: '1.25rem' }}>
                  <button className="btn btn--zhu" onClick={() => inputRef.current?.click()}>选择图片</button>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 结果 */}
        <div className="panel">
          <div className="panel__head">
            <span className="meta">去背景结果</span>
            {outUrl && <span className="meta meta--zhu">PNG 透明底 · {fmtSize(outSize)}</span>}
          </div>
          <div className="panel__body" style={{
            padding: 0, minHeight: '15rem', display: 'grid', placeItems: 'center',
            // 棋盘格 = 透明的通用视觉语言
            backgroundImage:
              'linear-gradient(45deg, oklch(0.5 0.03 65 / 0.1) 25%, transparent 25%, transparent 75%, oklch(0.5 0.03 65 / 0.1) 75%), linear-gradient(45deg, oklch(0.5 0.03 65 / 0.1) 25%, transparent 25%, transparent 75%, oklch(0.5 0.03 65 / 0.1) 75%)',
            backgroundSize: '18px 18px',
            backgroundPosition: '0 0, 9px 9px',
          }}>
            {outUrl ? (
              <img src={outUrl} alt="去背景结果"
                style={{ maxWidth: '100%', maxHeight: '22rem', objectFit: 'contain', display: 'block' }} />
            ) : (
              <div className="empty">
                <div className="empty__mark">{stage === 'error' ? '!' : '◻'}</div>
                <div className="empty__title">
                  {stage === 'error' ? '没能完成' : working ? STAGE_TEXT[stage] : '等待处理'}
                </div>
                <p className="empty__hint">
                  {stage === 'error'
                    ? err
                    : working
                      ? '模型只在第一次下载，之后会走浏览器缓存。'
                      : '结果会是透明背景的 PNG，可直接合成到任何设计稿里。'}
                </p>
                {working && (
                  <div style={{ margin: '1.25rem auto 0', maxWidth: '15rem' }}>
                    <div className="bar">
                      <div className="bar__fill" style={{ width: `${Math.max(4, progress)}%` }} />
                    </div>
                    <div className="meta" style={{ marginTop: '0.55rem' }}>{progress}%</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 操作 */}
      <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn--zhu" onClick={run} disabled={!file || working}>
          {working ? '处理中…' : '开始去背景'}
        </button>
        <button className="btn btn--ghost" onClick={download} disabled={!outUrl}>
          下载 PNG
        </button>
        <button className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
          换一张图
        </button>
        <span className="quota" style={{ marginLeft: 'auto' }}>
          今日剩余 <strong style={{ color: 'var(--ink)', letterSpacing: 0 }}>{left ?? '—'}</strong> 次
        </span>
      </div>

      {/* 说明 */}
      <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
        <div className="panel__body" style={{ padding: 'var(--s-2) var(--s-3)' }}>
          <p className="meta" style={{ lineHeight: 2, letterSpacing: '0.11em', margin: 0 }}>
            ⚠️ 首次点击会下载约 25-40 MB 的 AI 模型到你的浏览器（之后走缓存，不再下载）。<br />
            推理全部在本地完成，<strong style={{ color: 'var(--zhu-deep)' }}>图片不会上传到任何服务器</strong>。
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .rbg-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

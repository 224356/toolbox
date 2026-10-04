'use client';

/**
 * 插件：批量图片压缩
 * 纯前端 canvas 实现，零服务成本。支持批量、质量调节、尺寸缩放、格式转换。
 */

import { useCallback, useRef, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

interface Item {
  id: string;
  file: File;
  srcUrl: string;
  status: 'pending' | 'working' | 'done' | 'error';
  outUrl?: string;
  outBlob?: Blob;
  outName: string;
  before: number;
  after?: number;
  width?: number;
  height?: number;
  error?: string;
}

type Format = 'image/jpeg' | 'image/webp' | 'image/png';

const FORMAT_LABEL: Record<Format, string> = {
  'image/jpeg': 'JPG',
  'image/webp': 'WebP',
  'image/png': 'PNG',
};

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** 用 canvas 重绘 + 指定质量导出 */
async function compress(
  file: File,
  opts: { quality: number; maxEdge: number; format: Format },
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const longest = Math.max(width, height);

  if (opts.maxEdge > 0 && longest > opts.maxEdge) {
    const ratio = opts.maxEdge / longest;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');

  // 高质量缩放：分两级降采样，避免大图直接缩放产生锯齿
  if (width < bitmap.width && height < bitmap.height) {
    let sw = bitmap.width;
    let sh = bitmap.height;
    let src: CanvasImageSource = bitmap;
    while (sw > width * 2 && sh > height * 2) {
      sw = Math.max(width, Math.floor(sw / 2));
      sh = Math.max(height, Math.floor(sh / 2));
      const tmp = document.createElement('canvas');
      tmp.width = sw;
      tmp.height = sh;
      const tctx = tmp.getContext('2d');
      if (!tctx) break;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(src, 0, 0, sw, sh);
      src = tmp;
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, width, height);
  } else {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
  }
  bitmap.close();

  // JPG 不支持透明，先铺白底
  if (opts.format === 'image/jpeg') {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('导出失败'))),
      opts.format,
      opts.quality,
    );
  });
  return { blob, width, height };
}

export default function ImageCompress({ tool, capabilities }: ToolProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(0.72);
  const [maxEdge, setMaxEdge] = useState(1920);
  const [format, setFormat] = useState<Format>('image/jpeg');
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: Item[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      next.push({
        id: `img-${++idRef.current}`,
        file,
        srcUrl: URL.createObjectURL(file),
        status: 'pending',
        outName: file.name.replace(/\.[^.]+$/, '') + '-compressed',
        before: file.size,
      });
    }
    setItems((prev) => [...prev, ...next]);
  }, []);

  async function runAll() {
    setRunning(true);
    const updated: Item[] = [];
    for (const it of items) {
      if (it.status === 'done') {
        updated.push(it);
        continue;
      }
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: 'working' } : x)));
      try {
        const { blob, width, height } = await compress(it.file, { quality, maxEdge, format });
        updated.push({
          ...it,
          status: 'done',
          outUrl: URL.createObjectURL(blob),
          outBlob: blob,
          outName: it.outName.replace(/\.[^.]+$/, '') + (format === 'image/png' ? '.png' : format === 'image/webp' ? '.webp' : '.jpg'),
          after: blob.size,
          width,
          height,
        });
      } catch (e) {
        updated.push({ ...it, status: 'error', error: e instanceof Error ? e.message : '处理失败' });
      }
      setItems((prev) => {
        const done = updated[updated.length - 1];
        return prev.map((x) => (x.id === done.id ? done : x));
      });
    }
    setItems(updated);
    setRunning(false);
    quota.consume(tool.slug, capabilities, Math.max(1, updated.length));
    setLeft(remaining(tool.slug, capabilities));
  }

  function download(it: Item) {
    if (!it.outUrl) return;
    const a = document.createElement('a');
    a.href = it.outUrl;
    a.download = it.outName;
    a.click();
  }

  function downloadAll() {
    for (const it of items) if (it.status === 'done') download(it);
  }

  const done = items.filter((i) => i.status === 'done');
  const totalBefore = done.reduce((s, i) => s + i.before, 0);
  const totalAfter = done.reduce((s, i) => s + (i.after ?? 0), 0);
  const savedPct = totalBefore ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;

  return (
    <div>
      {/* 参数 */}
      <div className="panel">
        <div className="panel__head">
          <span className="meta">压缩参数</span>
          <span className="meta meta--zhu">{items.length} 张待处理</span>
        </div>
        <div className="panel__body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: 'var(--s-3)' }}>
            <label>
              <div className="meta" style={{ marginBottom: '0.55rem' }}>质量 · {Math.round(quality * 100)}%</div>
              <input
                type="range" min={10} max={100} value={Math.round(quality * 100)}
                onChange={(e) => setQuality(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: 'var(--zhu)' }}
              />
            </label>
            <label>
              <div className="meta" style={{ marginBottom: '0.55rem' }}>最长边 · {maxEdge}px</div>
              <input
                type="range" min={320} max={4096} step={160} value={maxEdge}
                onChange={(e) => setMaxEdge(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--zhu)' }}
              />
            </label>
            <div>
              <div className="meta" style={{ marginBottom: '0.55rem' }}>输出格式</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(Object.keys(FORMAT_LABEL) as Format[]).map((f) => (
                  <button
                    key={f}
                    className={`btn ${format === f ? 'btn--zhu' : 'btn--ghost'}`}
                    style={{ padding: '0.45rem 0.95rem', fontSize: 'var(--t-meta)' }}
                    onClick={() => setFormat(f)}
                  >
                    {FORMAT_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 拖拽区 */}
      <div
        className="panel"
        style={{ marginTop: '-1px', borderTop: 0 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <div className="panel__body" style={{ padding: 0 }}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          {items.length === 0 ? (
            <div className="empty">
              <div className="empty__mark">▣</div>
              <div className="empty__title">把图片拖进来，或点击选择</div>
              <p className="empty__hint">
                支持 JPG / PNG / WebP，可一次选多张。
                <br />
                全部在你的浏览器里用 canvas 重绘压缩，图片不会上传到任何服务器。
              </p>
              <p style={{ marginTop: '1.5rem' }}>
                <button className="btn btn--zhu" onClick={() => inputRef.current?.click()}>
                  选择图片
                </button>
              </p>
            </div>
          ) : (
            <>
              <div style={{ padding: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="btn btn--zhu" onClick={runAll} disabled={running}>
                  {running ? '压缩中…' : `开始压缩 ${items.length} 张`}
                </button>
                <button className="btn btn--ghost" onClick={() => inputRef.current?.click()}>
                  ＋ 继续添加
                </button>
                <button className="btn btn--ghost" onClick={downloadAll} disabled={done.length === 0}>
                  全部下载
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    items.forEach((i) => URL.revokeObjectURL(i.srcUrl));
                    setItems([]);
                  }}
                >
                  清空
                </button>
              </div>

              <div style={{ padding: '0 var(--s-3) var(--s-3)' }}>
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '4.5rem 1fr auto',
                      gap: '1rem',
                      alignItems: 'center',
                      padding: '0.75rem 0',
                      borderTop: 'var(--rule)',
                    }}
                  >
                    <img
                      src={it.outUrl ?? it.srcUrl}
                      alt=""
                      style={{
                        width: '4.5rem', height: '3.25rem', objectFit: 'cover',
                        borderRadius: '2px', border: 'var(--rule)',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: 'var(--t-small)', fontWeight: 600, wordBreak: 'break-all' }}>
                        {it.outName}
                      </div>
                      <div className="meta" style={{ marginTop: '0.3rem', letterSpacing: '0.11em' }}>
                        {fmtSize(it.before)}
                        {it.after !== undefined && (
                          <>
                            <span style={{ color: 'var(--zhu)', margin: '0 0.5rem' }}>→</span>
                            {fmtSize(it.after)}
                            <span style={{ color: 'var(--zhu)', marginLeft: '0.6rem' }}>
                              省 {Math.round((1 - it.after / it.before) * 100)}%
                            </span>
                          </>
                        )}
                        {it.width && (
                          <span style={{ marginLeft: '0.8rem' }}>{it.width}×{it.height}</span>
                        )}
                        {it.status === 'error' && (
                          <span style={{ color: 'var(--del)', marginLeft: '0.8rem' }}>{it.error}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {it.status === 'done' ? (
                        <button
                          className="btn btn--ghost"
                          style={{ padding: '0.35rem 0.85rem', fontSize: 'var(--t-meta)' }}
                          onClick={() => download(it)}
                        >
                          下载
                        </button>
                      ) : (
                        <span className="meta">{it.status === 'working' ? '处理中…' : it.status === 'error' ? '失败' : '待处理'}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 结果汇总 */}
      {done.length > 0 && (
        <div className="stats" style={{ marginTop: 'var(--s-3)' }}>
          <div className="stat">
            <div className="stat__val">{done.length}<small>张</small></div>
            <div className="stat__label">已压缩</div>
          </div>
          <div className="stat">
            <div className="stat__val">{fmtSize(totalBefore)}</div>
            <div className="stat__label">压缩前</div>
          </div>
          <div className="stat">
            <div className="stat__val">{fmtSize(totalAfter)}</div>
            <div className="stat__label">压缩后</div>
          </div>
          <div className="stat">
            <div className="stat__val" style={{ color: 'var(--zhu)' }}>{savedPct}<small>%</small></div>
            <div className="stat__label">总体积减少</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 'var(--s-3)' }} className="quota">
        <span>今日剩余</span>
        <span className="quota__track"><span className="quota__fill" style={{ width: '100%' }} /></span>
        <span>{left ?? '—'} 次</span>
      </div>
    </div>
  );
}

'use client';

/**
 * 插件：小红书文案生成
 *
 * 双模式设计：
 *  1) 本地模板引擎（默认）—— 零成本、离线可用，产出可用的文案骨架与标题公式
 *  2) AI 模式（可选）—— 用户填入自己的 OpenAI 兼容接口，即升级为真 AI 生成
 *
 * 诚实说明：不填 API key 时是「规则 + 模板」生成，不是大模型创作。
 */

import { useMemo, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

type Kind = 'tutorial' | 'review' | 'pitfall' | 'goods' | 'experience';

const KINDS: Array<{ key: Kind; label: string; desc: string }> = [
  { key: 'tutorial', label: '教程干货', desc: '教人做一件具体的事' },
  { key: 'review', label: '测评对比', desc: '横向比较几个选项' },
  { key: 'pitfall', label: '避坑指南', desc: '讲清楚哪些雷不能踩' },
  { key: 'goods', label: '好物分享', desc: '推荐真正好用的东西' },
  { key: 'experience', label: '经验复盘', desc: '讲自己的经历与心得' },
];

const TONES = ['真诚平实', '干货紧凑', '轻松活泼', '犀利直给', '温柔治愈'] as const;

// ── 标题公式：小红书的点击率几乎全在标题上 ──
const TITLE_PATTERNS: Array<(ctx: Ctx) => string> = [
  (c) => `别再${c.pain}了！${c.topic}的正确打开方式`,
  (c) => `${c.topic}｜我踩过的 ${c.pitCount} 个坑，最后一个最致命`,
  (c) => `花了 ${c.cost} 总结的${c.topic}经验，看完少走一年弯路`,
  (c) => `${c.audience}一定要看的${c.topic}指南（建议收藏）`,
  (c) => `求求你们别乱${c.action}了❗${c.topic}其实很简单`,
  (c) => `${c.topic}全攻略｜从${c.from}到${c.to}，我就做了 ${c.stepCount} 件事`,
  (c) => `后悔没早点知道！${c.topic}真的可以这么省事`,
  (c) => `${c.topic}避坑清单📋 这 ${c.pitCount} 条记住就够了`,
  (c) => `实测 ${c.rounds} 轮后，我终于搞懂了${c.topic}`,
  (c) => `${c.audience}别划走！${c.topic}看这一篇就够`,
];

interface Ctx {
  topic: string;
  audience: string;
  pain: string;
  action: string;
  from: string;
  to: string;
  cost: string;
  pitCount: number;
  stepCount: number;
  rounds: number;
  kind: Kind;
  tone: string;
  points: string[];
}

function buildTitles(c: Ctx, n = 5): string[] {
  const out: string[] = [];
  const used = new Set<number>();
  while (out.length < n && used.size < TITLE_PATTERNS.length) {
    const i = Math.floor(Math.random() * TITLE_PATTERNS.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(TITLE_PATTERNS[i](c));
  }
  return out;
}

function buildBody(c: Ctx): string {
  const pts = c.points.length ? c.points : ['先把基础做扎实，别一上来就追求高级玩法', '多看真实反馈，少听营销话术', '给自己留出试错和复盘的时间'];
  const emoji = c.tone === '轻松活泼' ? ['✨', '💡', '🔥', '🙌', '✅'] : ['✅', '▪️', '💡', '⭐', '📌'];

  const hookMap: Record<Kind, string> = {
    tutorial: `很多${c.audience}问我${c.topic}到底怎么做，其实没那么复杂，我把自己摸索出来的方法整理成了 ${pts.length} 步，跟着做就行。`,
    review: `${c.topic}到底哪个更值得入手？我前前后后${c.rounds}轮实测下来，结论其实挺明确的。`,
    pitfall: `${c.topic}这件事，我踩过的坑比做对的事还多。这篇把我交过的学费都摊开讲，希望你别再重蹈覆辙。`,
    goods: `认真讲，${c.topic}里能让我回购的不多，但今天这个是真的想安利给${c.audience}。`,
    experience: `关于${c.topic}，从${c.from}到${c.to}这段路我走了挺久。回头看，最想分享的是这几点。`,
  };

  const lines: string[] = [];
  lines.push(hookMap[c.kind]);
  lines.push('');
  lines.push(`先说结论：${c.topic}这件事，方向比努力重要。`);
  lines.push('');

  pts.forEach((p, i) => {
    lines.push(`${emoji[i % emoji.length]} ${i + 1}. ${p}`);
    lines.push('');
  });

  lines.push('——');
  lines.push('');
  lines.push(`最后补充一句：${c.topic}没有标准答案，适合${c.audience}的才是最好的。`);
  lines.push(`如果你也在${c.action}，欢迎评论区聊聊，我看到都会回💬`);
  lines.push('');
  lines.push(`觉得有用的话点个收藏⭐，下次找不到就亏了～`);

  return lines.join('\n');
}

function buildTags(c: Ctx): string[] {
  const base = [c.topic, c.audience, `${c.topic}攻略`, `${c.topic}经验`];
  const extra: Record<Kind, string[]> = {
    tutorial: ['干货分享', '教程', '新手入门', '自学'],
    review: ['测评', '真实测评', '对比', '怎么选'],
    pitfall: ['避坑', '踩雷', '避坑指南', '别再踩坑'],
    goods: ['好物分享', '真香', '回购清单', '好用到哭'],
    experience: ['经验分享', '复盘', '成长', '心得'],
  };
  return [...new Set([...base, ...extra[c.kind], '小红书创作'])].filter(Boolean).slice(0, 12);
}

export default function XhsCopy({ tool, capabilities }: ToolProps) {
  const [topic, setTopic] = useState('新手学做咖啡');
  const [audience, setAudience] = useState('上班族');
  const [kind, setKind] = useState<Kind>('tutorial');
  const [tone, setTone] = useState<string>('干货紧凑');
  const [points, setPoints] = useState(
    '先买手冲套装，别急着上意式机\n水温控制在 90-93 度，别用沸水\n豆子买小包装新鲜烘焙的\n每天练习 15 分钟，一周就能稳定',
  );
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<{ titles: string[]; body: string; tags: string[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiUrl, setAiUrl] = useState('https://api.openai.com/v1/chat/completions');
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const ctx: Ctx = useMemo(() => ({
    topic: topic.trim() || '这件事',
    audience: audience.trim() || '大家',
    pain: kind === 'pitfall' ? '踩坑' : kind === 'tutorial' ? '瞎折腾' : '走弯路',
    action: kind === 'goods' ? '买' : '做',
    from: '完全不懂',
    to: '熟练上手',
    cost: '3 个月',
    pitCount: 7,
    stepCount: 4,
    rounds: 3,
    kind,
    tone,
    points: points.split('\n').map((s) => s.trim()).filter(Boolean),
  }), [topic, audience, kind, tone, points]);

  function generate() {
    const titles = buildTitles(ctx);
    setResult({ titles, body: buildBody(ctx), tags: buildTags(ctx) });
    setTitle(titles[0]);
    quota.consume(tool.slug, capabilities);
    setLeft(remaining(tool.slug, capabilities));
    setAiErr(null);
  }

  async function generateWithAi() {
    if (!aiKey.trim()) {
      setAiErr('请先填写 API Key。');
      return;
    }
    setAiBusy(true);
    setAiErr(null);
    try {
      const prompt = [
        `请写一篇小红书风格的文案。要求：`,
        `主题：${ctx.topic}`,
        `目标人群：${ctx.audience}`,
        `内容类型：${KINDS.find((k) => k.key === kind)?.label}`,
        `语气：${tone}`,
        `关键要点：${ctx.points.join('；')}`,
        ``,
        `输出格式（严格遵守）：`,
        `【标题】给出 5 个标题，每行一个，带 emoji 和数字`,
        `【正文】300-500 字，口语化，分段，带 emoji，结尾引导互动`,
        `【标签】10 个话题标签，用空格分隔，带 #`,
      ].join('\n');

      const res = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
        body: JSON.stringify({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
        }),
      });
      if (!res.ok) throw new Error(`接口返回 ${res.status}：${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? '';

      const titles = (text.match(/【标题】([\s\S]*?)(?=【|$)/)?.[1] ?? '')
        .split('\n').map((s) => s.replace(/^\d+[.、)]\s*/, '').trim()).filter(Boolean);
      const body = text.match(/【正文】([\s\S]*?)(?=【|$)/)?.[1]?.trim() ?? text;
      const tags = (text.match(/【标签】([\s\S]*?)$/)?.[1] ?? '')
        .split(/[\s,，]+/).map((s) => s.replace(/^#/, '').trim()).filter(Boolean);

      setResult({
        titles: titles.length ? titles : buildTitles(ctx),
        body: body || buildBody(ctx),
        tags: tags.length ? tags : buildTags(ctx),
      });
      setTitle(titles[0] ?? buildTitles(ctx)[0]);
      quota.consume(tool.slug, capabilities);
      setLeft(remaining(tool.slug, capabilities));
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'AI 生成失败');
    }
    setAiBusy(false);
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1600);
    } catch { /* 剪贴板不可用时静默 */ }
  }

  return (
    <div>
      {/* 输入 */}
      <div className="panel">
        <div className="panel__head">
          <span className="meta">内容设定</span>
          <span className="meta meta--zhu">{kind === 'tutorial' ? '教程干货' : KINDS.find((k) => k.key === kind)?.label}</span>
        </div>
        <div className="panel__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' }}>
            <label>
              <div className="meta" style={{ marginBottom: '0.42rem' }}>主题</div>
              <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                placeholder="例如：新手学做咖啡" />
            </label>
            <label>
              <div className="meta" style={{ marginBottom: '0.42rem' }}>目标人群</div>
              <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)}
                placeholder="例如：上班族 / 学生 / 宝妈" />
            </label>
          </div>

          <div style={{ marginTop: 'var(--s-3)' }}>
            <div className="meta" style={{ marginBottom: '0.55rem' }}>内容类型</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {KINDS.map((k) => (
                <button key={k.key}
                  className={`btn ${kind === k.key ? 'btn--zhu' : 'btn--ghost'}`}
                  style={{ padding: '0.45rem 0.95rem', fontSize: 'var(--t-meta)', letterSpacing: '0.12em' }}
                  onClick={() => setKind(k.key)}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--s-3)' }}>
            <div className="meta" style={{ marginBottom: '0.55rem' }}>语气</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {TONES.map((t) => (
                <button key={t}
                  className={`btn ${tone === t ? 'btn--zhu' : 'btn--ghost'}`}
                  style={{ padding: '0.42rem 0.9rem', fontSize: 'var(--t-meta)', letterSpacing: '0.12em' }}
                  onClick={() => setTone(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--s-3)' }}>
            <div className="meta" style={{ marginBottom: '0.42rem' }}>关键要点 · 每行一条</div>
            <textarea rows={5} value={points} onChange={(e) => setPoints(e.target.value)}
              placeholder="每行写一个要点，生成时会自动组织成正文段落" />
          </div>
        </div>
      </div>

      {/* 生成 */}
      <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn--zhu" onClick={generate}>
          生成文案（本地模板）
        </button>
        <button className="btn btn--ghost" onClick={() => setAiOpen((v) => !v)}>
          {aiOpen ? '收起 AI 设置' : '使用 AI 生成 ⚡'}
        </button>
        <span className="quota" style={{ marginLeft: 'auto' }}>
          今日剩余 <strong style={{ color: 'var(--ink)', letterSpacing: 0 }}>{left ?? '—'}</strong> 次
        </span>
      </div>

      {/* AI 设置 */}
      {aiOpen && (
        <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
          <div className="panel__head">
            <span className="meta">接入你自己的 AI 接口</span>
            <span className="meta meta--zhu">OpenAI 兼容</span>
          </div>
          <div className="panel__body">
            <p className="meta" style={{ lineHeight: 1.95, letterSpacing: '0.11em', marginTop: 0, marginBottom: 'var(--s-3)' }}>
              填入你自己的 API Key，即可用大模型生成真正的原创文案。<br />
              Key 只在你的浏览器里直接发往你指定的接口，<strong style={{ color: 'var(--zhu-deep)' }}>本工具不存储、不转发</strong>。
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' }}>
              <label style={{ gridColumn: '1 / -1' }}>
                <div className="meta" style={{ marginBottom: '0.42rem' }}>接口地址</div>
                <input type="text" value={aiUrl} onChange={(e) => setAiUrl(e.target.value)} />
              </label>
              <label>
                <div className="meta" style={{ marginBottom: '0.42rem' }}>API Key</div>
                <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)}
                  placeholder="sk-..." autoComplete="off" />
              </label>
              <label>
                <div className="meta" style={{ marginBottom: '0.42rem' }}>模型</div>
                <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
              </label>
            </div>
            <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn--zhu" onClick={generateWithAi} disabled={aiBusy}>
                {aiBusy ? '生成中…' : '用 AI 生成'}
              </button>
              {aiErr && <span className="meta" style={{ color: 'var(--del)', letterSpacing: '0.1em' }}>{aiErr}</span>}
            </div>
          </div>
        </div>
      )}

      {/* 结果 */}
      {result ? (
        <div style={{ marginTop: 'var(--s-3)' }}>
          <div className="panel">
            <div className="panel__head">
              <span className="meta">标题 · 选一个最戳的</span>
              <span className="meta meta--zhu">{result.titles.length} 条</span>
            </div>
            <div className="panel__body" style={{ padding: 0 }}>
              {result.titles.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.85rem var(--s-3)', borderTop: i === 0 ? 0 : 'var(--rule)',
                  background: title === t ? 'var(--zhu-soft)' : 'transparent',
                  cursor: 'pointer',
                }} onClick={() => setTitle(t)}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', color: 'var(--zhu)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ flex: 1, fontSize: 'var(--t-small)', fontWeight: 600 }}>{t}</span>
                  <button className="btn btn--ghost"
                    style={{ padding: '0.3rem 0.75rem', fontSize: 'var(--t-meta)' }}
                    onClick={(e) => { e.stopPropagation(); copy(`t${i}`, t); }}>
                    {copied === `t${i}` ? '已复制' : '复制'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
            <div className="panel__head">
              <span className="meta">正文</span>
              <button className="btn btn--ghost"
                style={{ padding: '0.32rem 0.85rem', fontSize: 'var(--t-meta)', letterSpacing: '0.14em' }}
                onClick={() => copy('body', result.body)}>
                {copied === 'body' ? '已复制' : '复制正文'}
              </button>
            </div>
            <div className="panel__body">
              <div style={{
                whiteSpace: 'pre-wrap', fontFamily: 'var(--font-body)',
                fontSize: 'var(--t-small)', lineHeight: 2, color: 'var(--ink)',
              }}>
                {result.body}
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
            <div className="panel__head">
              <span className="meta">话题标签</span>
              <button className="btn btn--ghost"
                style={{ padding: '0.32rem 0.85rem', fontSize: 'var(--t-meta)', letterSpacing: '0.14em' }}
                onClick={() => copy('tags', result.tags.map((t) => `#${t}`).join(' '))}>
                {copied === 'tags' ? '已复制' : '复制标签'}
              </button>
            </div>
            <div className="panel__body" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem' }}>
              {result.tags.map((t) => (
                <span key={t} style={{
                  border: 'var(--rule-strong)', padding: '0.32rem 0.75rem', borderRadius: '2px',
                  fontSize: 'var(--t-small)', color: 'var(--zhu-deep)',
                }}>#{t}</span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn--ghost" onClick={generate}>换一批标题</button>
            <button className="btn btn--ghost"
              onClick={() => copy('all', `${title}\n\n${result.body}\n\n${result.tags.map((t) => `#${t}`).join(' ')}`)}>
              一键复制全文
            </button>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 'var(--s-3)' }}>
          <div className="empty">
            <div className="empty__mark">✎</div>
            <div className="empty__title">填好左边的信息就能生成</div>
            <p className="empty__hint">
              本地模式用标题公式 + 正文骨架，产出<strong>能直接改着发</strong>的初稿，帮你把结构和钩子搭好。<br />
              想要原创度更高的成稿，点「使用 AI 生成」接你自己的模型。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * 插件：简历生成器
 * 表单填写 + 实时预览 + 导出 PDF。
 *
 * 导出采用浏览器「打印为 PDF」：因为 pdf-lib 内置标准字体不支持中文，
 * 而浏览器打印能直接调用系统中文字体，排版与屏幕所见一致，且零依赖。
 */

import { useRef, useState } from 'react';
import type { ToolProps } from '../../lib/core/types';
import { quota, remaining } from '../../lib/core/quota';

interface Exp { id: number; title: string; org: string; period: string; desc: string }
interface Edu { id: number; school: string; major: string; degree: string; period: string }

interface Resume {
  name: string; role: string; phone: string; email: string; city: string;
  summary: string;
  exp: Exp[];
  projects: Exp[];
  edu: Edu[];
  skills: string;
}

const EMPTY: Resume = {
  name: '张三', role: '产品经理', phone: '138 0000 0000',
  email: 'zhangsan@example.com', city: '上海',
  summary:
    '5 年 B 端产品经验，主导过 3 个从 0 到 1 的 SaaS 产品。擅长把复杂的业务流程拆成简单好用的功能，关注数据驱动与长期留存。',
  exp: [
    {
      id: 1, title: '高级产品经理', org: '某某科技有限公司', period: '2022.03 — 至今',
      desc: '• 负责 SaaS 核心模块从 0 到 1，上线 6 个月付费转化率提升 32%\n• 搭建需求优先级评估体系，迭代效率提升约 40%\n• 带领 5 人跨职能小组，季度目标达成率 100%',
    },
  ],
  projects: [
    {
      id: 1, title: '智能工单系统', org: '独立负责', period: '2023.05 — 2023.11',
      desc: '• 设计自动分派与 SLA 预警机制，平均处理时长下降 28%\n• 推动客服、研发、运营三方流程打通',
    },
  ],
  edu: [{ id: 1, school: '某某大学', major: '信息管理与信息系统', degree: '本科', period: '2014.09 — 2018.06' }],
  skills: '需求分析 · 数据分析 · Axure · Figma · SQL · 用户研究 · 项目管理',
};

function useList<T extends { id: number }>(init: T[]) {
  const [list, setList] = useState<T[]>(init);
  const idRef = useRef(init.reduce((m, x) => Math.max(m, x.id), 0));
  const add = () => {
    const id = ++idRef.current;
    setList((p) => [...p, { ...(p[0] as object), id } as T]);
  };
  const update = (id: number, patch: Partial<T>) =>
    setList((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const remove = (id: number) => setList((p) => p.filter((x) => x.id !== id));
  return { list, add, update, remove };
}

function Field({
  label, value, onChange, area, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  area?: boolean; placeholder?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div className="meta" style={{ marginBottom: '0.42rem' }}>{label}</div>
      {area ? (
        <textarea value={value} rows={3} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

export default function ResumeBuilder({ tool, capabilities }: ToolProps) {
  const [r, setR] = useState<Resume>(EMPTY);
  const [left, setLeft] = useState<number | null>(null);
  const exp = useList<Exp>(EMPTY.exp);
  const proj = useList<Exp>(EMPTY.projects);
  const edu = useList<Edu>(EMPTY.edu);
  const previewRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<Resume>) => setR((p) => ({ ...p, ...patch }));

  function exportPdf() {
    quota.consume(tool.slug, capabilities);
    setLeft(remaining(tool.slug, capabilities));
    window.print();
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #resume-preview, #resume-preview * { visibility: visible !important; }
          #resume-preview {
            position: absolute; left: 0; top: 0; width: 100%;
            border: 0 !important; padding: 0 !important; margin: 0 !important;
            box-shadow: none !important; background: #fff !important;
          }
          @page { size: A4; margin: 14mm 16mm; }
        }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)', gap: 'var(--s-4)', alignItems: 'start' }} className="resume-grid">
        {/* 表单 */}
        <div>
          <div className="panel">
            <div className="panel__head"><span className="meta">基本信息</span></div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-3)' }}>
              <Field label="姓名" value={r.name} onChange={(v) => set({ name: v })} />
              <Field label="求职意向" value={r.role} onChange={(v) => set({ role: v })} />
              <Field label="电话" value={r.phone} onChange={(v) => set({ phone: v })} />
              <Field label="邮箱" value={r.email} onChange={(v) => set({ email: v })} />
              <Field label="城市" value={r.city} onChange={(v) => set({ city: v })} />
            </div>
          </div>

          <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
            <div className="panel__head"><span className="meta">个人简介</span></div>
            <div className="panel__body">
              <Field label="" value={r.summary} onChange={(v) => set({ summary: v })} area
                placeholder="3-4 句话说清楚你是谁、擅长什么、最拿得出手的成果。" />
            </div>
          </div>

          <ListBlock title="工作经历" items={exp.list}
            onAdd={exp.add} onRemove={exp.remove}
            onUpdate={(id, k, v) => exp.update(id, { [k]: v } as Partial<Exp>)}
            fields={[['title', '职位'], ['org', '公司'], ['period', '时间'], ['desc', '工作内容与成果']]}
            areaKeys={['desc']} />

          <ListBlock title="项目经历" items={proj.list}
            onAdd={proj.add} onRemove={proj.remove}
            onUpdate={(id, k, v) => proj.update(id, { [k]: v } as Partial<Exp>)}
            fields={[['title', '项目名称'], ['org', '角色'], ['period', '时间'], ['desc', '项目描述与结果']]}
            areaKeys={['desc']} />

          <ListBlock title="教育背景" items={edu.list}
            onAdd={edu.add} onRemove={edu.remove}
            onUpdate={(id, k, v) => edu.update(id, { [k]: v } as Partial<Edu>)}
            fields={[['school', '学校'], ['major', '专业'], ['degree', '学历'], ['period', '时间']]} />

          <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
            <div className="panel__head"><span className="meta">技能标签</span></div>
            <div className="panel__body">
              <Field label="" value={r.skills} onChange={(v) => set({ skills: v })}
                placeholder="用 · 分隔，例如：需求分析 · SQL · Figma" />
            </div>
          </div>

          <div style={{ marginTop: 'var(--s-3)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn--zhu" onClick={exportPdf}>
              导出 PDF
            </button>
            <button className="btn btn--ghost" onClick={() => setR(EMPTY)}>恢复示例</button>
            <span className="quota" style={{ marginLeft: 'auto' }}>
              今日剩余 <strong style={{ color: 'var(--ink)', letterSpacing: 0 }}>{left ?? '—'}</strong> 次
            </span>
          </div>
          <p className="meta" style={{ marginTop: '0.85rem', lineHeight: 1.9, letterSpacing: '0.11em' }}>
            导出时在打印对话框里选择「另存为 PDF」，<br />纸张 A4、边距默认即可。
          </p>
        </div>

        {/* 预览 */}
        <div>
          <div className="meta" style={{ marginBottom: '0.75rem' }}>实时预览 · A4</div>
          <div
            id="resume-preview"
            ref={previewRef}
            style={{
              background: '#fff', border: 'var(--rule-strong)', borderRadius: '2px',
              padding: '2.15rem 2.35rem', boxShadow: '0 1px 3px oklch(0.25 0.02 65 / 0.08)',
              fontFamily: 'var(--font-body)', color: '#1a1614', fontSize: '9.5pt', lineHeight: 1.62,
            }}
          >
            {/* 抬头 */}
            <div style={{ borderBottom: '2px solid #1a1614', paddingBottom: '0.85rem', marginBottom: '1.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '22pt', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
                  {r.name || '姓名'}
                </h2>
                <span style={{ fontSize: '11pt', fontWeight: 600, color: '#c2410c' }}>{r.role}</span>
              </div>
              <div style={{ marginTop: '0.55rem', fontSize: '8.6pt', color: '#5a524b', display: 'flex', gap: '1.15rem', flexWrap: 'wrap' }}>
                <span>{r.phone}</span><span>{r.email}</span><span>{r.city}</span>
              </div>
            </div>

            <Section title="个人简介">
              <p style={{ margin: 0, textAlign: 'justify' }}>{r.summary}</p>
            </Section>

            {exp.list.length > 0 && (
              <Section title="工作经历">
                {exp.list.map((e) => (
                  <Entry key={e.id} title={e.title} org={e.org} period={e.period} desc={e.desc} />
                ))}
              </Section>
            )}

            {proj.list.length > 0 && (
              <Section title="项目经历">
                {proj.list.map((e) => (
                  <Entry key={e.id} title={e.title} org={e.org} period={e.period} desc={e.desc} />
                ))}
              </Section>
            )}

            {edu.list.length > 0 && (
              <Section title="教育背景">
                {edu.list.map((e) => (
                  <div key={e.id} style={{ marginBottom: '0.62rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                      <span style={{ fontWeight: 700 }}>{e.school}</span>
                      <span style={{ color: '#7a7169', fontSize: '8.6pt' }}>{e.period}</span>
                    </div>
                    <div style={{ color: '#5a524b', fontSize: '8.8pt' }}>{e.major} · {e.degree}</div>
                  </div>
                ))}
              </Section>
            )}

            {r.skills && (
              <Section title="技能">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.42rem' }}>
                  {r.skills.split(/[·,，、]/).map((s) => s.trim()).filter(Boolean).map((s, i) => (
                    <span key={i} style={{
                      border: '1px solid #ddd4c8', padding: '0.18rem 0.62rem',
                      borderRadius: '2px', fontSize: '8.4pt', color: '#3a342e',
                    }}>{s}</span>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .resume-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '1.15rem' }}>
      <h3 style={{
        fontSize: '10pt', fontWeight: 800, letterSpacing: '0.14em',
        textTransform: 'uppercase', color: '#c2410c',
        borderBottom: '1px solid #e6ddd0', paddingBottom: '0.32rem',
        marginBottom: '0.68rem', fontFamily: 'var(--font-body)',
      }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Entry({ title, org, period, desc }: { title: string; org: string; period: string; desc: string }) {
  return (
    <div style={{ marginBottom: '0.82rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 700 }}>{title}</span>
        <span style={{ color: '#7a7169', fontSize: '8.6pt', whiteSpace: 'nowrap' }}>{period}</span>
      </div>
      <div style={{ color: '#c2410c', fontSize: '8.8pt', fontWeight: 600 }}>{org}</div>
      <div style={{ marginTop: '0.28rem', whiteSpace: 'pre-wrap', color: '#3a342e', textAlign: 'justify' }}>
        {desc}
      </div>
    </div>
  );
}

function ListBlock<T extends { id: number }>({
  title, items, fields, areaKeys = [], onAdd, onRemove, onUpdate,
}: {
  title: string;
  items: T[];
  fields: Array<[keyof T & string, string]>;
  areaKeys?: string[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, key: keyof T & string, value: string) => void;
}) {
  return (
    <div className="panel" style={{ marginTop: '-1px', borderTop: 0 }}>
      <div className="panel__head">
        <span className="meta">{title}</span>
        <button
          className="btn btn--ghost"
          style={{ padding: '0.32rem 0.85rem', fontSize: 'var(--t-meta)', letterSpacing: '0.14em' }}
          onClick={onAdd}
        >
          ＋ 添加
        </button>
      </div>
      <div className="panel__body">
        {items.map((it, i) => (
          <div key={it.id} style={{ paddingTop: i === 0 ? 0 : 'var(--s-3)', marginTop: i === 0 ? 0 : 'var(--s-3)', borderTop: i === 0 ? 0 : 'var(--rule)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <span className="meta meta--zhu">#{i + 1}</span>
              <button
                className="btn btn--ghost"
                style={{ padding: '0.28rem 0.72rem', fontSize: 'var(--t-meta)' }}
                onClick={() => onRemove(Number(it.id))}
              >
                删除
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: areaKeys.length ? '1fr 1fr' : '1fr 1fr 1fr', gap: 'var(--s-2)' }}>
              {fields.map(([key, label]) => (
                <div key={key} style={areaKeys.includes(key) ? { gridColumn: '1 / -1' } : undefined}>
                  <Field
                    label={label}
                    value={String(it[key] ?? '')}
                    area={areaKeys.includes(key)}
                    onChange={(v) => onUpdate(Number(it.id), key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

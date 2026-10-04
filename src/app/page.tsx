import Link from 'next/link';
import { getAllTools, getToolSummaries } from '@/lib/core/registry';
import { PLANS, isToolUnlocked } from '@/lib/core/plans';
import { flags } from '@/lib/core/flags';

export default function HomePage() {
  const tools = getAllTools();
  const summaries = getToolSummaries('free');
  const liveCount = tools.filter((t) => t.status === 'live').length;

  return (
    <>
      {/* ── 首屏：超大衬线标题 + 排版化清单 ── */}
      <section className="shell hero">
        <div className="hero__grid">
          <div>
            <div className="hero__kicker reveal">
              <span className="meta meta--zhu">免费版 · 0.1.0</span>
            </div>

            <h1 className="hero__title reveal reveal--2">
              把文字
              <br />
              做成<em>顺手</em>的工具
            </h1>

            <p className="hero__lead reveal reveal--3">
              不是又一个塞满广告的工具站。
              <br />
              这里只放真正好用的文本工具——打开就用，不用注册，不上传你的内容。
            </p>

            <div className="reveal reveal--4" style={{ marginTop: '2.25rem', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
              <Link href="#tools" className="btn btn--zhu">
                开始使用
                <span aria-hidden>↓</span>
              </Link>
              <Link href="#pricing" className="btn btn--ghost">
                看看定价
              </Link>
            </div>
          </div>

          {/* 排版化清单，而非 hero-metric 模板 */}
          <div className="ledger reveal reveal--3">
            <div className="ledger__row">
              <span className="ledger__no">01</span>
              <span className="ledger__label">已上线工具</span>
              <span className="ledger__val">{liveCount}</span>
            </div>
            <div className="ledger__row">
              <span className="ledger__no">02</span>
              <span className="ledger__label">注册要求</span>
              <span className="ledger__val">无</span>
            </div>
            <div className="ledger__row">
              <span className="ledger__no">03</span>
              <span className="ledger__label">内容上传</span>
              <span className="ledger__val">不上传</span>
            </div>
            <div className="ledger__row">
              <span className="ledger__no">04</span>
              <span className="ledger__label">每日免费额度</span>
              <span className="ledger__val">{PLANS.free.defaults.dailyUse} 次</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 工具目录 ── */}
      <section className="shell section" id="tools">
        <div className="section__head">
          <h2 style={{ fontSize: 'var(--t-title)' }}>工具台</h2>
          <span className="meta">
            {summaries.length} 件 · 持续增加
          </span>
        </div>

        <div className="tools">
          {summaries.map((t, i) => {
            const unlocked = isToolUnlocked({ plan: t.locked ? 'pro' : 'free' }, 'free');
            return (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="tool-card reveal"
                style={{ animationDelay: `${0.05 + i * 0.07}s` }}
              >
                <span className="tool-card__icon" aria-hidden>
                  {t.icon}
                </span>
                <span className="tool-card__name">{t.name}</span>
                <span className="tool-card__sum">{t.summary}</span>
                <span className="tool-card__foot">
                  {t.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {unlocked ? (
                    <span className="tag tag--plan">免费</span>
                  ) : (
                    <span className="tag tag--plan">专业版</span>
                  )}
                </span>
              </Link>
            );
          })}

          {/* 扩展位：暗示「这里会长出更多东西」 */}
          <div className="tool-card" style={{ opacity: 0.62, justifyContent: 'center' }}>
            <span className="tool-card__icon" aria-hidden>
              ＋
            </span>
            <span className="tool-card__name">更多工具</span>
            <span className="tool-card__sum">
              正在打磨。想要什么功能，告诉我们，做得快。
            </span>
          </div>
        </div>
      </section>

      {/* ── 定价 ── */}
      <section className="shell section" id="pricing">
        <div className="section__head">
          <h2 style={{ fontSize: 'var(--t-title)' }}>定价</h2>
          <span className="meta">现阶段全部免费</span>
        </div>

        <div className="workbench" style={{ paddingTop: 0 }}>
          <div>
            <h3 style={{ fontSize: 'var(--t-h2)' }}>{PLANS.free.name}</h3>
            <p style={{ color: 'var(--ink-2)', marginTop: '0.75rem', maxWidth: '42ch' }}>
              {PLANS.free.tagline}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '1.75rem 0 0' }}>
              {PLANS.free.features.map((f) => (
                <li
                  key={f}
                  style={{
                    padding: '0.72rem 0',
                    borderBottom: 'var(--rule)',
                    display: 'flex',
                    gap: '0.85rem',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ color: 'var(--zhu)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>✓</span>
                  <span style={{ fontSize: 'var(--t-small)' }}>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <aside>
            <div className="aside-block">
              <dt>现在收费吗</dt>
              <dd>不收</dd>
            </div>
            <div className="aside-block">
              <dt>需要注册吗</dt>
              <dd>不需要</dd>
            </div>
            <div className="aside-block">
              <dt>会有专业版吗</dt>
              <dd>会 · 待定</dd>
            </div>
            {!flags.payment && (
              <p className="meta" style={{ marginTop: '1.25rem', lineHeight: 1.9, letterSpacing: '0.12em' }}>
                我们先把它做好用，<br />再考虑怎么收费。
              </p>
            )}
          </aside>
        </div>
      </section>
    </>
  );
}

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '字匠 TypeSmith · 文本工具工坊',
    template: '%s · 字匠 TypeSmith',
  },
  description:
    '一批精心打磨的免费文本工具：可读性分析、文本对比、命名转换。无需注册，打开即用。',
  keywords: ['文本工具', '可读性分析', '文本对比', '命名转换', '在线工具'],
};

export const viewport: Viewport = {
  themeColor: '#f7f3ec',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="topbar">
          <div className="shell topbar__in">
            <Link href="/" className="brand" aria-label="字匠首页">
              <span className="brand__mark">匠</span>
              <span>字匠</span>
              <span className="brand__sub">TypeSmith</span>
            </Link>
            <nav className="topnav">
              <Link href="/#tools">全部工具</Link>
              <Link href="/#pricing">定价</Link>
              <Link href="/#about">关于</Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="footer" id="about">
          <div className="shell footer__in">
            <div>
              <div className="brand" style={{ fontSize: '1.05rem' }}>
                <span className="brand__mark" style={{ width: '1.45rem', height: '1.45rem', fontSize: '0.78rem' }}>
                  匠
                </span>
                字匠 TypeSmith
              </div>
              <p className="meta" style={{ marginTop: '0.85rem', letterSpacing: '0.16em' }}>
                免费 · 无需注册 · 本地运算不上传
              </p>
            </div>
            <p className="meta" style={{ maxWidth: '32ch', lineHeight: 2, letterSpacing: '0.12em' }}>
              为写字的人、做校对的人、写代码的人做的工具箱。<br />
              版本 0.1.0 · 免费版
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

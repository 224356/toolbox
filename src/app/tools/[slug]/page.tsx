import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllTools, getTool } from '@/lib/core/registry';
import Workbench from './workbench';

interface Params {
  params: Promise<{ slug: string }>;
}

/** 静态生成所有工具页，将来加工具自动进构建 */
export function generateStaticParams() {
  return getAllTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return { title: '未找到工具' };
  return {
    title: tool.name,
    description: tool.summary,
    keywords: tool.tags,
  };
}

export default async function ToolPage({ params }: Params) {
  const { slug } = await params;
  if (!getTool(slug)) notFound();
  return <Workbench slug={slug} />;
}

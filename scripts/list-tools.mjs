/**
 * 开发辅助：列出当前注册的所有工具
 * 用法：npm run tools:list
 *
 * 注意：这是一份独立的轻量读取器，不依赖 Next.js 运行时，
 * 只解析 registry.ts 的注册块，用于快速体检。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const registryPath = resolve(__dirname, '../src/lib/core/registry.ts');

const src = readFileSync(registryPath, 'utf8');

// 匹配 register({ ... }) 块里的关键字段
const blocks = src.split('register({').slice(1);
const tools = blocks.map((b) => {
  const pick = (key) => {
    const m = b.match(new RegExp(`${key}:\\s*'([^']+)'`));
    return m ? m[1] : '';
  };
  return {
    slug: pick('slug'),
    name: pick('name'),
    category: pick('category'),
    plan: pick('plan'),
    status: pick('status'),
    icon: pick('icon'),
  };
});

if (tools.length === 0) {
  console.log('（注册表为空）');
  process.exit(0);
}

const width = Math.max(...tools.map((t) => t.slug.length));
console.log(`\n已注册 ${tools.length} 个工具：\n`);
console.log(
  '  ' +
    'SLUG'.padEnd(width) +
    '  NAME'.padEnd(16) +
    'CATEGORY'.padEnd(12) +
    'PLAN'.padEnd(8) +
    'STATUS',
);
console.log('  ' + '─'.repeat(width + 48));
for (const t of tools) {
  console.log(
    '  ' +
      t.slug.padEnd(width) +
      '  ' + t.name.padEnd(14) +
      t.category.padEnd(12) +
      t.plan.padEnd(8) +
      t.status,
  );
}
console.log('');

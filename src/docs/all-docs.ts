// In-app docs are sourced from markdown files in /docs at build time.

export interface DocContent {
  slug: string;
  title: string;
  content: string;
}

const docModules = import.meta.glob<string>('../../docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const titleFromMarkdown = (content: string, fallback: string) => {
  const heading = content.split('\n').find(line => line.startsWith('# '));
  return heading ? heading.replace(/^#\s+/, '').trim() : fallback;
};

const titleFromPath = (path: string) => {
  const filename = path.split('/').pop()?.replace(/\.md$/, '') || path;
  return filename
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const order = [
  'CODEBASE',
  'UI',
  'WHOIS',
  'WHOIS_DASHBOARD',
  'DB',
  'AUTH',
  'SUGGESTION',
  'MIGRATION',
];

export const docs: DocContent[] = Object.entries(docModules)
  .map(([path, content]) => {
    const filename = path.split('/').pop()?.replace(/\.md$/, '') || path;
    return {
      slug: filename.toLowerCase(),
      title: titleFromMarkdown(content, titleFromPath(path)),
      content,
    };
  })
  .sort((a, b) => {
    const aIndex = order.findIndex(item => item.toLowerCase() === a.slug);
    const bIndex = order.findIndex(item => item.toLowerCase() === b.slug);
    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    }
    return a.title.localeCompare(b.title);
  });

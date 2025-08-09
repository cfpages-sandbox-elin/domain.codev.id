import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { docs, DocContent } from '../docs/all-docs';
import Spinner from './Spinner';

const DocsPage: React.FC = () => {
    const [selectedDoc, setSelectedDoc] = useState<DocContent>(docs[0]);
    const [htmlContent, setHtmlContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const parseMarkdown = async () => {
            if (selectedDoc) {
                setIsLoading(true);
                // Configure marked to add Tailwind classes for consistent styling
                const renderer = new marked.Renderer();
                
                renderer.heading = function(text, level) {
                    const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
                    return `<h${level} class="${sizes[level - 1]} font-bold mt-8 mb-4 text-slate-800 dark:text-white">${text}</h${level}>`;
                };
                renderer.paragraph = (text) => `<p class="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">${text}</p>`;
                renderer.list = function(body, ordered) {
                    const tag = ordered ? 'ol' : 'ul';
                    const styles = ordered ? 'list-decimal' : 'list-disc';
                    return `<${tag} class="${styles} list-inside pl-4 mb-4 space-y-2">${body}</${tag}>`;
                };
                renderer.listitem = (text) => `<li class="text-slate-600 dark:text-slate-300">${text}</li>`;
                renderer.code = function(code, lang) {
                    const language = lang || 'bash';
                    return `<pre class="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 my-4"><code class="language-${language} text-sm font-mono whitespace-pre-wrap">${code}</code></pre>`;
                };
                renderer.codespan = (text) => `<code class="bg-slate-200 dark:bg-slate-700 rounded px-1.5 py-1 text-sm font-mono text-brand-red">${text}</code>`;
                renderer.link = function(href, title, text) {
                    return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer" class="text-brand-blue hover:underline font-semibold">${text}</a>`;
                };
                renderer.strong = (text) => `<strong class="font-semibold text-slate-800 dark:text-slate-200">${text}</strong>`;
                renderer.blockquote = (quote) => `<blockquote class="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-4 text-slate-500 dark:text-slate-400">${quote}</blockquote>`;
                renderer.hr = () => `<hr class="my-8 border-slate-200 dark:border-slate-700" />`;
                renderer.table = function(header, body) {
                    return `<div class="overflow-x-auto my-6"><table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead>${header}</thead><tbody class="divide-y divide-slate-200 dark:divide-slate-700">${body}</tbody></table></div>`;
                };
                renderer.tablerow = (content) => `<tr class="bg-white dark:bg-slate-800">${content}</tr>`;
                renderer.tablecell = function(content, flags) {
                    return `<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 ${flags.header ? 'font-bold text-slate-800 dark:text-white' : ''}">${content}</td>`;
                };

                marked.use({ renderer });
                
                const rawHtml = await marked.parse(selectedDoc.content, { async: true });
                setHtmlContent(rawHtml);
                contentRef.current?.scrollTo(0, 0); // Scroll to top on doc change
                setIsLoading(false);
            }
        };
        parseMarkdown();
    }, [selectedDoc]);
    
    return (
        <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
            <aside className="w-full md:w-64 flex-shrink-0">
                <div className="sticky top-24">
                    <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Documentation</h3>
                    <nav className="flex flex-col space-y-1">
                        {docs.map(doc => (
                            <button
                                key={doc.slug}
                                onClick={() => setSelectedDoc(doc)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                                    selectedDoc.slug === doc.slug
                                    ? 'bg-brand-blue text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {doc.title}
                            </button>
                        ))}
                    </nav>
                </div>
            </aside>
            <article 
                ref={contentRef}
                className="flex-grow bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-lg min-h-[60vh] prose-p:text-red"
            >
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Spinner color="border-brand-blue" size="lg" />
                    </div>
                ) : (
                   <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                )}
            </article>
        </div>
    );
}

export default DocsPage;
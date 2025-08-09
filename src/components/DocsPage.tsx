import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import type { Tokens } from 'marked';
import { docs, DocContent } from '../docs/all-docs';
import Spinner from './Spinner';


// Helper function to escape HTML entities.
// This is needed for the code renderer to prevent interpreting HTML tags inside code blocks.
function escape(html: string) {
    return html.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
}

/**
 * A custom renderer for Marked that extends the base renderer to apply Tailwind CSS classes
 * to the generated HTML. This approach is type-safe and allows access to the internal
 * parser (`this.parser`) for correctly rendering nested markdown tokens.
 */
class CustomRenderer extends marked.Renderer {
    heading(token: Tokens.Heading): string {
        const text = this.parser.parseInline(token.tokens || []);
        const level = token.depth;
        const sizes = ['text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm'];
        return `<h${level} class="${sizes[level - 1]} font-bold mt-8 mb-4 text-slate-800 dark:text-white">${text}</h${level}>`;
    }

    paragraph(token: Tokens.Paragraph): string {
        const text = this.parser.parseInline(token.tokens || []);
        return `<p class="mb-4 text-slate-600 dark:text-slate-300 leading-relaxed">${text}</p>`;
    }

    list(token: Tokens.List): string {
        const tag = token.ordered ? 'ol' : 'ul';
        const styles = token.ordered ? 'list-decimal' : 'list-disc';
        let body = '';
        for (const item of token.items) {
            body += this.listitem(item);
        }
        return `<${tag} class="${styles} list-inside pl-4 mb-4 space-y-2">${body}</${tag}>`;
    }

    listitem(token: Tokens.ListItem): string {
        const text = this.parser.parse(token.tokens || []);
        return `<li class="text-slate-600 dark:text-slate-300">${text}</li>`;
    }

    code(token: Tokens.Code): string {
        const language = token.lang || 'bash';
        // Use the helper to escape HTML characters in the code.
        const escapedCode = token.escaped ? token.text : escape(token.text);
        return `<pre class="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 my-4"><code class="language-${language} text-sm font-mono whitespace-pre-wrap">${escapedCode}</code></pre>`;
    }

    codespan(token: Tokens.Codespan): string {
        return `<code class="bg-slate-200 dark:bg-slate-700 rounded px-1.5 py-1 text-sm font-mono text-brand-red">${token.text}</code>`;
    }

    link(token: Tokens.Link): string {
        const text = this.parser.parseInline(token.tokens || []);
        return `<a href="${token.href}" title="${token.title || ''}" target="_blank" rel="noopener noreferrer" class="text-brand-blue hover:underline font-semibold">${text}</a>`;
    }

    strong(token: Tokens.Strong): string {
        const text = this.parser.parseInline(token.tokens || []);
        return `<strong class="font-semibold text-slate-800 dark:text-slate-200">${text}</strong>`;
    }

    blockquote(token: Tokens.Blockquote): string {
        const text = this.parser.parse(token.tokens || []);
        return `<blockquote class="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-4 text-slate-500 dark:text-slate-400">${text}</blockquote>`;
    }

    hr(): string {
        return `<hr class="my-8 border-slate-200 dark:border-slate-700" />`;
    }

    table(token: Tokens.Table): string {
        let header = '';
        for (const cell of token.header) {
            header += this.tablecell(cell);
        }

        let body = '';
        for (const row of token.rows) {
            let rowContent = '';
            for (const cell of row) {
                rowContent += this.tablecell(cell);
            }
            body += `<tr class="bg-white dark:bg-slate-800">${rowContent}</tr>`;
        }
        return `<div class="overflow-x-auto my-6"><table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead><tr class="bg-white dark:bg-slate-800">${header}</tr></thead><tbody class="divide-y divide-slate-200 dark:divide-slate-700">${body}</tbody></table></div>`;
    }

    tablecell(token: Tokens.TableCell): string {
        const text = this.parser.parseInline(token.tokens || []);
        const tag = token.header ? 'th' : 'td';
        const classes = `px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 ${token.header ? 'font-bold text-slate-800 dark:text-white' : ''}`;
        return `<${tag} class="${classes}">${text}</${tag}>`;
    }
}


const DocsPage: React.FC = () => {
    const [selectedDoc, setSelectedDoc] = useState<DocContent>(docs[0]);
    const [htmlContent, setHtmlContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const parseMarkdown = async () => {
            if (selectedDoc) {
                setIsLoading(true);
                
                const renderer = new CustomRenderer();
                const rawHtml = await marked.parse(selectedDoc.content, { async: true, renderer });

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
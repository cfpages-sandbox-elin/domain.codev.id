# Troubleshooting Guide

This document covers common issues and their solutions when working with this project.

## Issue: Build fails with TypeScript errors in `DocsPage.tsx`

You may encounter a series of build errors related to the `marked` library, like this:

```
src/components/DocsPage.tsx(19,17): error TS2322: Type '(text: any, level: any) => string' is not assignable to type '({ tokens, depth }: Heading) => string'.
```

### The Problem: API and Type Definition Mismatch

This error occurs due to a mismatch between the JavaScript implementation of the `marked` library and its corresponding TypeScript type definitions (`@types/marked`).

The `marked` library has evolved, and there are two primary ways to customize its HTML output:

1.  **The "Old" Way (Instance-based):** You create a new renderer instance (`new marked.Renderer()`) and override its methods. The functions for this method take simple arguments, like `renderer.heading = function(text, level) { ... }`. This is how the code was originally written.

2.  **The "New" Way (Extension API):** You pass a plain JavaScript object with renderer functions to `marked.use({ renderer: ... })`. The functions for this newer method receive a single complex **token object**, like `heading(token) { ... }`.

The problem is that the official TypeScript types for recent versions of `marked` **only describe the new, token-based API**. When the TypeScript compiler sees the old, argument-based functions in the code, it flags them as errors because they don't match the token-based signatures in the type definitions.

### The Solution: Extend the Renderer Class

The most robust and type-safe way to resolve this is to adopt the modern approach that aligns with the TypeScript types. While the extension API (`marked.use()`) is one option, an even better solution is to **extend the `marked.Renderer` class**.

This approach has a significant advantage: it provides access to the renderer's internal parser via `this.parser`. This is crucial for correctly rendering nested markdown elements (e.g., a link inside a paragraph or bold text in a list item), a task that is very difficult with the other methods.

#### Correct Implementation (`src/components/DocsPage.tsx`)

The fix involves refactoring the component to use a custom class that extends `marked.Renderer`.

```tsx
import { marked } from 'marked';
import type { Tokens } from 'marked';

// 1. Create a custom class that extends the base renderer
class CustomRenderer extends marked.Renderer {
    // 2. Override methods using the correct token-based signatures
    heading(token: Tokens.Heading): string {
        // 3. Use the internal parser to correctly render nested content
        const text = this.parser.parseInline(token.tokens || []);
        const level = token.depth;
        // ... apply custom styling
        return `<h${level} class="...">${text}</h${level}>`;
    }

    // ... other overrides ...
}

// 4. In the component, use an instance of the new custom renderer
useEffect(() => {
    const parseMarkdown = async () => {
        // ...
        const renderer = new CustomRenderer();
        const rawHtml = await marked.parse(selectedDoc.content, { async: true, renderer });
        setHtmlContent(rawHtml);
        // ...
    };
    parseMarkdown();
}, [selectedDoc]);
```

This pattern resolves all the build errors, ensures type safety, and correctly renders the documentation with the desired custom styling.

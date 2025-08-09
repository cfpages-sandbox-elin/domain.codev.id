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

2.  **The "New" Way (Extension API):** You pass a plain JavaScript object with renderer functions to `marked.use({ renderer: ... })\`. The functions for this newer method receive a single complex **token object**, like `heading(token) { ... }\`.

The problem is that the official TypeScript types for recent versions of `marked` **only describe the new, token-based API**. When the TypeScript compiler sees the old, argument-based functions in the code, it flags them as errors because they don't match the token-based signatures in the type definitions.

### The Solution: Extend the Renderer Class

The most robust and type-safe way to resolve this is to adopt the modern approach that aligns with the TypeScript types. While the extension API (`marked.use()`) is one option, an even better solution is to **extend the `marked.Renderer` class**.

This approach has a significant advantage: it provides access to the renderer's internal parser via `this.parser`. This is crucial for correctly rendering nested markdown elements (e.g., a link inside a paragraph or bold text in a list item), a task that is very difficult with the other methods.

#### Correct Implementation (`src/components/DocsPage.tsx`)

The fix involves refactoring the component to use a custom class that extends `marked.Renderer`.

\`\`\`tsx
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
        return \`<h\${level} class="...">\${text}</h\${level}>\`;
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
\`\`\`

This pattern resolves all the build errors, ensures type safety, and correctly renders the documentation with the desired custom styling.

---

## Issue: Supabase TypeScript errors like "Type instantiation is excessively deep"

You might encounter TypeScript errors in `src/services/supabaseService.ts` when using the Supabase client, with messages like:

```
Type instantiation is excessively deep and possibly infinite.
```
or errors related to `Insert<"domains">` or `Update<"domains">`.

### The Problem: Mismatch between Database Schema and TypeScript Types

This error is a classic sign that the TypeScript types used by the Supabase client are out of sync with your actual database schema. In this project, it's specifically caused by using custom `ENUM` types in the database (`domain_tag_type` and `domain_status_type`) without telling the Supabase client what those types are.

When the `createClient` function is typed with our `Database` interface, TypeScript tries to infer the types for `insert`, `update`, and `select` operations. If it encounters a type from the database (like `domain_tag_type`) that isn't defined in the `Enums` section of the `Database` interface, it can't resolve the type and enters a recursive loop, resulting in the "excessively deep" error.

### The Solution: Align Your Types with the Database Schema

There are two ways to fix this. The first is a manual fix that solves the immediate problem. The second is the recommended, long-term solution using the Supabase CLI.

#### 1. Manual Fix (The Quick Fix)

You can manually update the `Database` interface in `src/services/supabaseService.ts` to include the definitions for your custom ENUM types.

**`src/services/supabaseService.ts`**
```typescript
// ... import DomainTag, DomainStatus from '../types' ...

export interface Database {
  public: {
    // ... Tables, Views, Functions ...
    Enums: {
      // Add these two lines
      domain_status_type: DomainStatus;
      domain_tag_type: DomainTag;
    };
    // ... CompositeTypes ...
  };
}
```

This tells TypeScript what `'mine' | 'to-snatch'` and the other status strings are valid for these enum types, resolving the error. This is the fix that has been applied to the codebase.

#### 2. Recommended Solution: Generate Types with Supabase CLI

The best practice for keeping your database and application types in sync is to let the Supabase CLI generate the types for you directly from your schema. This eliminates manual errors and makes it easy to update types whenever you change your database.

**Step 1: Generate the Type File**
Run the following command in your project's root directory. Make sure you have linked your project with `npx supabase link`.

```bash
# For local development
npx supabase gen types typescript --local > src/types/supabase.ts

# For a remote project
npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
```

This command inspects your database schema and creates a file `src/types/supabase.ts` containing all the necessary interfaces, including your custom enums.

**Step 2: Use the Generated Types**
Now, modify `src/services/supabaseService.ts` to use these generated types.

```typescript
// src/services/supabaseService.ts
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
// 1. Import the generated Database type
import { Database } from '../types/supabase'; // Adjust path if needed

// We no longer need to manually define the Database interface here.
// The rest of the file can use the imported `Database` type.

// ...

// 2. The createClient call is now correctly typed from the generated file.
const supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

By adopting this workflow, you ensure your application's type safety and prevent this category of errors from happening again.
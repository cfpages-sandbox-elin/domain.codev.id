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

### The Problem: Manually Defined Types vs. Inferred Types

This error often happens when there's a disconnect between how we think the data should look and how the database is actually structured. In this project's code, we might have:
1.  A `Domain` type in `src/types.ts` that represents a full row from our database table.
2.  Manually created `NewDomain` and `DomainUpdate` types for creating and updating records.

The problem is that the Supabase client is smart enough to figure out what an "insert" or "update" object should look like just by looking at the main `Domain` type (the "Row" type). When we create our own `NewDomain` and `DomainUpdate` types, we are essentially telling TypeScript, "ignore what Supabase thinks, use my version". This can lead to subtle conflicts that cause confusing, deep-seated type errors.

For example, if we add a new column to our database table in the Supabase UI, we have to remember to update **three** different types in our code: `Domain`, `NewDomain`, and `DomainUpdate`. If we forget one, the types become out of sync and errors can occur.

### The Solution: Let Supabase Do the Work

The most robust and simple solution is to **let the Supabase client infer the types for inserts and updates**. This means we only need to maintain one "source of truth": the `Domain` type.

#### Step 1: Simplify the `Database` Interface

First, we ensure our main `Database` interface in `src/services/supabaseService.ts` is simple and clean. We only need to tell it what a `Row` looks like.

**`src/services/supabaseService.ts`**
```typescript
// Define the database schema based on the existing types.
// This provides type safety for all Supabase queries.
export interface Database {
  public: {
    Tables: {
      domains: {
        // This is our single source of truth.
        // Supabase will automatically infer Insert and Update types from this.
        Row: Domain; 
      };
    };
    Views: { /* ... */ };
    Functions: { /* ... */ };
    Enums: {
      // It's still important to tell Supabase about our custom ENUM types
      // that we created in the database via the Supabase UI.
      domain_status_type: DomainStatus;
      domain_tag_type: DomainTag;
    };
    CompositeTypes: { /* ... */ };
  };
}
```

#### Step 2: Remove Manual Insert/Update Types

Next, we delete the manually created `NewDomain` and `DomainUpdate` interfaces from `src/types.ts`. They are no longer needed because Supabase will generate them for us in memory.

**`src/types.ts`**
```typescript
// ...

// The ground truth for a domain record from the database.
export interface Domain {
  // ... (this stays the same)
}

// DELETE the NewDomain interface
// DELETE the DomainUpdate interface
```

#### Step 3: Use the Inferred Types in Service Functions

Finally, we update our service functions in `src/services/supabaseService.ts` to use the types Supabase infers for us. This makes the code more resilient to database changes.

**`src/services/supabaseService.ts`**
```typescript
// ...

// Define our Insert and Update types based on Supabase's inference.
// These are now derived directly from our `Domain` (Row) type.
export type DomainInsert = Database['public']['Tables']['domains']['Insert'];
export type DomainUpdate = Database['public']['Tables']['domains']['Update'];

// Update function signatures to use the new types
export const addDomain = async (domainData: DomainInsert): Promise<Domain | null> => {
    // ... function body remains the same
};

export const updateDomain = async (id: number, updates: DomainUpdate): Promise<Domain | null> => {
    // ... function body remains the same
};
```
By making these changes, we simplify our type management, reduce the chance of errors, and let Supabase's powerful type inference do the heavy lifting. Now, if we change our database schema, we only need to update the `Domain` interface, and the insert/update types will adjust automatically.

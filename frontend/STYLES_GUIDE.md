# LendForge Frontend - Styles Organization Guide

**Version:** 1.0.0
**Date:** 30 janvier 2025

---

## Philosophy: Utility-First with Tailwind CSS

We use **Tailwind CSS utility classes** as the primary styling approach, following shadcn/ui best practices.

### ✅ **DO**
- Use Tailwind utility classes inline (e.g., `className="flex gap-4 p-6"`)
- Extract repeated patterns into reusable components
- Keep `globals.css` minimal (< 100 lines)
- Use shadcn/ui components for UI primitives

### ❌ **DON'T**
- Create custom CSS classes for every component
- Use CSS Modules unless absolutely necessary
- Add styles to `globals.css` that could be Tailwind utilities
- Mix CSS-in-JS libraries with Tailwind

---

## File Organization

```
frontend/
├── app/
│   └── globals.css              # Minimal: Tailwind directives + theme variables
│
├── components/
│   ├── layout/
│   │   ├── PageContainer.tsx    # Reusable: flex-1 p-6 space-y-6
│   │   ├── Section.tsx          # Vertical spacing variants
│   │   └── ContentGrid.tsx      # Responsive grid layouts
│   │
│   └── ui/                      # shadcn/ui components (DO NOT EDIT)
│
└── tailwind.config.ts           # Design tokens and theme customization
```

---

## Reusable Layout Components

### **1. PageContainer**

**Purpose:** Standard container for authenticated pages

**Usage:**
```tsx
import { PageContainer } from '@/components/layout/PageContainer';

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <PageContainer>
        {/* Page content */}
      </PageContainer>
    </>
  );
}
```

**Equivalent to:**
```tsx
<div className="flex-1 p-6 space-y-6">
  {/* Page content */}
</div>
```

---

### **2. Section**

**Purpose:** Group related content with consistent spacing

**Usage:**
```tsx
import { Section } from '@/components/layout/Section';

<Section spacing="lg">
  <Card>...</Card>
  <Card>...</Card>
</Section>
```

**Props:**
- `spacing`: `'sm'` (16px) | `'md'` (24px) | `'lg'` (32px)
- `className`: Additional Tailwind classes

---

### **3. ContentGrid**

**Purpose:** Responsive grid for dashboard widgets

**Usage:**
```tsx
import { ContentGrid } from '@/components/layout/ContentGrid';

<ContentGrid cols={3}>
  <Card>Widget 1</Card>
  <Card>Widget 2</Card>
  <Card>Widget 3</Card>
</ContentGrid>
```

**Props:**
- `cols`: `1` | `2` | `3` | `4` (responsive breakpoints handled automatically)

**Responsive Behavior:**
- `cols={3}`: Mobile 1 col → Tablet 2 cols → Desktop 3 cols
- `cols={4}`: Mobile 1 col → Tablet 2 cols → Desktop 4 cols

---

## globals.css Structure

**Keep minimal - only include:**

1. **Tailwind Directives** (required)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

2. **Theme Variables** (shadcn/ui)
```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    /* ... */
  }
}
```

3. **Basic Resets** (if needed)
```css
@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Current size:** ~90 lines (✅ Good!)

---

## Common Patterns

### **Card Layout**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### **Flex Container**
```tsx
<div className="flex items-center gap-4">
  {/* Items */}
</div>
```

### **Grid Layout**
```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Items */}
</div>
```

### **Spacing**
```tsx
<div className="space-y-6">  {/* Vertical spacing */}
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<div className="space-x-4">  {/* Horizontal spacing */}
  <span>Item 1</span>
  <span>Item 2</span>
</div>
```

---

## Tailwind Config Customization

**When to extend `tailwind.config.ts`:**

1. **Design Tokens** (colors, spacing, fonts)
```typescript
theme: {
  extend: {
    colors: {
      'brand': '#123456',
    },
    spacing: {
      'page': '1.5rem',
    },
  },
}
```

2. **Custom Utilities** (rare, use sparingly)
```typescript
plugins: [
  function({ addUtilities }) {
    addUtilities({
      '.scrollbar-hide': {
        '-ms-overflow-style': 'none',
        'scrollbar-width': 'none',
      },
    });
  },
],
```

---

## Anti-Patterns to Avoid

### ❌ **Creating Unnecessary CSS Classes**
```css
/* DON'T */
.my-button {
  padding: 1rem;
  background-color: blue;
}
```

```tsx
/* DO */
<button className="p-4 bg-blue-500">
```

---

### ❌ **Repeating Same Pattern Without Component**
```tsx
/* DON'T */
<div className="flex-1 p-6 space-y-6">...</div>
<div className="flex-1 p-6 space-y-6">...</div>
<div className="flex-1 p-6 space-y-6">...</div>
```

```tsx
/* DO */
<PageContainer>...</PageContainer>
<PageContainer>...</PageContainer>
<PageContainer>...</PageContainer>
```

---

### ❌ **Adding Global Styles for Components**
```css
/* DON'T */
.card {
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

```tsx
/* DO - Use shadcn/ui Card component */
import { Card } from '@/components/ui/card';
<Card>...</Card>
```

---

## When to Create a New Component

**Extract into component if:**
- ✅ Pattern repeats 3+ times
- ✅ Complex Tailwind class string (> 10 classes)
- ✅ Logic + styling combined
- ✅ Multiple variants needed

**Example:**
```tsx
// Before: Repeated pattern
<div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent">
  {/* Content */}
</div>

// After: Component
<ListItem>
  {/* Content */}
</ListItem>
```

---

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind Best Practices](https://tailwindcss.com/docs/reusing-styles)

---

**Status:** Phase 1 & 2 Complete
**Next:** Phase 3 will add more dashboard-specific components following these patterns

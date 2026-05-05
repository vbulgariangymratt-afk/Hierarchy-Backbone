# Backbone Hierarchy V2 — AI Style Guide
> **For Gemini:** Read this entire file before writing any UI code or CSS. Do not add a single color, background, border, shadow, or blur value that is not listed here or derived from the variables listed here. If something isn't covered, ask before inventing.

---

## 1. The Golden Rules (Never Break These)

1. **Never hardcode color values.** No `#ffffff`, no `rgba(0,0,0,0.5)`, no `color: white`. Always use a CSS variable from Section 3.
2. **Never invent new CSS variables.** Only use variables that already exist in the codebase.
3. **Never use inline styles for colors, backgrounds, borders, or shadows.** These must live in CSS files using the variables below.
4. **Never apply `backdrop-filter` in solid mode.** Solid mode explicitly removes all blur effects.
5. **Never use a single color value for something that must change across the 6 appearance modes.** If it's a background, text, border, or accent — it must use a variable so it adapts automatically.
6. **Always scope mode-specific overrides** using the correct selectors from Section 4.
7. **Always use spacing, radius, and font variables** from Section 3.1 — never hardcode `px` values for these unless they are truly one-off layout values.

---

## 2. The 6 Appearance Modes

The app has 6 modes defined by two attributes on the `<html>` element:

| Mode | `data-theme` | `data-background-mode` | Classes Applied |
|---|---|---|---|
| Solid Dark | `dark` | `solid` | `.dark .solid-mode` |
| Solid Light | `light` | `solid` | `.light .solid-mode` |
| Liquid Dark | `dark` | `liquid` | `.dark .liquid-mode` |
| Liquid Light | `light` | `liquid` | `.light .liquid-mode` |
| Wallpaper Dark | `dark` | `wallpaper` | `.dark .wallpaper-mode` |
| Wallpaper Light | `light` | `wallpaper` | `.light .wallpaper-mode` |

**Key behavioral differences:**
- **Solid modes:** Opaque backgrounds, no blur, high contrast, `backdrop-filter: none !important`
- **Liquid/Wallpaper modes:** Translucent backgrounds, `backdrop-filter: blur()`, glass aesthetic
- **Dark modes:** Light text on dark surfaces
- **Light modes:** Dark text on light surfaces
- **Solid Light specifically:** Uses black (`#000000`) as the accent color — not blue

---

## 3. CSS Variable Reference

### 3.1 Base Tokens (Same in ALL 6 modes — safe to use anywhere)

```css
/* Typography */
--font-family-sans        /* Primary font stack — always use this, never specify fonts directly */
--font-size-sm            /* 0.875rem */
--font-size-base          /* 1rem */
--font-size-lg            /* 1.125rem */
--font-size-xl            /* 1.5rem */
--font-size-2xl           /* 2rem */

/* Spacing */
--spacing-xs              /* 4px */
--spacing-sm              /* 8px */
--spacing-md              /* 16px */
--spacing-lg              /* 24px */
--spacing-xl              /* 32px */
--spacing-2xl             /* 48px */

/* Border Radius */
--radius-sm               /* 4px */
--radius-md               /* 8px */
--radius-lg               /* 12px */
--radius-full             /* 9999px — for pills/badges */

/* Transitions */
--transition-fast         /* 0.2s ease */
--transition-normal       /* 0.3s ease */

/* Semantic Colors (fixed, not theme-dependent) */
--color-primary           /* #c39a6b — warm gold, used for primary actions */
--color-primary-hover     /* #b08968 */
--color-success           /* #36b37e */
--color-warning           /* #ffab00 */
--color-danger            /* #ff5630 */
```

### 3.2 Adaptive Tokens (Change between dark/light — always use these for UI elements)

#### Text
```css
--text-primary            /* Main readable text — high contrast */
--text-secondary          /* Supporting text — medium contrast */
--text-tertiary           /* Labels, hints — lower contrast */
--text-muted              /* Disabled, placeholder — lowest contrast */
--color-text-main         /* Alias for --text-primary */
--color-text-secondary    /* Alias for --text-secondary */
```

#### Backgrounds
```css
--color-bg-main           /* Page/app background */
--color-bg-secondary      /* Slightly elevated surfaces */
--color-bg-card           /* Card backgrounds in solid mode */
--color-bg-hover          /* Hover state backgrounds */
--color-bg-sidebar-solid  /* Sidebar in solid mode */
--color-bg-sidebar-translucent /* Sidebar in liquid/wallpaper mode */
```

#### Borders & Alpha Layers
```css
--color-border            /* Standard border color */
--alpha-high              /* Subtle overlay — high opacity */
--alpha-med               /* Subtle overlay — medium opacity */
--alpha-low               /* Subtle overlay — low opacity */
```

#### Shadows
```css
--shadow-sm               /* Subtle elevation */
--shadow-md               /* Medium elevation — cards */
--shadow-lg               /* High elevation — modals, popovers */
```

#### Accent (CRITICAL — changes per mode, never hardcode)
```css
--color-accent            /* Primary interactive accent color */
--color-accent-hover      /* Accent on hover */
```
> ⚠️ `--color-accent` is:
> - `#0a84ff` (blue) in dark solid/liquid/wallpaper
> - `#0071e3` (blue) in light solid/liquid/wallpaper  
> - `#000000` (black) in solid light specifically
> - `rgba(255,255,255,0.8)` in dark liquid/wallpaper
> - `rgba(0,0,0,0.7)` in light liquid/wallpaper
> **This is why you must never hardcode an accent color.**

#### Focus/Contrast System
```css
--focus-color-focus       /* High contrast — primary interactive state */
--focus-color-status      /* Medium contrast — status indicators */
--focus-color-ghost       /* Low contrast — ghost/subtle elements */
--focus-color-track       /* Lowest — track backgrounds, progress bars */
```

#### Surface Tokens (from theme.css)
```css
--color-bg                /* Page background alias */
--color-surface           /* Card/panel surface */
--color-surface-elevated  /* Elevated surface (dropdowns, tooltips) */
```

---

## 4. How to Write Mode-Specific CSS

### Pattern A — Solid vs Glass (most common)
```css
/* Default (works in dark solid) */
.my-component {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
}

/* Liquid dark override */
.liquid-mode .my-component {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
}

/* Liquid light override */
.liquid-mode.light .my-component {
    background: rgba(255, 255, 255, 0.45);
    border-color: rgba(255, 255, 255, 0.55);
}

/* Wallpaper override */
.wallpaper-mode .my-component {
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.15);
}

/* Solid light override (if needed) */
[data-theme="light"][data-background-mode="solid"] .my-component {
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
}
```

### Pattern B — When the element only needs dark/light variants
```css
.my-component {
    color: var(--text-primary);
    background: var(--alpha-med);
    border: 1px solid var(--color-border);
}
/* No overrides needed — variables handle it automatically */
```

### Pattern C — Buttons and interactive elements
```css
.my-button-primary {
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-md);
    font-weight: 700;
    transition: var(--transition-fast);
}

.my-button-accent {
    background: var(--color-accent);
    color: white; /* or var(--color-text-inverse) */
    border-radius: var(--radius-md);
}
```

---

## 5. Glass Effect Rules

Glass effects are **only applied in liquid and wallpaper modes**. Solid mode always gets opaque backgrounds.

### Standard glass values (copy exactly — do not invent new ones):
```css
/* Dark liquid/wallpaper glass */
background: rgba(255, 255, 255, 0.08);
border: 1px solid rgba(255, 255, 255, 0.15);
backdrop-filter: blur(16px) saturate(160%);
-webkit-backdrop-filter: blur(16px) saturate(160%);
box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.20);

/* Light liquid glass */
background: rgba(255, 255, 255, 0.45);
border-color: rgba(255, 255, 255, 0.55);

/* Subtle glass (less prominent elements) */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(14px);
```

### Reusable glass classes (prefer these over writing custom glass CSS):
- `.glass-card` — standard glass card with full treatment
- `.glass-card--elevated` — more prominent glass surface
- `.glass-card--subtle` — lighter glass treatment
- `.liquid-glass` — applied to modals, popovers, floating UI

---

## 6. Typography Rules

```css
/* Always use the font variable */
font-family: var(--font-family-sans);

/* Size scale — use variables */
font-size: var(--font-size-sm);    /* Secondary/label text */
font-size: var(--font-size-base);  /* Body text */
font-size: var(--font-size-lg);    /* Subheadings */
font-size: var(--font-size-xl);    /* Section headings */
font-size: var(--font-size-2xl);   /* Page titles */

/* Weight conventions */
font-weight: 400;   /* Body copy */
font-weight: 600;   /* Labels, chips, badges */
font-weight: 700;   /* Buttons, emphasis */
font-weight: 800;   /* Titles, strong headings */
```

---

## 7. Spacing & Layout Conventions

```css
/* Card padding */
padding: var(--spacing-lg);         /* Standard card — 24px */
padding: var(--spacing-xl);         /* Prominent card — 32px */

/* Card border radius */
border-radius: var(--radius-lg);    /* Standard cards — 12px */
border-radius: 20px;                /* Large cards (prep-step style) */
border-radius: 24px;                /* Glass cards (.glass-card) */

/* Button height convention */
height: 44px;                       /* Standard interactive button */
border-radius: var(--radius-md);    /* Standard button radius — 8px */
border-radius: 12px;                /* Larger/prominent buttons */
border-radius: var(--radius-full);  /* Pill buttons/badges */

/* Gap between elements */
gap: var(--spacing-sm);             /* Tight groupings — 8px */
gap: var(--spacing-md);             /* Standard groupings — 16px */
gap: var(--spacing-lg);             /* Loose/section groupings — 24px */
```

---

## 8. What Gemini Must Never Do

| ❌ Wrong | ✅ Right |
|---|---|
| `color: white` | `color: var(--text-primary)` |
| `background: #262626` | `background: var(--color-bg-card)` |
| `border: 1px solid rgba(255,255,255,0.1)` | `border: 1px solid var(--color-border)` |
| `color: #0a84ff` | `color: var(--color-accent)` |
| `backdrop-filter: blur(20px)` on all modes | Scope blur inside `.liquid-mode` or `.wallpaper-mode` only |
| Invent a new `--color-my-thing` variable | Use the closest existing variable |
| Add glass effect in solid mode | Never — solid mode explicitly disables blur |
| Use `font-family: Inter` directly | `font-family: var(--font-family-sans)` |
| Hardcode `font-size: 14px` for UI text | Use `var(--font-size-sm)` or the appropriate token |

---

## 9. Adding New Components — Checklist

Before submitting any new UI code, verify:

- [ ] No hardcoded color values anywhere
- [ ] All text uses `--text-primary`, `--text-secondary`, `--text-tertiary`, or `--text-muted`
- [ ] All backgrounds use `--color-bg-*`, `--color-surface`, `--alpha-*`, or the approved glass values
- [ ] Borders use `--color-border` or the approved glass border values
- [ ] Accent color uses `--color-accent` — never hardcoded
- [ ] Glass/blur effects are scoped inside `.liquid-mode` or `.wallpaper-mode` only
- [ ] Solid mode gets opaque backgrounds — no `backdrop-filter`
- [ ] Spacing uses `--spacing-*` variables
- [ ] Border radius uses `--radius-*` variables or the conventions in Section 7
- [ ] Component has been tested mentally against all 6 mode combinations

---

## 10. How to Use This Guide

Add this line at the top of every prompt where you ask Gemini to build or modify UI:

> **"Before writing any code, read `STYLE_GUIDE.md` in the project root. Every color, background, border, shadow, and blur must follow the rules in that file. Do not hardcode any color values."**

Place `STYLE_GUIDE.md` in the project root: `Backbone Hierarchy V2/STYLE_GUIDE.md`
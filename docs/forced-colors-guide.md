# Forced-Colors (Windows High Contrast) Guide

## What was fixed

| Component | Problem | Fix |
|---|---|---|
| `Button` (all variants) | Custom bg/text overridden by forced-colors → invisible or unreadable buttons | `forced-color-adjust-none` + `forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText] forced-colors:border forced-colors:border-[ButtonText]` on every variant |
| `SignalBadge` (BUY/SELL/NEUTRAL) | Color-only meaning lost — all three badges looked identical | `forced-color-adjust-none` + distinct system colors: `Highlight` (BUY), `Mark` (SELL), `ButtonFace` (NEUTRAL) |
| `PremiumSignalBadge` (granted/locked) | Yellow/slate colors wiped out → premium vs locked indistinguishable | `forced-color-adjust-none` + `Highlight` (granted) / `GrayText` (locked) |
| `StakeBadge` (Gold/Silver/Bronze) | All three tiers collapsed to same color | `forced-color-adjust-none` + `Highlight` / `LinkText` / `GrayText` per tier |
| `ProviderBadge` (verified/professional/new) | bg-blue/purple/orange wiped out | `forced-color-adjust-none` + `LinkText` / `Highlight` / `ButtonText` |
| `DemoModeToggle` | Active blue ring invisible; inactive state borderless | `forced-color-adjust-none` + `Highlight/HighlightText` when active, `ButtonText` border when inactive |
| `ThemeToggle` | Icon-only button with no border → invisible in high contrast | `forced-colors:border forced-colors:border-[ButtonText]` |
| `SignalCard` share dropdown | Custom `bg-card` wiped, hover state lost | `.share-menu` class + global `forced-colors` block: `Canvas`/`CanvasText` base, `Highlight`/`HighlightText` hover |
| Focus rings globally | `box-shadow`-based rings dropped by forced-colors | Global `*:focus-visible { outline: 2px solid ButtonText }` in `globals.css` |
| Disabled elements | `opacity-50` makes `GrayText` even harder to read | `opacity: 1; color: GrayText; border-color: GrayText` |

## Pattern to follow for new components

### 1. Decorative color (no semantic meaning)
Leave `forced-color-adjust` at its default (`auto`). The OS repaints it.

### 2. Color carries meaning (badge, status pill, toggle state)
```tsx
// Tailwind approach — inline forced-colors utilities
className="bg-green-500 text-white forced-color-adjust-none
           forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]
           forced-colors:border forced-colors:border-[HighlightText]"
```

```css
/* CSS approach — for plain CSS / globals.css */
@media (forced-colors: active) {
  .my-component {
    forced-color-adjust: none;
    background-color: Highlight;
    color: HighlightText;
    border: 1px solid HighlightText;
  }
}
```

### 3. Focus rings
Never rely solely on `box-shadow` for focus indicators.
Always pair with `focus-visible:outline-2 focus-visible:outline-offset-2`.
The global `*:focus-visible` rule in `globals.css` is a safety net but each
component should still set its own outline for specificity reasons.

### 4. SVG icons inside forced-color-adjust-none containers
Override fill/stroke explicitly:
```tsx
<Star className="fill-yellow-400 forced-colors:fill-[Highlight]" />
```

## System color keyword reference

| Keyword | Meaning |
|---|---|
| `Canvas` | Page / element background |
| `CanvasText` | Default text on Canvas |
| `ButtonFace` | Button background |
| `ButtonText` | Button text / interactive-element text |
| `Highlight` | Selected / active highlight background |
| `HighlightText` | Text on Highlight |
| `GrayText` | Disabled text |
| `LinkText` | Unvisited link |
| `Mark` | Marked/highlighted text background |
| `MarkText` | Text on Mark |

## How to test

1. Chrome / Edge DevTools → Rendering tab → "Emulate CSS media feature forced-colors" → `active`
2. Windows → Settings → Accessibility → Contrast themes → enable any theme
3. Verify: every interactive element has a visible border or outline, badge labels remain legible, focus rings appear on Tab navigation.

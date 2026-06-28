# Forced-colors / high-contrast guidelines

Use these patterns when adding new interactive UI:

- Prefer semantic tokens and system colors in forced-colors mode (`Highlight`, `HighlightText`, `Canvas`, `CanvasText`).
- Keep focus indicators visible with `:focus-visible` and a clear outline offset.
- Avoid relying on translucent backgrounds or color-only meaning for state. Pair color with a border, label, icon, or text.
- Add a forced-colors-safe class such as `.fc-badge` or `.fc-toggle` to control surfaces that need explicit contrast.
- Verify the component in Windows High Contrast mode or Playwright's forced-colors emulation before merging.

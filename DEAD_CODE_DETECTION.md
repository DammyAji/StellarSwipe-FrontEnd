# Dead Code & Unused Export Detection (Knip)

We use [Knip](https://github.com/webpro/knip) to automatically find unused files, exports, and dependencies across our application codebase. This checks for dead code on every Pull Request (PR) in CI to ensure our bundle remains lightweight.

## Configuration File

The tool configuration is located in [knip.json](file:///home/nusrat/Desktop/tawfiqa/StellarSwipe-FrontEnd/knip.json). It is configured to scan the following directories:
- `app/`
- `components/`
- `hooks/`
- `lib/`
- `services/`
- `store/`
- `src/`

## Running Knip Locally

To run the dead-code analysis locally:

```bash
npm run knip
```

## Handling False Positives

If Knip flags an export or file that is intentionally exported (e.g. for future consumption, testing purposes, or standard public API exports), you can exclude it by adding it to the `ignoreExports` or `ignore` array in `knip.json`.

Example of ignoring exports in `knip.json`:

```json
{
  "ignoreExports": [
    "store/useDemoModeStore.ts:toggleDemoMode",
    "store/usePerformanceMonitoringStore.ts:trimArray"
  ]
}
```

If a file should be ignored from dead-code scans entirely, add its glob pattern to the `ignore` array.

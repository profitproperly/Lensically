# Lensically Threads Saver

Unpacked Chrome extension for saving a Threads post into a Lensically-compatible patterns endpoint.

Current expected import route:

- `POST {workerUrl}/api/patterns/import`

This repo does not currently ship that backend route. The extension is recreated here so the capture/extraction layer is preserved and can be wired to a Lensically endpoint when ready.

## Install

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select this folder:
   - `C:\Auto-Threads\lensically\tools\threads-save-extension`

## Use

1. Open a single Threads post page
2. Click the extension icon
3. Set Worker URL and App User ID
4. Click Save Current Post

The extension can also show like-threshold labels across Threads pages.

## Files

- `manifest.json` defines the extension
- `popup.*` handles settings and manual save
- `content.js` extracts the current Threads post and injects labels/save UI

## Notes

- Metric extraction is heuristic and depends on current Threads DOM structure.
- The extension works as an unpacked developer extension; there is no separate build step.
- A successful save still requires a backend that accepts the imported payload.

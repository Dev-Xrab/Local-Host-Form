# Support QR drop folder

Put the GCash QR image here, named exactly:

```
gcash-qr.png
```

Vite copies everything in `public/` into `dist/` unchanged, so this file is served at
`/support/gcash-qr.png`. The "Support the project" button in the footer (see
`src/components/Support/SupportModal.jsx`) opens a modal that references that exact path —
so replacing the file here and pushing/deploying is the only step needed to update it. No
component needs to change.

Use the image as provided — do not crop, redraw, or otherwise alter it, since that can
interfere with the QR code scanning correctly.

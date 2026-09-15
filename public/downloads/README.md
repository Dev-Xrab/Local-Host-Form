# Windows installer drop folder

Put the built installer here, named exactly:

```
Self-Host-Form-Setup.exe
```

Vite copies everything in `public/` into `dist/` unchanged, so this file is
served at `/downloads/Self-Host-Form-Setup.exe` on the live site. The
"Download for Windows" buttons (see `WINDOWS_DOWNLOAD_URL` in
`src/constants.js`) always point at that path — so replacing the file here
and pushing/deploying is the only step needed to ship a new build. No
component or link needs to change.

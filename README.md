# LocalForm

A self-hosted, LAN-based form platform for creating, managing, and sharing forms without relying on cloud services.

LocalForm is designed for environments where forms need to run on a local network. A host computer runs the server, while other users can access the forms through a web browser using the host's local network address.

## Features

* Self-hosted and LAN-based
* Create and manage forms
* Share forms with users on the same network
* No external cloud server required
* Local data processing and storage
* Teacher/admin-oriented form management
* Session-based form access
* Real-time session control
* Cross-platform desktop distribution planned for Windows and macOS

## How It Works

```text
             Host Computer
                  │
          ┌───────▼───────┐
          │   LocalForm   │
          │    Server     │
          └───────┬───────┘
                  │
          Local Network / Wi-Fi
          ┌───────┼────────┐
          │       │        │
          ▼       ▼        ▼
       Student  Student  Student
        Device   Device   Device
          `
Then start the production server:
```
```bash
npm start
```
The desktop application is intended to:

1. Start the LocalForm server automatically.
2. Wait until the server is ready.
3. Open the LocalForm interface.
4. Display the LAN address that users can access.
5. Shut down the local server when the application closes.


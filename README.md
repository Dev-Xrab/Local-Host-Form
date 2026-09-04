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
```

The host computer runs the LocalForm server. Users connected to the same local network can access the application through their browser.

## Getting Started

### Requirements

* Node.js
* npm
* A local network/Wi-Fi connection

### Installation

Clone the repository:

```bash
git clone https://github.com/your-username/localform.git
cd localform
```

Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

To make the application accessible to other devices on the same network:

```bash
npm run dev -- --host
```

The terminal will provide the local network address, for example:

```text
http://192.168.1.14:5173
```

Other devices connected to the same network can open that address in their browser.

## Production

Build the application:

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

The production setup is intended to allow the host computer to run LocalForm without requiring users to manually configure the development environment.

## Project Structure

```text
localform/
├── src/
│   ├── components/
│   ├── pages/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   └── ...
├── public/
├── server/
├── electron/
├── package.json
└── README.md
```

The exact structure may change as the project develops.

## Self-Hosted Architecture

LocalForm follows a self-hosted architecture:

```text
Frontend
   │
   ▼
Local Server
   │
   ├── Form Management
   ├── Session Management
   ├── User Responses
   └── Data Storage
```

The host machine acts as the server while connected devices act as clients.

This makes LocalForm suitable for environments where internet access is limited, unreliable, or intentionally avoided.

## Desktop Application

The project is intended to support standalone desktop distribution.

Target platforms:

* Windows — `.exe` / installer
* macOS — `.app` / `.dmg`

The desktop application is intended to:

1. Start the LocalForm server automatically.
2. Wait until the server is ready.
3. Open the LocalForm interface.
4. Display the LAN address that users can access.
5. Shut down the local server when the application closes.

This removes the need for users to manually run Node.js commands.

## Security Considerations

LocalForm is designed primarily for trusted local networks.

Because the application exposes a server to other devices on the LAN, deployments should consider:

* Authentication and authorisation
* Input validation
* Session access control
* Network exposure
* Firewall configuration
* Protection of stored responses
* Secure handling of administrative functions

Do not expose the development server directly to the public internet.

## Development

This project is currently under active development.

The primary goals are:

* Keep the architecture modular and maintainable.
* Minimise unnecessary dependencies.
* Separate frontend, server, and business logic.
* Provide a simple self-hosting experience.
* Support reliable offline/LAN operation.
* Eventually provide standalone desktop installers.

## Roadmap

* [x] Local development server
* [x] LAN-based access
* [x] Form management
* [x] Session-based forms
* [ ] Production server packaging
* [ ] Automatic server startup
* [ ] Windows installer
* [ ] macOS application
* [ ] Automatic LAN address detection
* [ ] QR-code access
* [ ] Improved authentication and access control
* [ ] Automated cross-platform releases

## Contributing

Contributions, bug reports, and suggestions are welcome.

Before submitting changes, make sure that:

* Existing functionality still works.
* New functionality is tested.
* Code is kept modular.
* Dependencies are justified.
* Changes are documented when necessary.

## License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

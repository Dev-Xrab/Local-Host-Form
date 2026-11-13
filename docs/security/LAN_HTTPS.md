# LAN HTTPS for the desktop or Node host

Self-Host Form can serve classroom devices over HTTPS while keeping its Electron window and optional tunnel on a loopback-only HTTP port. This mode requires a certificate that students' devices trust and whose subject alternative names cover the address in the share link. A self-signed certificate that users click through does not reliably authenticate the host.

Set these environment variables before starting the desktop app or `npm start`:

```text
SHF_TLS_CERT=<absolute path to PEM certificate chain>
SHF_TLS_KEY=<absolute path to PEM private key>
SHF_HTTPS_PORT=5443
```

`SHF_HTTPS_PORT` defaults to 5443. The certificate and key must be a matching pair. Protect the key with OS file permissions and keep it out of the repository. Open the HTTPS port in the host firewall for the classroom network; do not expose the plaintext `PORT` (default 5174). When TLS is configured, that plaintext listener binds only to `127.0.0.1`. The dashboard's share link and QR code then use HTTPS and the configured port. Host cookies sent over HTTPS carry the `Secure` attribute.

Distribute trust for a private classroom CA through managed devices, or use a certificate issued for a hostname the devices can resolve. Verify the exact URL on a student device before using real assessments. If no certificate is configured, the original HTTP LAN mode remains available and retains its network-observation risk. The phone-host runtime uses its own TCP server and does not support this Node TLS mode.

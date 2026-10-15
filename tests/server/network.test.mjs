// Run with `npm run test:drive`. Password recovery and first-time setup are only offered on the host
// computer; this checks what "the host computer" means.
import test from "node:test";
import assert from "node:assert/strict";
import { networkInterfaces } from "node:os";
import { isLocalConsole } from "../../server/security/network.js";

const req = (remoteAddress, headers = {}) => ({ socket: { remoteAddress }, headers });
const ownIpv4 = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === "IPv4" && !i.internal)?.address;

test("loopback is the host computer", () => {
  assert.equal(isLocalConsole(req("127.0.0.1")), true);
  assert.equal(isLocalConsole(req("::1")), true);
  assert.equal(isLocalConsole(req("::ffff:127.0.0.1")), true);
});

test("the machine's own network address is the host computer too", { skip: !ownIpv4 && "no network adapter on this machine" }, () => {
  // what happens when the host opens the address the dashboard shows (192.168.x.x) on the host itself
  assert.equal(isLocalConsole(req(ownIpv4)), true);
  assert.equal(isLocalConsole(req(`::ffff:${ownIpv4}`)), true);
});

test("another device on the network is not the host computer", () => {
  assert.equal(isLocalConsole(req("192.168.254.77")), false);
  assert.equal(isLocalConsole(req("10.0.0.5")), false);
  assert.equal(isLocalConsole(req("8.8.8.8")), false);
  assert.equal(isLocalConsole(req(undefined)), false);
});

test("traffic through the public Remote Access link is never the host computer", () => {
  // cloudflared connects from loopback, so the Cloudflare headers are what give it away
  assert.equal(isLocalConsole(req("127.0.0.1", { "cf-connecting-ip": "203.0.113.9" })), false);
  assert.equal(isLocalConsole(req("127.0.0.1", { "cf-ray": "abc" })), false);
  if (ownIpv4) assert.equal(isLocalConsole(req(ownIpv4, { "cdn-loop": "cloudflare" })), false);
});

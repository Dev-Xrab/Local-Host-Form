// `import express, { Router } from "express"` inside server/ resolves here on the phone.
import express, { Router, json } from "../http/miniExpress.js";
export default express;
export { Router, json };

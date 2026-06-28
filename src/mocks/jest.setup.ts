import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

const fetchPolyfill = require("node-fetch");

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  fetch: fetchPolyfill.default ?? fetchPolyfill,
  Headers: fetchPolyfill.Headers,
  Request: fetchPolyfill.Request,
  Response: fetchPolyfill.Response,
});

let server:
  | {
      listen: (options: { onUnhandledRequest: "warn" }) => void;
      resetHandlers: () => void;
      close: () => void;
    }
  | null = null;

try {
  server = require("./server").server;
} catch {
  server = null;
}

beforeAll(() => server?.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server?.resetHandlers());
afterAll(() => server?.close());

"use strict";

const http = require("http");

module.exports = class ServerlessRequest extends http.IncomingMessage {
  constructor({ method, url, headers, body, remoteAddress }) {
    // Call super with readable: true, as we intend to be a readable stream
    super({
      encrypted: true,
      readable: true, // Explicitly set to true
      remoteAddress,
      address: () => ({ port: 443 }),
      end: Function.prototype,
      destroy: Function.prototype,
    });

    if (typeof headers["content-length"] === "undefined") {
      headers["content-length"] = Buffer.byteLength(body);
    }

    Object.assign(this, {
      ip: remoteAddress,
      complete: false, // Mark as false initially, body-parser will make it true
      httpVersion: "1.1",
      httpVersionMajor: "1",
      httpVersionMinor: "1",
      method,
      headers,
      url,
      _bodyBuffer: Buffer.from(body || ""), // Store body as a Buffer for consistent streaming
    });

    this._bodyRead = false; // Internal flag to track if body has been pushed

    // Important: Override _read to push the body.
    // This is called by the stream internals when data is requested.
    this._read = () => {
      if (!this._bodyRead) {
        // Defer pushing the body to the next tick of the event loop.
        // This gives any event listeners (like body-parser's) a chance to be set up.
        process.nextTick(() => {
          this.push(this._bodyBuffer); // Push the entire body as a single chunk
          this.push(null); // Signal the end of the stream
          this._bodyRead = true; // Mark as read
        });
      }
    };
  }
};

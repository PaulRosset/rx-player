#!/usr/bin/env node
/* eslint-env node */

/**
 * Run the standalone demo server
 * ==============================
 *
 * This script allows to build the standalone demo locally and start both an
 * HTTP and an HTTPS (only if a certificate and key have been generated) server
 * to serve it, on the port 8001 and 8444 respectively.
 *
 * You can run it as a script through `node run_standalone_demo.js`.
 * Be aware that this demo will be built again every time one of the library
 * file is updated.
 */

const express = require("express");
const fs = require("fs");
const { promisify } = require("util");
const https = require("https");
const getHumanReadableHours = require("./get_human_readable_hours");

module.exports = function launchStaticServer(path, config) {
  const app = express();
  app.use(express.static(path));

  app.listen(config.httpPort, (err) => {
    if (err) {
      /* eslint-disable no-console */
      console.error(`\x1b[31m[${getHumanReadableHours()}]\x1b[0m ` +
                    "Could not start HTTP server:",
                    err);
      /* eslint-enable no-console */
      return;
    }
    /* eslint-disable no-console */
    console.log(`[${getHumanReadableHours()}] ` +
                `Listening HTTP at http://localhost:${config.httpPort}`);
    /* eslint-enable no-console */
  });

  Promise.all([
    promisify(fs.readFile)(config.certificatePath),
    promisify(fs.readFile)(config.keyPath),
  ]).then(([pubFile, privFile]) => {
    if (pubFile != null && privFile != null) {
      https.createServer({
        key: privFile,
        cert: pubFile,
      }, app).listen(config.httpsPort, (err) => {
        if (err) {
          /* eslint-disable no-console */
          console.error(`\x1b[31m[${getHumanReadableHours()}]\x1b[0m ` +
                        "Could not start HTTPS server:",
                        err);
          /* eslint-enable no-console */
          return;
        }
        /* eslint-disable no-console */
        console.log(`[${getHumanReadableHours()}] ` +
                    `Listening HTTPS at https://localhost:${config.httpsPort}`);
        /* eslint-enable no-console */
      });
    }
  }, (err) => {
    if (err.code === "ENOENT") {
      /* eslint-disable no-console */
      console.warn(`[${getHumanReadableHours()}] ` +
                   "Not launching the demo in HTTPS: certificate not generated.\n" +
                   "You can run `npm run certificate` to generate a certificate.");
      /* eslint-enable no-console */
    } else {
      /* eslint-disable no-console */
      console.error(`\x1b[31m[${getHumanReadableHours()}]\x1b[0m ` +
                    "Could not readt keys and certificate:",
                    err);
      /* eslint-enable no-console */
    }
  });
};

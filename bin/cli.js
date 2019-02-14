#!/usr/bin/env node

var fetch = require('node-fetch');
var Request = fetch.Request;
var Response = fetch.Response;
var Headers = fetch.Headers;
var URL = require('url').URL;
var util = require('util');
var TextEncoder = util.TextEncoder;
var TextDecoder = util.TextDecoder;
var btoa = require('btoa');
var atob = require('atob');
var Crypto = require('node-webcrypto-ossl');

var sandbox = {
    fetch, Request, Response, Headers, URL,
    TextEncoder, TextDecoder, btoa, atob,
    crypto: new Crypto(),
    console, // share console with sandbox
    addEventListener: (event, listener) => { eventListener = listener }
}


if (process.argv.length <= 2) {
    throw new Error('worker script path missing');
}
var fs = require('fs');
var worker = fs.readFileSync(process.argv[2], 'utf8');
var eventListener;
var vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(worker, sandbox);

var http = require('http')
var port = 3000
var server = http.createServer(handler);
server.on('listening', () => console.log(`Cloudflare Workers Sandbox: ready on port ${port}`));
server.listen(port);

function handler(req, res) {

    let request = new fetch.Request(
        `http://${req.headers.host}${req.url}`, {
            headers: req.headers,
            method: req.method,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req : null
        }
    );

    async function respondWith(responsePromise) {
        const workerResponse = await responsePromise;
        res.statusCode = workerResponse.status;
        res.statusMessage = workerResponse.statusText;
        for (const header of workerResponse.headers) {
            res.setHeader(header[0], header[1]);
        }
        res.removeHeader('content-encoding');
        res.removeHeader('content-length');
        res.end(await workerResponse.buffer());
    }

    async function waitUntil(somePromise) {
        await somePromise;
    }

    async function passThroughOnException() {
        // do nothing
    }

    const event = { request, respondWith, waitUntil, passThroughOnException };

    eventListener(event);
}

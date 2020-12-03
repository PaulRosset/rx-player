/*
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { Observable, } from "rxjs";
import config from "../../config";
import { NetworkErrorTypes, RequestError, } from "../../errors";
import log from "../../log";
import isNullOrUndefined from "../is_null_or_undefined";
var DEFAULT_REQUEST_TIMEOUT = config.DEFAULT_REQUEST_TIMEOUT;
var _Headers = typeof Headers === "function" ? Headers :
    null;
var _AbortController = typeof AbortController === "function" ?
    AbortController :
    null;
function fetchRequest(options) {
    var headers;
    if (!isNullOrUndefined(options.headers)) {
        if (isNullOrUndefined(_Headers)) {
            headers = options.headers;
        }
        else {
            headers = new _Headers();
            var headerNames = Object.keys(options.headers);
            for (var i = 0; i < headerNames.length; i++) {
                var headerName = headerNames[i];
                headers.append(headerName, options.headers[headerName]);
            }
        }
    }
    return new Observable(function (obs) {
        log.debug("Fetch: Called with URL", options.url);
        var hasAborted = false;
        var timeouted = false;
        var isDone = false;
        var sendingTime = performance.now();
        var abortController = !isNullOrUndefined(_AbortController) ? new _AbortController() :
            null;
        /**
         * Abort current fetchRequest by triggering AbortController signal.
         * @returns {void}
         */
        function abortRequest() {
            if (!isDone) {
                if (!isNullOrUndefined(abortController)) {
                    return abortController.abort();
                }
                log.warn("Fetch: AbortController API not available.");
            }
        }
        var requestTimeout = isNullOrUndefined(options.timeout) ?
            DEFAULT_REQUEST_TIMEOUT :
            options.timeout;
        var timeout = window.setTimeout(function () {
            timeouted = true;
            abortRequest();
        }, requestTimeout);
        fetch(options.url, { headers: headers, method: "GET",
            signal: !isNullOrUndefined(abortController) ? abortController.signal :
                undefined }).then(function (response) {
            if (!isNullOrUndefined(timeout)) {
                clearTimeout(timeout);
            }
            if (response.status >= 300) {
                log.warn("Fetch: Request HTTP Error", response);
                obs.error(new RequestError(response.url, response.status, NetworkErrorTypes.ERROR_HTTP_CODE));
                return undefined;
            }
            if (isNullOrUndefined(response.body)) {
                obs.error(new RequestError(response.url, response.status, NetworkErrorTypes.PARSE_ERROR));
                return undefined;
            }
            var contentLengthHeader = response.headers.get("Content-Length");
            var contentLength = !isNullOrUndefined(contentLengthHeader) &&
                !isNaN(+contentLengthHeader) ? +contentLengthHeader :
                undefined;
            var reader = response.body.getReader();
            var size = 0;
            return readBufferAndSendEvents();
            function readBufferAndSendEvents() {
                return __awaiter(this, void 0, void 0, function () {
                    var data, currentTime, dataChunk, receivedTime, duration;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, reader.read()];
                            case 1:
                                data = _a.sent();
                                if (!data.done && !isNullOrUndefined(data.value)) {
                                    size += data.value.byteLength;
                                    currentTime = performance.now();
                                    dataChunk = { type: "data-chunk",
                                        value: { url: response.url, currentTime: currentTime, duration: currentTime - sendingTime, sendingTime: sendingTime, chunkSize: data.value.byteLength,
                                            chunk: data.value.buffer, size: size, totalSize: contentLength } };
                                    obs.next(dataChunk);
                                    return [2 /*return*/, readBufferAndSendEvents()];
                                }
                                else if (data.done) {
                                    receivedTime = performance.now();
                                    duration = receivedTime - sendingTime;
                                    isDone = true;
                                    obs.next({ type: "data-complete",
                                        value: { duration: duration,
                                            receivedTime: receivedTime,
                                            sendingTime: sendingTime,
                                            size: size, status: response.status,
                                            url: response.url } });
                                    obs.complete();
                                }
                                return [2 /*return*/];
                        }
                    });
                });
            }
        }).catch(function (err) {
            if (hasAborted) {
                log.debug("Fetch: Request aborted.");
                return;
            }
            if (timeouted) {
                log.warn("Fetch: Request timeouted.");
                obs.error(new RequestError(options.url, 0, NetworkErrorTypes.TIMEOUT));
                return;
            }
            log.warn("Fetch: Request Error", err instanceof Error ?
                err.toString() :
                "");
            obs.error(new RequestError(options.url, 0, NetworkErrorTypes.ERROR_EVENT));
            return;
        });
        return function () {
            hasAborted = true;
            abortRequest();
        };
    });
}
/**
 * Returns true if fetch should be supported in the current browser.
 * @return {boolean}
 */
export function fetchIsSupported() {
    return (typeof window.fetch === "function" &&
        !isNullOrUndefined(_AbortController) &&
        !isNullOrUndefined(_Headers));
}
export default fetchRequest;

/**
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
import { merge as observableMerge, of as observableOf, Subject, } from "rxjs";
import { catchError, finalize, map, mergeMap, } from "rxjs/operators";
import { formatError, } from "../../../errors";
import tryCatch$ from "../../../utils/rx-try_catch";
import createRequestScheduler from "../utils/create_request_scheduler";
import errorSelector from "../utils/error_selector";
import { tryRequestObservableWithBackoff, } from "../utils/try_urls_with_backoff";
import getManifestBackoffOptions from "./get_manifest_backoff_options";
/**
 * Class allowing to facilitate the task of loading and parsing a Manifest.
 * @class ManifestFetcher
 * @example
 * ```js
 * const manifestFetcher = new ManifestFetcher(manifestUrl, pipelines, options);
 * manifestFetcher.fetch().pipe(
 *   // Filter only responses (might also receive warning events)
 *   filter((evt) => evt.type === "response");
 *   // Parse the Manifest
 *   mergeMap(res => res.parse({ externalClockOffset }))
 *   // (again)
 *   filter((evt) => evt.type === "parsed");
 * ).subscribe(({ value }) => {
 *   console.log("Manifest:", value.manifest);
 * });
 * ```
 */
var ManifestFetcher = /** @class */ (function () {
    /**
     * @param {string | undefined} url
     * @param {Object} pipelines
     * @param {Object} backoffOptions
     */
    function ManifestFetcher(url, pipelines, backoffOptions) {
        this._manifestUrl = url;
        this._pipelines = pipelines.manifest;
        this._backoffOptions = getManifestBackoffOptions(backoffOptions);
    }
    /**
     * (re-)Load the Manifest without yet parsing it.
     *
     * You can set an `url` on which that Manifest will be requested.
     * If not set, the regular Manifest url - defined on the
     * `ManifestFetcher` instanciation - will be used instead.
     * @param {string} [url]
     * @returns {Observable}
     */
    ManifestFetcher.prototype.fetch = function (url) {
        var _this = this;
        var _a;
        var requestUrl = url !== null && url !== void 0 ? url : this._manifestUrl;
        // TODO Remove the resolver completely in the next major version
        var resolver = (_a = this._pipelines.resolver) !== null && _a !== void 0 ? _a : 
        // TODO Wrong implem seems to be considered by the linter here.
        // Is this a tslint bug?
        /* tslint:disable deprecation */
        observableOf;
        /* tslint:enable deprecation */
        var loader = this._pipelines.loader;
        return tryCatch$(resolver, { url: requestUrl }).pipe(catchError(function (error) {
            throw errorSelector(error);
        }), mergeMap(function (loaderArgument) {
            var loader$ = tryCatch$(loader, loaderArgument);
            return tryRequestObservableWithBackoff(loader$, _this._backoffOptions).pipe(catchError(function (error) {
                throw errorSelector(error);
            }), map(function (evt) {
                return evt.type === "retry" ?
                    ({ type: "warning", value: errorSelector(evt.value) }) :
                    ({ type: "response",
                        parse: function (parserOptions) {
                            return _this._parseLoadedManifest(evt.value.value, parserOptions);
                        } });
            }));
        }));
    };
    /**
     * Parse an already loaded Manifest.
     *
     * This method should be reserved for Manifests for which no request has been
     * done.
     * In other cases, it's preferable to go through the `fetch` method, so
     * information on the request can be used by the parsing process.
     * @param {*} manifest
     * @param {Object} parserOptions
     * @returns {Observable}
     */
    ManifestFetcher.prototype.parse = function (manifest, parserOptions) {
        return this._parseLoadedManifest({ responseData: manifest,
            size: undefined,
            duration: undefined }, parserOptions);
    };
    /**
     * Parse a Manifest.
     *
     * @param {Object} loaded - Information about the loaded Manifest as well as
     * about the corresponding request.
     * @param {Object} parserOptions - Options used when parsing the Manifest.
     * @returns {Observable}
     */
    ManifestFetcher.prototype._parseLoadedManifest = function (loaded, parserOptions) {
        var sendingTime = loaded.sendingTime, receivedTime = loaded.receivedTime;
        var parsingTimeStart = performance.now();
        var schedulerWarnings$ = new Subject();
        var scheduleRequest = createRequestScheduler(this._backoffOptions, schedulerWarnings$);
        return observableMerge(schedulerWarnings$
            .pipe(map(function (err) { return ({ type: "warning", value: err }); })), this._pipelines.parser({ response: loaded,
            url: this._manifestUrl,
            externalClockOffset: parserOptions.externalClockOffset,
            previousManifest: parserOptions.previousManifest, scheduleRequest: scheduleRequest, unsafeMode: parserOptions.unsafeMode, }).pipe(catchError(function (error) {
            throw formatError(error, {
                defaultCode: "PIPELINE_PARSE_ERROR",
                defaultReason: "Unknown error when parsing the Manifest",
            });
        }), map(function (parsingEvt) {
            if (parsingEvt.type === "warning") {
                var formatted = formatError(parsingEvt.value, {
                    defaultCode: "PIPELINE_PARSE_ERROR",
                    defaultReason: "Unknown error when parsing the Manifest",
                });
                return { type: "warning", value: formatted };
            }
            // 2 - send response
            var parsingTime = performance.now() - parsingTimeStart;
            return { type: "parsed", manifest: parsingEvt.value.manifest, sendingTime: sendingTime,
                receivedTime: receivedTime,
                parsingTime: parsingTime };
        }), finalize(function () { schedulerWarnings$.complete(); })));
    };
    return ManifestFetcher;
}());
export default ManifestFetcher;

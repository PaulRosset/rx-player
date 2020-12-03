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
import { concat as observableConcat, EMPTY, of as observableOf, } from "rxjs";
import { catchError, map, mergeMap, } from "rxjs/operators";
import assertUnreachable from "../../../utils/assert_unreachable";
import castToObservable from "../../../utils/cast_to_observable";
import objectAssign from "../../../utils/object_assign";
import tryCatch from "../../../utils/rx-try_catch";
import errorSelector from "../utils/error_selector";
import tryURLsWithBackoff from "../utils/try_urls_with_backoff";
/**
 * Returns a function allowing to load any wanted segment.
 *
 * The function returned takes in argument information about the wanted segment
 * and returns an Observable which will emit various events related to the
 * segment request (see ISegmentLoaderEvent).
 *
 * This observable will throw if, following the options given, the request and
 * possible retry all failed.
 *
 * This observable will complete after emitting all the segment's data.
 *
 * Type parameters:
 *   - T: type of the data emitted
 *
 * @param {Function} loader
 * @param {Object | undefined} cache
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentLoader(loader, cache, backoffOptions) {
    /**
     * Try to retrieve the segment from the cache and if not found call the
     * pipeline's loader (with possible retries) to load it.
     * @param {Object} loaderArgument - Context for the wanted segment.
     * @returns {Observable}
     */
    function loadData(wantedContent) {
        /**
         * Call the Pipeline's loader with an exponential Backoff.
         * @returns {Observable}
         */
        function startLoaderWithBackoff() {
            var _a;
            var request$ = function (url) {
                var loaderArgument = objectAssign({ url: url }, wantedContent);
                return observableConcat(observableOf({ type: "request", value: loaderArgument }), tryCatch(loader, loaderArgument));
            };
            return tryURLsWithBackoff((_a = wantedContent.segment.mediaURLs) !== null && _a !== void 0 ? _a : [null], request$, backoffOptions).pipe(catchError(function (error) {
                throw errorSelector(error);
            }), map(function (evt) {
                if (evt.type === "retry") {
                    return { type: "warning", value: errorSelector(evt.value) };
                }
                else if (evt.value.type === "request") {
                    return evt.value;
                }
                var response = evt.value;
                if (response.type === "data-loaded" && cache != null) {
                    cache.add(wantedContent, response.value);
                }
                return evt.value;
            }));
        }
        var dataFromCache = cache != null ? cache.get(wantedContent) :
            null;
        if (dataFromCache != null) {
            return castToObservable(dataFromCache).pipe(map(function (response) { return ({ type: "cache", value: response }); }), catchError(startLoaderWithBackoff));
        }
        return startLoaderWithBackoff();
    }
    /**
     * Load the corresponding segment.
     * @param {Object} content
     * @returns {Observable}
     */
    return function loadSegment(content) {
        return loadData(content).pipe(mergeMap(function (arg) {
            var metrics$;
            if ((arg.type === "data-chunk-complete" || arg.type === "data-loaded") &&
                arg.value.size !== undefined && arg.value.duration !== undefined) {
                metrics$ = observableOf({ type: "metrics", value: { size: arg.value.size,
                        duration: arg.value.duration, content: content } });
            }
            else {
                metrics$ = EMPTY;
            }
            switch (arg.type) {
                case "warning":
                case "request":
                case "progress":
                    return observableOf(arg);
                case "cache":
                case "data-created":
                case "data-loaded":
                    return observableConcat(observableOf({ type: "data", value: arg.value }), metrics$);
                case "data-chunk":
                    return observableOf({ type: "chunk", value: arg.value });
                case "data-chunk-complete":
                    return observableConcat(observableOf({ type: "chunk-complete", value: null }), metrics$);
                default:
                    assertUnreachable(arg);
            }
        }));
    };
}

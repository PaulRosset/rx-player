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
import { concat as observableConcat, of as observableOf, } from "rxjs";
import { catchError, filter, finalize, mergeMap, share, tap, } from "rxjs/operators";
import { formatError } from "../../../errors";
import arrayIncludes from "../../../utils/array_includes";
import assertUnreachable from "../../../utils/assert_unreachable";
import idGenerator from "../../../utils/id_generator";
import InitializationSegmentCache from "../../../utils/initialization_segment_cache";
import createSegmentLoader from "./create_segment_loader";
var generateRequestID = idGenerator();
/**
 * Create a function which will fetch and parse segments.
 * @param {string} bufferType
 * @param {Object} transport
 * @param {Subject} requests$
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher(bufferType, transport, requests$, options) {
    var cache = arrayIncludes(["audio", "video"], bufferType) ?
        new InitializationSegmentCache() :
        undefined;
    var segmentLoader = createSegmentLoader(transport[bufferType].loader, cache, options);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    var segmentParser = transport[bufferType].parser; // deal with it
    /**
     * Process the segmentLoader observable to adapt it to the the rest of the
     * code:
     *   - use the requests subject for network requests and their progress
     *   - use the warning$ subject for retries' error messages
     *   - only emit the data
     * @param {Object} content
     * @returns {Observable}
     */
    return function fetchSegment(content) {
        var id = generateRequestID();
        var requestBeginSent = false;
        return segmentLoader(content).pipe(tap(function (arg) {
            switch (arg.type) {
                case "metrics": {
                    requests$.next(arg);
                    break;
                }
                case "request": {
                    var value = arg.value;
                    // format it for ABR Handling
                    var segment = value.segment;
                    if (segment === undefined) {
                        return;
                    }
                    requestBeginSent = true;
                    requests$.next({ type: "requestBegin", value: { duration: segment.duration,
                            time: segment.time,
                            requestTimestamp: performance.now(), id: id } });
                    break;
                }
                case "progress": {
                    var value = arg.value;
                    if (value.totalSize != null && value.size < value.totalSize) {
                        requests$.next({ type: "progress", value: { duration: value.duration,
                                size: value.size,
                                totalSize: value.totalSize,
                                timestamp: performance.now(), id: id } });
                    }
                    break;
                }
            }
        }), finalize(function () {
            if (requestBeginSent) {
                requests$.next({ type: "requestEnd", value: { id: id } });
            }
        }), filter(function (e) {
            switch (e.type) {
                case "warning":
                case "chunk":
                case "chunk-complete":
                case "data":
                    return true;
                case "progress":
                case "metrics":
                case "request":
                    return false;
                default:
                    assertUnreachable(e);
            }
        }), mergeMap(function (evt) {
            if (evt.type === "warning") {
                return observableOf(evt);
            }
            if (evt.type === "chunk-complete") {
                return observableOf({ type: "chunk-complete" });
            }
            var isChunked = evt.type === "chunk";
            var data = {
                type: "chunk",
                /**
                 * Parse the loaded data.
                 * @param {Object} [initTimescale]
                 * @returns {Observable}
                 */
                parse: function (initTimescale) {
                    var response = { data: evt.value.responseData, isChunked: isChunked };
                    /* eslint-disable @typescript-eslint/no-unsafe-call */
                    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                    /* eslint-disable @typescript-eslint/no-unsafe-return */
                    return segmentParser({ response: response, initTimescale: initTimescale, content: content })
                        /* eslint-enable @typescript-eslint/no-unsafe-call */
                        /* eslint-enable @typescript-eslint/no-unsafe-member-access */
                        /* eslint-enable @typescript-eslint/no-unsafe-return */
                        .pipe(catchError(function (error) {
                        throw formatError(error, { defaultCode: "PIPELINE_PARSE_ERROR",
                            defaultReason: "Unknown parsing error" });
                    }));
                },
            };
            if (isChunked) {
                return observableOf(data);
            }
            return observableConcat(observableOf(data), observableOf({ type: "chunk-complete" }));
        }), share() // avoid multiple side effects if multiple subs
        );
    };
}

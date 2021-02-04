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
import { throwError } from "rxjs";
import { map } from "rxjs/operators";
import isNonEmptyString from "../../../utils/is_non_empty_string";
import request from "../../../utils/request/xhr";
var iso8601Duration = /^P(([\d.]*)Y)?(([\d.]*)M)?(([\d.]*)D)?T?(([\d.]*)H)?(([\d.]*)M)?(([\d.]*)S)?/;
/**
 * Parse MPD ISO8601 duration attributes into seconds.
 *
 * The returned value is a tuple of two elements where:
 *   1. the first value is the parsed value - or `null` if we could not parse
 *      it
 *   2. the second value is a possible error encountered while parsing this
 *      value - set to `null` if no error was encountered.
 * @param {string} val - The value to parse
 * @param {string} displayName - The name of the property. Used for error
 * formatting.
 * @returns {Array.<number | Error | null>}
 */
function parseDuration(val) {
    if (!isNonEmptyString(val)) {
        return null;
    }
    var match = iso8601Duration.exec(val);
    if (match === null) {
        return null;
    }
    var duration = (parseFloat(isNonEmptyString(match[2]) ? match[2] :
        "0") * 365 * 24 * 60 * 60 +
        parseFloat(isNonEmptyString(match[4]) ? match[4] :
            "0") * 30 * 24 * 60 * 60 +
        parseFloat(isNonEmptyString(match[6]) ? match[6] :
            "0") * 24 * 60 * 60 +
        parseFloat(isNonEmptyString(match[8]) ? match[8] :
            "0") * 60 * 60 +
        parseFloat(isNonEmptyString(match[10]) ? match[10] :
            "0") * 60 +
        parseFloat(isNonEmptyString(match[12]) ? match[12] :
            "0"));
    return duration;
}
/**
 * Load manifest and get duration from it.
 * @param {String} url
 * @param {String} transport
 * @returns {Observable<number>}
 */
function getDurationFromManifest(url, transport) {
    if (transport !== "dash" &&
        transport !== "smooth" &&
        transport !== "metaplaylist") {
        return throwError(new Error("createMetaplaylist: Unknown transport type."));
    }
    if (transport === "dash" || transport === "smooth") {
        return request({ url: url, responseType: "document" }).pipe(map(function (_a) {
            var _b;
            var value = _a.value;
            var responseData = value.responseData;
            var root = responseData.documentElement;
            if (transport === "dash") {
                var dashDurationAttribute = root.getAttribute("mediaPresentationDuration");
                if (dashDurationAttribute === null) {
                    throw new Error("createMetaplaylist: No duration on DASH content.");
                }
                var periodElements = root.getElementsByTagName("Period");
                var firstDASHStartAttribute = (_b = periodElements[0]) === null || _b === void 0 ? void 0 : _b.getAttribute("start");
                var firstDASHStart = firstDASHStartAttribute !== null ? parseDuration(firstDASHStartAttribute) :
                    0;
                var dashDuration = parseDuration(dashDurationAttribute);
                if (firstDASHStart === null || dashDuration === null) {
                    throw new Error("createMetaplaylist: Cannot parse " +
                        "the duration from a DASH content.");
                }
                return dashDuration - firstDASHStart;
            }
            // smooth
            var smoothDurationAttribute = root.getAttribute("Duration");
            var smoothTimeScaleAttribute = root.getAttribute("TimeScale");
            if (smoothDurationAttribute === null) {
                throw new Error("createMetaplaylist: No duration on smooth content.");
            }
            var timescale = smoothTimeScaleAttribute !== null ?
                parseInt(smoothTimeScaleAttribute, 10) :
                10000000;
            return (parseInt(smoothDurationAttribute, 10)) / timescale;
        }));
    }
    // metaplaylist
    return request({ url: url, responseType: "text" }).pipe(map(function (_a) {
        var value = _a.value;
        var responseData = value.responseData;
        var metaplaylist = JSON.parse(responseData);
        if (metaplaylist.contents === undefined ||
            metaplaylist.contents.length === undefined ||
            metaplaylist.contents.length === 0) {
            throw new Error("createMetaplaylist: No duration on Metaplaylist content.");
        }
        var contents = metaplaylist.contents;
        var lastEnd = contents[contents.length - 1].endTime;
        var firstStart = contents[0].startTime;
        return lastEnd - firstStart;
    }));
}
export default getDurationFromManifest;

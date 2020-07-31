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
import parseBaseURL from "./BaseURL";
import { createPeriodIntermediateRepresentation, } from "./Period";
import { parseDateTime, parseDuration, parseScheme, ValueParser, } from "./utils";
/**
 * Parse children of the MPD's root into a simple object.
 * @param {NodeList} mpdChildren
 * @returns {Array.<Object>}
 */
function parseMPDChildren(mpdChildren) {
    var baseURLs = [];
    var locations = [];
    var periods = [];
    var utcTimings = [];
    var warnings = [];
    for (var i = 0; i < mpdChildren.length; i++) {
        if (mpdChildren[i].nodeType === Node.ELEMENT_NODE) {
            var currentNode = mpdChildren[i];
            switch (currentNode.nodeName) {
                case "BaseURL":
                    var _a = parseBaseURL(currentNode), baseURLObj = _a[0], baseURLWarnings = _a[1];
                    if (baseURLObj !== undefined) {
                        baseURLs.push(baseURLObj);
                    }
                    warnings = warnings.concat(baseURLWarnings);
                    break;
                case "Location":
                    locations.push(currentNode.textContent === null ?
                        "" :
                        currentNode.textContent);
                    break;
                case "Period":
                    var _b = createPeriodIntermediateRepresentation(currentNode), period = _b[0], periodWarnings = _b[1];
                    periods.push(period);
                    warnings = warnings.concat(periodWarnings);
                    break;
                case "UTCTiming":
                    var utcTiming = parseScheme(currentNode);
                    utcTimings.push(utcTiming);
                    break;
            }
        }
    }
    return [{ baseURLs: baseURLs, locations: locations, periods: periods, utcTimings: utcTimings }, warnings];
}
/**
 * @param {Element} root
 * @returns {Array.<Object>}
 */
function parseMPDAttributes(root) {
    var res = {};
    var warnings = [];
    var parseValue = ValueParser(res, warnings);
    for (var i = 0; i < root.attributes.length; i++) {
        var attribute = root.attributes[i];
        switch (attribute.name) {
            case "id":
                res.id = attribute.value;
                break;
            case "profiles":
                res.profiles = attribute.value;
                break;
            case "type":
                res.type = attribute.value;
                break;
            case "availabilityStartTime":
                parseValue(attribute.value, { asKey: "availabilityStartTime",
                    parser: parseDateTime,
                    dashName: "availabilityStartTime" });
                break;
            case "availabilityEndTime":
                parseValue(attribute.value, { asKey: "availabilityEndTime",
                    parser: parseDateTime,
                    dashName: "availabilityEndTime" });
                break;
            case "publishTime":
                parseValue(attribute.value, { asKey: "publishTime",
                    parser: parseDateTime,
                    dashName: "publishTime" });
                break;
            case "mediaPresentationDuration":
                parseValue(attribute.value, { asKey: "duration",
                    parser: parseDuration,
                    dashName: "mediaPresentationDuration" });
                break;
            case "minimumUpdatePeriod":
                parseValue(attribute.value, { asKey: "minimumUpdatePeriod",
                    parser: parseDuration,
                    dashName: "minimumUpdatePeriod" });
                break;
            case "minBufferTime":
                parseValue(attribute.value, { asKey: "minBufferTime",
                    parser: parseDuration,
                    dashName: "minBufferTime" });
                break;
            case "timeShiftBufferDepth":
                parseValue(attribute.value, { asKey: "timeShiftBufferDepth",
                    parser: parseDuration,
                    dashName: "timeShiftBufferDepth" });
                break;
            case "suggestedPresentationDelay":
                parseValue(attribute.value, { asKey: "suggestedPresentationDelay",
                    parser: parseDuration,
                    dashName: "suggestedPresentationDelay" });
                break;
            case "maxSegmentDuration":
                parseValue(attribute.value, { asKey: "maxSegmentDuration",
                    parser: parseDuration,
                    dashName: "maxSegmentDuration" });
                break;
            case "maxSubsegmentDuration":
                parseValue(attribute.value, { asKey: "maxSubsegmentDuration",
                    parser: parseDuration,
                    dashName: "maxSubsegmentDuration" });
                break;
        }
    }
    return [res, warnings];
}
/**
 * @param {Element} root
 * @returns {Array.<Object>}
 */
export function createMPDIntermediateRepresentation(root) {
    var _a = parseMPDChildren(root.childNodes), children = _a[0], childrenWarnings = _a[1];
    var _b = parseMPDAttributes(root), attributes = _b[0], attrsWarnings = _b[1];
    var warnings = childrenWarnings.concat(attrsWarnings);
    return [{ children: children, attributes: attributes }, warnings];
}

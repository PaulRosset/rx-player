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
import objectAssign from "../../../../utils/object_assign";
import parseSegmentBase from "./SegmentBase";
import createSegmentTimelineParser from "./SegmentTimeline";
import { parseBoolean, parseMPDInteger, ValueParser, } from "./utils";
/**
 * Parse initialization attribute found in SegmentTemplateTemplate to
 * correspond to the initialization found in a regular segmentBase.
 * @param {string} attrValue
 * @returns {Object}
 */
function parseInitializationAttribute(attrValue) {
    return { media: attrValue };
}
/**
 * Parse a SegmentTemplate element into a SegmentTemplate intermediate
 * representation.
 * @param {Element} root - The SegmentTemplate root element.
 * @returns {Array}
 */
export default function parseSegmentTemplate(root) {
    var _a = parseSegmentBase(root), base = _a[0], segmentBaseWarnings = _a[1];
    var warnings = segmentBaseWarnings;
    var ret;
    var timelineParser;
    // First look for a possible SegmentTimeline
    for (var i = 0; i < root.childNodes.length; i++) {
        if (root.childNodes[i].nodeType === Node.ELEMENT_NODE) {
            var currentNode = root.childNodes[i];
            if (currentNode.nodeName === "SegmentTimeline") {
                timelineParser = createSegmentTimelineParser(currentNode);
            }
        }
    }
    ret = objectAssign({}, base, { duration: base.duration, timelineParser: timelineParser });
    var parseValue = ValueParser(ret, warnings);
    for (var i = 0; i < root.attributes.length; i++) {
        var attribute = root.attributes[i];
        switch (attribute.nodeName) {
            case "initialization":
                if (ret.initialization == null) {
                    ret.initialization = parseInitializationAttribute(attribute.value);
                }
                break;
            case "index":
                ret.index = attribute.value;
                break;
            case "availabilityTimeOffset":
                if (attribute.value === "INF") {
                    ret.availabilityTimeOffset = Infinity;
                }
                parseValue(attribute.value, { asKey: "availabilityTimeOffset",
                    parser: parseMPDInteger,
                    dashName: "availabilityTimeOffset" });
                break;
            case "media":
                ret.media = attribute.value;
                break;
            case "bitstreamSwitching":
                parseValue(attribute.value, { asKey: "bitstreamSwitching",
                    parser: parseBoolean,
                    dashName: "bitstreamSwitching" });
                break;
        }
    }
    return [ret, warnings];
}

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
import parseSegmentBase from "./SegmentBase";
import parseSegmentList from "./SegmentList";
import parseSegmentTemplate from "./SegmentTemplate";
import { MPDError, parseBoolean, parseMPDFloat, parseMPDInteger, ValueParser, } from "./utils";
/**
 * @param {NodeList} representationChildren
 * @returns {Object}
 */
function parseRepresentationChildren(representationChildren) {
    var children = {
        baseURLs: [],
    };
    var warnings = [];
    for (var i = 0; i < representationChildren.length; i++) {
        if (representationChildren[i].nodeType === Node.ELEMENT_NODE) {
            var currentElement = representationChildren[i];
            switch (currentElement.nodeName) {
                case "BaseURL":
                    var _a = parseBaseURL(currentElement), baseURLObj = _a[0], baseURLWarnings = _a[1];
                    if (baseURLObj !== undefined) {
                        children.baseURLs.push(baseURLObj);
                    }
                    warnings = warnings.concat(baseURLWarnings);
                    break;
                case "SegmentBase":
                    var _b = parseSegmentBase(currentElement), segmentBase = _b[0], segmentBaseWarnings = _b[1];
                    children.segmentBase = segmentBase;
                    if (segmentBaseWarnings.length > 0) {
                        warnings = warnings.concat(segmentBaseWarnings);
                    }
                    break;
                case "SegmentList":
                    var _c = parseSegmentList(currentElement), segmentList = _c[0], segmentListWarnings = _c[1];
                    warnings = warnings.concat(segmentListWarnings);
                    children.segmentList = segmentList;
                    break;
                case "SegmentTemplate":
                    var _d = parseSegmentTemplate(currentElement), segmentTemplate = _d[0], segmentTemplateWarnings = _d[1];
                    warnings = warnings.concat(segmentTemplateWarnings);
                    children.segmentTemplate = segmentTemplate;
                    break;
            }
        }
    }
    return [children, warnings];
}
/**
 * @param {Element} representationElement
 * @returns {Array}
 */
function parseRepresentationAttributes(representationElement) {
    var attributes = {};
    var warnings = [];
    var parseValue = ValueParser(attributes, warnings);
    for (var i = 0; i < representationElement.attributes.length; i++) {
        var attr = representationElement.attributes[i];
        switch (attr.name) {
            case "audioSamplingRate":
                attributes.audioSamplingRate = attr.value;
                break;
            case "bandwidth":
                parseValue(attr.value, { asKey: "bitrate",
                    parser: parseMPDInteger,
                    dashName: "bandwidth" });
                break;
            case "codecs":
                attributes.codecs = attr.value;
                break;
            case "codingDependency":
                parseValue(attr.value, { asKey: "codingDependency",
                    parser: parseBoolean,
                    dashName: "codingDependency" });
                break;
            case "frameRate":
                attributes.frameRate = attr.value;
                break;
            case "height":
                parseValue(attr.value, { asKey: "height",
                    parser: parseMPDInteger,
                    dashName: "height" });
                break;
            case "id":
                attributes.id = attr.value;
                break;
            case "maxPlayoutRate":
                parseValue(attr.value, { asKey: "maxPlayoutRate",
                    parser: parseMPDFloat,
                    dashName: "maxPlayoutRate" });
                break;
            case "maximumSAPPeriod":
                parseValue(attr.value, { asKey: "maximumSAPPeriod",
                    parser: parseMPDFloat,
                    dashName: "maximumSAPPeriod" });
                break;
            case "mimeType":
                attributes.mimeType = attr.value;
                break;
            case "profiles":
                attributes.profiles = attr.value;
                break;
            case "qualityRanking":
                parseValue(attr.value, { asKey: "qualityRanking",
                    parser: parseMPDInteger,
                    dashName: "qualityRanking" });
                break;
            case "segmentProfiles":
                attributes.segmentProfiles = attr.value;
                break;
            case "width":
                parseValue(attr.value, { asKey: "width",
                    parser: parseMPDInteger,
                    dashName: "width" });
                break;
        }
    }
    if (attributes.bitrate === undefined) {
        warnings.push(new MPDError("No bitrate found on a Representation"));
    }
    return [attributes, warnings];
}
/**
 * @param {Element} representationElement
 * @returns {Array}
 */
export function createRepresentationIntermediateRepresentation(representationElement) {
    var _a = parseRepresentationChildren(representationElement.childNodes), children = _a[0], childrenWarnings = _a[1];
    var _b = parseRepresentationAttributes(representationElement), attributes = _b[0], attrsWarnings = _b[1];
    var warnings = childrenWarnings.concat(attrsWarnings);
    return [{ children: children, attributes: attributes }, warnings];
}

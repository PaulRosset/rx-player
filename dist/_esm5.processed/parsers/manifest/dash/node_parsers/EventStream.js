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
import { parseMPDInteger, ValueParser, } from "./utils";
/**
 * Parse the EventStream node to extract Event nodes and their
 * content.
 * @param {Element} element
 */
function parseEventStream(element) {
    var _a;
    var streamEvents = [];
    var attributes = { timescale: 1 };
    var warnings = [];
    var parseValue = ValueParser(attributes, warnings);
    for (var i = 0; i < element.attributes.length; i++) {
        var attribute = element.attributes[i];
        switch (attribute.name) {
            case "schemeIdUri":
                attributes.schemeId = attribute.value;
                break;
            case "timescale":
                parseValue(attribute.value, { asKey: "timescale",
                    parser: parseMPDInteger,
                    dashName: "timescale" });
                break;
            case "value":
                attributes.value = attribute.value;
                break;
            default:
                break;
        }
    }
    for (var k = 0; k < element.childNodes.length; k++) {
        var node = element.childNodes[k];
        var streamEvent = { id: undefined,
            eventPresentationTime: 0,
            duration: undefined,
            timescale: attributes.timescale, data: { type: "dash-event-stream",
                value: { schemeIdUri: (_a = attributes.schemeId) !== null && _a !== void 0 ? _a : "", timescale: attributes.timescale, element: node }, }, };
        var parseEventValue = ValueParser(streamEvent, warnings);
        if (node.nodeName === "Event" &&
            node.nodeType === Node.ELEMENT_NODE) {
            var eventAttributes = node.attributes;
            for (var j = 0; j < eventAttributes.length; j++) {
                var attribute = eventAttributes[j];
                switch (attribute.name) {
                    case "presentationTime":
                        parseEventValue(attribute.value, { asKey: "eventPresentationTime",
                            parser: parseMPDInteger,
                            dashName: "presentationTime" });
                        break;
                    case "duration":
                        parseEventValue(attribute.value, { asKey: "duration",
                            parser: parseMPDInteger,
                            dashName: "duration" });
                        break;
                    case "id":
                        streamEvent.id = attribute.value;
                        break;
                    default:
                        break;
                }
            }
            streamEvents.push(streamEvent);
        }
    }
    return [streamEvents, warnings];
}
export default parseEventStream;

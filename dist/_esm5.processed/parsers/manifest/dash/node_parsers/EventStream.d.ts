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
export interface IParsedStreamEventData {
    type: "dash-event-stream";
    value: {
        schemeIdUri: string;
        timescale: number;
        element: Element;
    };
}
export interface IParsedStreamEvent {
    eventPresentationTime: number;
    duration?: number;
    timescale: number;
    id?: string;
    data: IParsedStreamEventData;
}
/**
 * Parse the EventStream node to extract Event nodes and their
 * content.
 * @param {Element} element
 */
declare function parseEventStream(element: Element): [IParsedStreamEvent[], Error[]];
export default parseEventStream;

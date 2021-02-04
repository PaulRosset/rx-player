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
import { IParsedInitialization } from "./Initialization";
import { IParsedSegmentBase } from "./SegmentBase";
import { ITimelineParser } from "./SegmentTimeline";
export interface IParsedSegmentTemplate extends IParsedSegmentBase {
    availabilityTimeComplete?: boolean;
    availabilityTimeOffset?: number;
    bitstreamSwitching?: boolean;
    duration?: number;
    index?: string;
    indexRange?: [number, number];
    indexRangeExact?: boolean;
    initialization?: IParsedInitialization;
    media?: string;
    presentationTimeOffset?: number;
    startNumber?: number;
    timelineParser?: ITimelineParser;
    timescale?: number;
}
/**
 * Parse a SegmentTemplate element into a SegmentTemplate intermediate
 * representation.
 * @param {Element} root - The SegmentTemplate root element.
 * @returns {Array}
 */
export default function parseSegmentTemplate(root: Element): [IParsedSegmentTemplate, Error[]];

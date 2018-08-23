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

import { Representation } from "../../manifest";
import {
  INextSegmentsInfos,
  ISegmentTimingInfos,
} from "../types";

/**
 * @param {Object} adaptation
 * @param {Object} dlSegment
 * @param {Object} nextSegments
 */
function addNextSegments(
  representation : Representation,
  nextSegments : INextSegmentsInfos[],
  currentSegment? : ISegmentTimingInfos
) {
  representation.index._addSegments(nextSegments, currentSegment);
}

/**
 * Returns true if the given texttrack segment represents a textrack embedded
 * in a mp4 file.
 * @param {Representation} representation
 * @returns {Boolean}
 */
function isMP4EmbeddedTrack(representation : Representation) : boolean {
  return representation.mimeType === "application/mp4";
}

/**
 * Returns text-formatted byteRange (`bytes=$start-$end?)`
 * @param {Array.<string|Number>} arr
 * @returns {string}
 */
function byteRange([start, end] : [number, number]) : string {
  return end === Infinity ?
    "bytes=" + (+start) + "-" :
    "bytes=" + (+start) + "-" + (+end);
}

export {
  addNextSegments,
  isMP4EmbeddedTrack,
  byteRange,
};

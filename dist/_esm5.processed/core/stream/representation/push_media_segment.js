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
import { defer as observableDefer, EMPTY, } from "rxjs";
import { map } from "rxjs/operators";
import config from "../../../config";
import objectAssign from "../../../utils/object_assign";
import EVENTS from "../events_generators";
import appendSegmentToBuffer from "./append_segment_to_buffer";
var APPEND_WINDOW_SECURITIES = config.APPEND_WINDOW_SECURITIES;
/**
 * Push a given media segment (non-init segment) to a SegmentBuffer.
 * The Observable returned:
 *   - emit an event once the segment has been pushed.
 *   - throws on Error.
 * @param {Object} args
 * @returns {Observable}
 */
export default function pushMediaSegment(_a) {
    var clock$ = _a.clock$, content = _a.content, initSegmentData = _a.initSegmentData, parsedSegment = _a.parsedSegment, segment = _a.segment, segmentBuffer = _a.segmentBuffer;
    return observableDefer(function () {
        if (parsedSegment.chunkData === null) {
            return EMPTY;
        }
        var chunkData = parsedSegment.chunkData, chunkInfos = parsedSegment.chunkInfos, chunkOffset = parsedSegment.chunkOffset, appendWindow = parsedSegment.appendWindow;
        var codec = content.representation.getMimeTypeString();
        // Cutting exactly at the start or end of the appendWindow can lead to
        // cases of infinite rebuffering due to how browser handle such windows.
        // To work-around that, we add a small offset before and after those.
        var safeAppendWindow = [
            appendWindow[0] !== undefined ?
                Math.max(0, appendWindow[0] - APPEND_WINDOW_SECURITIES.START) :
                undefined,
            appendWindow[1] !== undefined ?
                appendWindow[1] + APPEND_WINDOW_SECURITIES.END :
                undefined,
        ];
        var data = { initSegment: initSegmentData,
            chunk: chunkData,
            timestampOffset: chunkOffset,
            appendWindow: safeAppendWindow, codec: codec };
        var estimatedStart;
        var estimatedDuration;
        if (chunkInfos !== null) {
            estimatedStart = chunkInfos.time / chunkInfos.timescale;
            estimatedDuration = chunkInfos.duration !== undefined ?
                chunkInfos.duration / chunkInfos.timescale :
                segment.duration / segment.timescale;
        }
        else {
            estimatedStart = segment.time / segment.timescale;
            estimatedDuration = segment.duration / segment.timescale;
        }
        var estimatedEnd = estimatedStart + estimatedDuration;
        if (safeAppendWindow[0] !== undefined) {
            estimatedStart = Math.max(estimatedStart, safeAppendWindow[0]);
        }
        if (safeAppendWindow[1] !== undefined) {
            estimatedEnd = Math.min(estimatedEnd, safeAppendWindow[1]);
        }
        var inventoryInfos = objectAssign({ segment: segment, start: estimatedStart,
            end: estimatedEnd }, content);
        return appendSegmentToBuffer(clock$, segmentBuffer, { data: data, inventoryInfos: inventoryInfos })
            .pipe(map(function () {
            var buffered = segmentBuffer.getBufferedRanges();
            return EVENTS.addedSegment(content, segment, buffered, chunkData);
        }));
    });
}

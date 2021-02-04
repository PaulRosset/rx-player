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
import config from "../../../config";
import { SegmentBufferOperation, } from "../../segment_buffers";
import checkForDiscontinuity from "./check_for_discontinuity";
import getNeededSegments from "./get_needed_segments";
import getSegmentPriority from "./get_segment_priority";
var MINIMUM_SEGMENT_SIZE = config.MINIMUM_SEGMENT_SIZE;
/**
 * Checks on the current buffered data for the given type and Period
 * and returns what should be done to fill the buffer according to the buffer
 * goal, the Representation chosen, etc.
 * Also emits discontinuities if found, which are parts of the buffer that won't
 * be filled by any segment, even in the future.
 *
 * @param {Object} content
 * @param {Object} tick
 * @param {number|undefined} fastSwitchThreshold
 * @param {number} bufferGoal
 * @param {Object} segmentBuffer
 * @returns {Object}
 */
export default function getBufferStatus(content, tick, fastSwitchThreshold, bufferGoal, segmentBuffer) {
    var _a;
    var period = content.period, representation = content.representation;
    segmentBuffer.synchronizeInventory();
    var wantedStartPosition = tick.position + tick.wantedTimeOffset;
    var wantedEndPosition = wantedStartPosition + bufferGoal;
    var neededRange = { start: Math.max(wantedStartPosition, period.start), end: Math.min(wantedEndPosition, (_a = period.end) !== null && _a !== void 0 ? _a : Infinity) };
    var shouldRefreshManifest = representation.index.shouldRefresh(wantedStartPosition, wantedEndPosition);
    /**
     * Every segment awaiting an "EndOfSegment" operation, which indicates that a
     * completely-loaded segment is still being pushed to the SegmentBuffer.
     */
    var segmentsBeingPushed = segmentBuffer.getPendingOperations()
        .filter(function (operation) {
        return operation.type === SegmentBufferOperation.EndOfSegment;
    }).map(function (operation) { return operation.value; });
    /** Data on every segments buffered around `neededRange`. */
    var bufferedSegments = getPlayableBufferedSegments({ start: Math.max(neededRange.start - 0.5, 0),
        end: neededRange.end + 0.5 }, segmentBuffer.getInventory());
    /** List of segments we will need to download. */
    var neededSegments = getNeededSegments({ content: content, currentPlaybackTime: tick.getCurrentTime(), fastSwitchThreshold: fastSwitchThreshold,
        neededRange: neededRange,
        bufferedSegments: bufferedSegments,
        segmentsBeingPushed: segmentsBeingPushed })
        .map(function (segment) { return ({ priority: getSegmentPriority(segment.time, tick), segment: segment }); });
    /**
     * `true` if the current `RepresentationStream` has loaded all the
     * needed segments for this Representation until the end of the Period.
     */
    var hasFinishedLoading;
    var lastPosition = representation.index.getLastPosition();
    if (!representation.index.isInitialized() ||
        period.end === undefined ||
        neededSegments.length > 0) {
        hasFinishedLoading = false;
    }
    else {
        if (lastPosition === undefined) {
            // We do not know the end of this index.
            // If we reached the end of the period, check that all segments are
            // available.
            hasFinishedLoading = neededRange.end >= period.end &&
                representation.index.isFinished();
        }
        else if (lastPosition === null) {
            // There is no available segment in the index currently. If the index
            // tells us it has finished generating new segments, we're done.
            hasFinishedLoading = representation.index.isFinished();
        }
        else {
            // We have a declared end. Check that our range went until the last
            // position available in the index. If that's the case and we're left
            // with no segments after filtering them, it means we already have
            // downloaded the last segments and have nothing left to do: full.
            var endOfRange = period.end !== undefined ? Math.min(period.end, lastPosition) :
                lastPosition;
            hasFinishedLoading = neededRange.end >= endOfRange &&
                representation.index.isFinished();
        }
    }
    var imminentDiscontinuity;
    if (!representation.index.isInitialized() ||
        // TODO better handle contents not chronologically generated
        (!representation.index.areSegmentsChronologicallyGenerated() &&
            !hasFinishedLoading)) {
        // We might be missing information about future segments
        imminentDiscontinuity = null;
    }
    else {
        /**
         * Start time in seconds of the next available not-yet pushed segment.
         * `null` if no segment is wanted for the current wanted range.
         */
        var nextSegmentStart = null;
        if (segmentsBeingPushed.length > 0) {
            nextSegmentStart = Math.min.apply(Math, segmentsBeingPushed.map(function (info) { return info.segment.time; }));
        }
        if (neededSegments.length > 0) {
            nextSegmentStart = nextSegmentStart !== null ?
                Math.min(nextSegmentStart, neededSegments[0].segment.time) :
                neededSegments[0].segment.time;
        }
        imminentDiscontinuity = checkForDiscontinuity(content, neededRange, nextSegmentStart, hasFinishedLoading, bufferedSegments);
    }
    return { imminentDiscontinuity: imminentDiscontinuity,
        hasFinishedLoading: hasFinishedLoading,
        neededSegments: neededSegments,
        shouldRefreshManifest: shouldRefreshManifest };
}
/**
 * From the given SegmentInventory, filters the "playable" (in a supported codec
 * and not known to be undecipherable) buffered Segment Objects which overlap
 * with the given range.
 * @param {Object} neededRange
 * @param {Array.<Object>} segmentInventory
 * @returns {Array.<Object>}
 */
function getPlayableBufferedSegments(neededRange, segmentInventory) {
    var segmentRoundingError = Math.max(1 / 60, MINIMUM_SEGMENT_SIZE);
    var minEnd = neededRange.start + segmentRoundingError;
    var maxStart = neededRange.end - segmentRoundingError;
    var overlappingChunks = [];
    for (var i = segmentInventory.length - 1; i >= 0; i--) {
        var eltInventory = segmentInventory[i];
        var representation = eltInventory.infos.representation;
        if (!eltInventory.partiallyPushed &&
            representation.decipherable !== false &&
            representation.isSupported) {
            var inventorySegment = eltInventory.infos.segment;
            var eltInventoryStart = inventorySegment.time /
                inventorySegment.timescale;
            var eltInventoryEnd = inventorySegment.duration == null ?
                eltInventory.end :
                eltInventoryStart + inventorySegment.duration /
                    inventorySegment.timescale;
            if ((eltInventoryEnd > minEnd && eltInventoryStart < maxStart) ||
                (eltInventory.end > minEnd && eltInventory.start < maxStart)) {
                overlappingChunks.unshift(eltInventory);
            }
        }
    }
    return overlappingChunks;
}

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
/**
 * This file allows to create RepresentationStreams.
 *
 * A RepresentationStream downloads and push segment for a single
 * Representation (e.g. a single video stream of a given quality).
 * It chooses which segments should be downloaded according to the current
 * position and what is currently buffered.
 */
import shouldAppendBufferAfterPadding from "../../../compat/should_append_buffer_after_padding";
import config from "../../../config";
import log from "../../../log";
import { areSameContent, } from "../../../manifest";
import objectAssign from "../../../utils/object_assign";
import { SourceBufferOperation, } from "../../source_buffers";
var CONTENT_REPLACEMENT_PADDING = config.CONTENT_REPLACEMENT_PADDING, BITRATE_REBUFFERING_RATIO = config.BITRATE_REBUFFERING_RATIO, MAX_TIME_MISSING_FROM_COMPLETE_SEGMENT = config.MAX_TIME_MISSING_FROM_COMPLETE_SEGMENT, MINIMUM_SEGMENT_SIZE = config.MINIMUM_SEGMENT_SIZE;
/**
 * Epsilon compensating for rounding errors when comparing the start and end
 * time of multiple segments.
 */
var ROUNDING_ERROR = Math.min(1 / 60, MINIMUM_SEGMENT_SIZE);
/**
 * @param {Object} segmentFilterArgument
 * @returns {Array.<Object>}
 */
export default function getNeededSegments(_a) {
    var content = _a.content, currentPlaybackTime = _a.currentPlaybackTime, knownStableBitrate = _a.knownStableBitrate, neededRange = _a.neededRange, queuedSourceBuffer = _a.queuedSourceBuffer;
    var segmentInventory = queuedSourceBuffer.getInventory();
    /**
     * Every segment awaiting an "EndOfSegment" operation, which indicates that a
     * completely-loaded segment is still being pushed to the QueuedSourceBuffer.
     */
    var segmentsBeingPushed = queuedSourceBuffer.getPendingOperations()
        .filter(function (operation) {
        return operation.type === SourceBufferOperation.EndOfSegment;
    }).map(function (operation) { return operation.value; });
    // 1 - construct lists of segments possible and actually pushed
    var segmentsForRange = content.representation.index
        .getSegments(neededRange.start, neededRange.end - neededRange.start);
    var bufferedSegments = getPlayableBufferedSegments({
        start: Math.max(neededRange.start - 0.5, 0),
        end: neededRange.end + 0.5,
    }, segmentInventory);
    // 2 - remove from pushed list of current segments the contents we want to replace
    bufferedSegments = bufferedSegments.filter(function (bufferedSegment) {
        return !shouldContentBeReplaced(bufferedSegment.infos, content, currentPlaybackTime, knownStableBitrate);
    });
    // 3 - remove from that list the segments who appeared to have been GCed
    bufferedSegments = filterGarbageCollectedSegments(bufferedSegments, neededRange);
    // 4 - now filter the list of segments we can download
    return segmentsForRange.filter(function (segment) {
        var contentObject = objectAssign({ segment: segment }, content);
        // First, check that the segment is not already being pushed
        if (segmentsBeingPushed.length > 0) {
            var isAlreadyBeingPushed = segmentsBeingPushed
                .some(function (pendingSegment) { return areSameContent(contentObject, pendingSegment); });
            if (isAlreadyBeingPushed) {
                return false;
            }
        }
        var duration = segment.duration, time = segment.time, timescale = segment.timescale;
        if (segment.isInit || duration === undefined) {
            return true; // never skip those
        }
        if (duration / timescale < MINIMUM_SEGMENT_SIZE) {
            return false; // too small
        }
        var scaledTime = time / timescale;
        var scaledDuration = duration / timescale;
        var scaledEnd = scaledTime + scaledDuration;
        // Check if the same segment from another Representation is not already
        // being pushed.
        if (segmentsBeingPushed.length > 0) {
            var waitForPushedSegment = segmentsBeingPushed.some(function (pendingSegment) {
                if (pendingSegment.period.id !== content.period.id ||
                    pendingSegment.adaptation.id !== content.adaptation.id) {
                    return false;
                }
                var oldSegment = pendingSegment.segment;
                var oldSegmentStart = oldSegment.time / oldSegment.timescale;
                if ((oldSegmentStart - ROUNDING_ERROR) > scaledTime) {
                    return false;
                }
                var oldSegmentEnd = oldSegmentStart +
                    (oldSegment.duration / oldSegment.timescale);
                if ((oldSegmentEnd + ROUNDING_ERROR) < scaledEnd) {
                    return false;
                }
                return !shouldContentBeReplaced(pendingSegment, contentObject, currentPlaybackTime, knownStableBitrate);
            });
            if (waitForPushedSegment) {
                return false;
            }
        }
        // check if the segment is already downloaded
        for (var i = 0; i < bufferedSegments.length; i++) {
            var completeSeg = bufferedSegments[i];
            var areFromSamePeriod = completeSeg.infos.period.id === content.period.id;
            // Check if content are from same period, as there can't be overlapping
            // periods, we should consider a segment as already downloaded if
            // it is from same period (but can be from different adaptation or
            // representation)
            if (areFromSamePeriod) {
                var segTime = completeSeg.infos.segment.time;
                var segDuration = completeSeg.infos.segment.duration;
                var segTimeScale = completeSeg.infos.segment.timescale;
                var scaledSegTime = segTime / segTimeScale;
                var scaledSegEnd = scaledSegTime + segDuration / segTimeScale;
                if (scaledTime - scaledSegTime > -ROUNDING_ERROR &&
                    scaledSegEnd - scaledEnd > -ROUNDING_ERROR) {
                    return false; // already downloaded
                }
            }
        }
        // check if there is an hole in place of the segment currently
        for (var i = 0; i < bufferedSegments.length; i++) {
            var completeSeg = bufferedSegments[i];
            if (completeSeg.end > scaledTime) {
                if (completeSeg.start > scaledTime + ROUNDING_ERROR) {
                    return true;
                }
                var j = i + 1;
                // go through all contiguous segments and take the last one
                while (j < bufferedSegments.length - 1 &&
                    (bufferedSegments[j - 1].end + ROUNDING_ERROR) >
                        bufferedSegments[j].start) {
                    j++;
                }
                j--; // index of last contiguous segment
                return bufferedSegments[j].end < scaledEnd + ROUNDING_ERROR;
            }
        }
        return true;
    });
}
/**
 * Returns `true` if segments linked to the given `oldContent` currently present
 * in the buffer should be replaced by segments coming from `currentContent`.
 * @param {Object} oldContent
 * @param {Object} currentContent
 * @param {number} currentPlaybackTime
 * @param {number} [knownStableBitrate]
 * @returns {boolean}
 */
function shouldContentBeReplaced(oldContent, currentContent, currentPlaybackTime, knownStableBitrate) {
    if (oldContent.period.id !== currentContent.period.id) {
        return false; // keep segments from another Period by default.
    }
    var segment = oldContent.segment;
    if (shouldAppendBufferAfterPadding &&
        (segment.time / segment.timescale) <
            (currentPlaybackTime + CONTENT_REPLACEMENT_PADDING)) {
        return false;
    }
    if (oldContent.adaptation.id !== currentContent.adaptation.id) {
        return true; // replace segments from another Adaptation
    }
    return canFastSwitch(oldContent.representation, currentContent.representation, knownStableBitrate);
}
/**
 * Returns `true` if segments from the new Representation can replace
 * previously-loaded segments from the old Representation given.
 *
 * This behavior is called "fast-switching".
 * @param {Object} oldSegmentRepresentation
 * @param {Object} newSegmentRepresentation
 * @param {number|undefined} knownStableBitrate
 * @returns {boolean}
 */
function canFastSwitch(oldSegmentRepresentation, newSegmentRepresentation, knownStableBitrate) {
    var oldContentBitrate = oldSegmentRepresentation.bitrate;
    if (knownStableBitrate === undefined) {
        // only re-load comparatively-poor bitrates for the same Adaptation.
        var bitrateCeil = oldContentBitrate * BITRATE_REBUFFERING_RATIO;
        return newSegmentRepresentation.bitrate > bitrateCeil;
    }
    return oldContentBitrate < knownStableBitrate &&
        newSegmentRepresentation.bitrate > oldContentBitrate;
}
/**
 * Returns an Array which removed the segments from `consideredSegments` which
 * appeared to have been garbage collected.
 * @param {Array.<Object>} consideredSegments
 * @param {Object} neededRange
 * @returns {Array.<Object>}
 */
function filterGarbageCollectedSegments(consideredSegments, neededRange) {
    var completeSegments = [];
    for (var i = 0; i < consideredSegments.length; i++) {
        var currentSeg = consideredSegments[i];
        var prevSeg = i === 0 ? null :
            consideredSegments[i - 1];
        var nextSeg = i >= consideredSegments.length - 1 ? null :
            consideredSegments[i + 1];
        if (!isStartGarbageCollected(currentSeg, prevSeg, neededRange.start) &&
            !isEndGarbageCollected(currentSeg, nextSeg, neededRange.end)) {
            completeSegments.push(currentSeg);
        }
    }
    return completeSegments;
}
/**
 * From buffered segment information, return `true` if the given `currentSeg`
 * might have been garbage collected at the start.
 * Return `false` if the segment is complete at least from `maximumStartTime`.
 * @param {Object} currentSeg - The segment information for the segment in
 * question.
 * @param {Object|null} prevSeg - The segment information for the previous
 * buffered segment, if one (`null` if none).
 * @param {number} maximumStartTime - Only consider the data after that time.
 * If `currentSeg` has only been garbage collected for some data which is before
 * that time, we will return `false`.
 */
function isStartGarbageCollected(currentSeg, prevSeg, maximumStartTime) {
    if (currentSeg.bufferedStart === undefined) {
        log.warn("Stream: Start of a segment unknown. " +
            "Assuming it is garbage collected by default.", currentSeg);
        return true;
    }
    if (prevSeg !== null && prevSeg.bufferedEnd !== undefined &&
        (currentSeg.bufferedStart - prevSeg.bufferedEnd < 0.1)) {
        return false;
    }
    if (maximumStartTime < currentSeg.bufferedStart &&
        currentSeg.bufferedStart - currentSeg.start >
            MAX_TIME_MISSING_FROM_COMPLETE_SEGMENT) {
        log.info("Stream: The start of the wanted segment has been garbage collected", currentSeg);
        return true;
    }
    return false;
}
/**
 * From buffered segment information, return `true` if the given `currentSeg`
 * might have been garbage collected at the end.
 * Return `false` if the segment is complete at least until `minimumEndTime`.
 * @param {Object} currentSeg - The segment information for the segment in
 * question.
 * @param {Object|null} nextSeg - The segment information for the next buffered
 * segment, if one (`null` if none).
 * @param {number} minimumEndTime - Only consider the data before that time.
 * If `currentSeg` has only been garbage collected for some data which is after
 * that time, we will return `false`.
 */
function isEndGarbageCollected(currentSeg, nextSeg, minimumEndTime) {
    if (currentSeg.bufferedEnd === undefined) {
        log.warn("Stream: End of a segment unknown. " +
            "Assuming it is garbage collected by default.", currentSeg);
        return true;
    }
    if (nextSeg !== null && nextSeg.bufferedStart !== undefined &&
        (nextSeg.bufferedStart - currentSeg.bufferedEnd < 0.1)) {
        return false;
    }
    if (minimumEndTime > currentSeg.bufferedEnd &&
        currentSeg.end - currentSeg.bufferedEnd > MAX_TIME_MISSING_FROM_COMPLETE_SEGMENT) {
        log.info("Stream: The end of the wanted segment has been garbage collected", currentSeg);
        return true;
    }
    return false;
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

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
import log from "../../../log";
/**
 * Check if there is a soon-to-be-encountered discontinuity in the buffer that
 * won't be filled by any future segment.
 * This function will only check discontinuities for the given `checkedRange`.
 *
 * @param {Object} content - The content we are currently loading.
 * @param {Object} checkedRange - The time range that will be checked for
 * discontinuities.
 * Both `nextSegmentStart` and `bufferedSegments` arguments can only refer to
 * that range.
 * @param {number|null} nextSegmentStart - The start time in seconds of the next
 * not-yet-pushed segment that can be pushed, in the limits of `checkedRange`.
 * This includes segments which have not been loaded or pushed yet, but also
 * segments which might be re-downloaded because currently incomplete in the
 * buffer, the point being to know what is the earliest time in the buffer where
 * a segment might be pushed in the future.
 * `null` if no segment in `checkedRange` will be pushed under current buffer's
 * conditions.
 * @param {boolean} hasFinishedLoading - if `true`, all segments for the current
 * Period have been loaded and none will be loaded in the future under the
 * current buffer's state.
 * @param {Array.<Object>} bufferedSegments - Information about every segments
 * currently in the buffer, in chronological order.
 * Only segments overlapping with the given `checkedRange` will be looked at,
 * though the array given can be larger.
 */
export default function checkForDiscontinuity(content, checkedRange, nextSegmentStart, hasFinishedLoading, bufferedSegments) {
    var period = content.period, adaptation = content.adaptation, representation = content.representation;
    // `bufferedSegments` might also contains segments which are before
    // `checkedRange`.
    // Here we want the first one that goes over `checkedRange.start`, to  see
    // if there's a discontinuity at the beginning in the buffer
    var nextBufferedInRangeIdx;
    for (var bufIdx = 0; bufIdx < bufferedSegments.length; bufIdx++) {
        var bufSeg = bufferedSegments[bufIdx];
        if (bufSeg.bufferedEnd === undefined) {
            break;
        }
        if (bufSeg.bufferedEnd > checkedRange.start) {
            nextBufferedInRangeIdx = bufIdx;
            break;
        }
    }
    if (nextBufferedInRangeIdx === undefined) {
        var discontinuityEnd = representation.index.checkDiscontinuity(checkedRange.start);
        if (discontinuityEnd !== null) {
            return { start: undefined,
                end: discontinuityEnd };
        }
    }
    else {
        var nextBufferedSegment = bufferedSegments[nextBufferedInRangeIdx];
        if (nextBufferedSegment.bufferedStart !== undefined &&
            nextBufferedSegment.bufferedStart > checkedRange.start &&
            (nextSegmentStart === null ||
                nextBufferedSegment.infos.segment.end <= nextSegmentStart)) {
            log.error("RS: current discontinuity encountered", adaptation.type, nextBufferedSegment.bufferedStart);
            return { start: undefined,
                end: nextBufferedSegment.bufferedStart };
        }
        else {
            var nextHoleIdx = void 0;
            for (var bufIdx = nextBufferedInRangeIdx + 1; bufIdx < bufferedSegments.length; bufIdx++) {
                var currSegment = bufferedSegments[bufIdx];
                var prevSegment = bufferedSegments[bufIdx - 1];
                if (currSegment.bufferedStart === undefined ||
                    prevSegment.bufferedEnd === undefined ||
                    currSegment.bufferedStart >= checkedRange.end) {
                    break;
                }
                if (currSegment.bufferedStart - prevSegment.bufferedEnd > 0) {
                    nextHoleIdx = bufIdx;
                }
            }
            if (nextHoleIdx !== undefined &&
                (nextSegmentStart === null ||
                    bufferedSegments[nextHoleIdx].infos.segment.end <= nextSegmentStart)) {
                var start = bufferedSegments[nextHoleIdx - 1].bufferedEnd;
                var end = bufferedSegments[nextHoleIdx].bufferedStart;
                log.error("RS: future discontinuity encountered", adaptation.type, start, end);
                return { start: start, end: end };
            }
            else if (nextSegmentStart === null) {
                if (hasFinishedLoading && period.end !== undefined) {
                    if (checkedRange.end < period.end) {
                        return null;
                    }
                    // consider last buffered segment in Period
                    var lastBufferedInPeriodIdx = void 0;
                    for (var bufIdx = bufferedSegments.length - 1; bufIdx >= 0; bufIdx--) {
                        var bufSeg = bufferedSegments[bufIdx];
                        if (bufSeg.bufferedStart === undefined) {
                            break;
                        }
                        if (bufSeg.bufferedStart < period.end) {
                            lastBufferedInPeriodIdx = bufIdx;
                            break;
                        }
                    }
                    if (lastBufferedInPeriodIdx !== undefined) {
                        var lastSegment = bufferedSegments[lastBufferedInPeriodIdx];
                        if (lastSegment.bufferedEnd !== undefined &&
                            lastSegment.bufferedEnd < period.end) {
                            log.error("RS: discontinuity encountered at the end of the current period", adaptation.type, lastSegment.bufferedEnd, period.end);
                            return { start: lastSegment.bufferedEnd,
                                end: null };
                        }
                    }
                }
                // consider last buffered segment in checkedRange
                var lastBufferedInRangeIdx = void 0;
                for (var bufIdx = bufferedSegments.length - 1; bufIdx >= 0; bufIdx--) {
                    var bufSeg = bufferedSegments[bufIdx];
                    if (bufSeg.bufferedStart === undefined) {
                        break;
                    }
                    if (bufSeg.bufferedStart < checkedRange.end) {
                        lastBufferedInRangeIdx = bufIdx;
                        break;
                    }
                }
                if (lastBufferedInRangeIdx !== undefined) {
                    var lastSegmentInRange = bufferedSegments[lastBufferedInRangeIdx];
                    if (lastSegmentInRange.bufferedEnd !== undefined &&
                        lastSegmentInRange.bufferedEnd < checkedRange.end) {
                        var discontinuityEnd = representation.index
                            .checkDiscontinuity(checkedRange.end);
                        if (discontinuityEnd !== null) {
                            return { start: lastSegmentInRange.bufferedEnd,
                                end: discontinuityEnd };
                        }
                    }
                }
            }
        }
    }
    return null;
}

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
import { map, scan, withLatestFrom, } from "rxjs/operators";
import { isPlaybackStuck } from "../../compat";
import config from "../../config";
import { MediaError } from "../../errors";
import log from "../../log";
import { getNextRangeGap } from "../../utils/ranges";
import EVENTS from "../stream/events_generators";
var BUFFER_DISCONTINUITY_THRESHOLD = config.BUFFER_DISCONTINUITY_THRESHOLD;
/**
 * Work-around rounding errors with floating points by setting an acceptable,
 * very short, deviation when checking equalities.
 */
var EPSILON = 1 / 60;
/**
 * Monitor situations where playback is stalled and try to get out of those.
 * Emit "stalled" then "unstalled" respectably when an unavoidable stall is
 * encountered and exited.
 * @param {Observable} clock$ - Observable emitting the current playback
 * conditions.
 * @param {HTMLMediaElement} mediaElement - The HTMLMediaElement on which the
 * media is played.
 * @param {Object} manifest - The Manifest of the currently-played content.
 * @param {Observable} discontinuityUpdate$ - Observable emitting encountered
 * discontinuities for loaded Period and buffer types.
 * @returns {Observable}
 */
export default function StallAvoider(clock$, mediaElement, manifest, discontinuityUpdate$) {
    var initialDiscontinuitiesStore = [];
    /**
     * Emit every known audio and video buffer discontinuities in chronological
     * order (first ordered by Period's start, then by bufferType in any order.
     */
    var discontinuitiesStore$ = discontinuityUpdate$.pipe(withLatestFrom(clock$), // listen to clock to clean-up old discontinuities
    scan(function (discontinuitiesStore, _a) {
        var evt = _a[0], tick = _a[1];
        return updateDiscontinuitiesStore(discontinuitiesStore, evt, tick);
    }, initialDiscontinuitiesStore));
    return clock$.pipe(withLatestFrom(discontinuitiesStore$), map(function (_a) {
        var tick = _a[0], discontinuitiesStore = _a[1];
        var buffered = tick.buffered, currentRange = tick.currentRange, position = tick.position, state = tick.state, stalled = tick.stalled;
        if (stalled === null) {
            return { type: "unstalled", value: null };
        }
        /** Position at which data is awaited. */
        var stalledPosition = stalled.position;
        if (stalledPosition !== null) {
            var skippableDiscontinuity = findSeekableDiscontinuity(discontinuitiesStore, manifest, stalledPosition);
            if (skippableDiscontinuity !== null) {
                var realSeekTime = skippableDiscontinuity + 0.001;
                if (realSeekTime <= mediaElement.currentTime) {
                    log.info("Init: position to seek already reached, no seeking", mediaElement.currentTime, realSeekTime);
                }
                else {
                    log.warn("SA: skippable discontinuity found in the stream", position, realSeekTime);
                    mediaElement.currentTime = realSeekTime;
                    return EVENTS.warning(generateDiscontinuityError(stalledPosition, realSeekTime));
                }
            }
        }
        // Is it a browser bug? -> force seek at the same current time
        if (isPlaybackStuck(position, currentRange, state, stalled !== null)) {
            log.warn("Init: After freeze seek", position, currentRange);
            mediaElement.currentTime = position;
            return EVENTS.warning(generateDiscontinuityError(position, position));
        }
        var freezePosition = stalledPosition !== null && stalledPosition !== void 0 ? stalledPosition : position;
        // Is it a very short discontinuity in buffer ? -> Seek at the beginning of the
        //                                                 next range
        //
        // Discontinuity check in case we are close a buffered range but still
        // calculate a stalled state. This is useful for some
        // implementation that might drop an injected segment, or in
        // case of small discontinuity in the content.
        var nextBufferRangeGap = getNextRangeGap(buffered, freezePosition);
        if (nextBufferRangeGap < BUFFER_DISCONTINUITY_THRESHOLD) {
            var seekTo = (freezePosition + nextBufferRangeGap + EPSILON);
            if (mediaElement.currentTime < seekTo) {
                log.warn("Init: discontinuity encountered inferior to the threshold", freezePosition, seekTo, BUFFER_DISCONTINUITY_THRESHOLD);
                mediaElement.currentTime = seekTo;
                return EVENTS.warning(generateDiscontinuityError(freezePosition, seekTo));
            }
        }
        // Are we in a discontinuity between periods ? -> Seek at the beginning of the
        //                                                next period
        for (var i = manifest.periods.length - 2; i >= 0; i--) {
            var period = manifest.periods[i];
            if (period.end !== undefined && period.end <= freezePosition) {
                if (manifest.periods[i + 1].start > freezePosition &&
                    manifest.periods[i + 1].start > mediaElement.currentTime) {
                    var nextPeriod = manifest.periods[i + 1];
                    mediaElement.currentTime = nextPeriod.start;
                    return EVENTS.warning(generateDiscontinuityError(freezePosition, nextPeriod.start));
                }
                break;
            }
        }
        return { type: "stalled", value: stalled };
    }));
}
/**
 * @param {Array.<Object>} discontinuitiesStore
 * @param {Object} manifest
 * @param {number} stalledPosition
 * @returns {number|null}
 */
function findSeekableDiscontinuity(discontinuitiesStore, manifest, stalledPosition) {
    if (discontinuitiesStore.length === 0) {
        return null;
    }
    var maxDiscontinuityEnd = null;
    for (var i = 0; i < discontinuitiesStore.length; i++) {
        var period = discontinuitiesStore[i].period;
        if (period.start > stalledPosition) {
            return maxDiscontinuityEnd;
        }
        var discontinuityEnd = void 0;
        if (period.end === undefined || period.end > stalledPosition) {
            var _a = discontinuitiesStore[i], discontinuity = _a.discontinuity, position = _a.position;
            var start = discontinuity.start, end = discontinuity.end;
            var discontinuityLowerLimit = start !== null && start !== void 0 ? start : position;
            if (stalledPosition >= (discontinuityLowerLimit - EPSILON)) {
                if (end === null) {
                    var nextPeriod = manifest.getPeriodAfter(period);
                    if (nextPeriod !== null) {
                        discontinuityEnd = nextPeriod.start + EPSILON;
                    }
                    else {
                        log.warn("Init: discontinuity at Period's end but no next Period");
                    }
                }
                else if (stalledPosition < (end + EPSILON)) {
                    discontinuityEnd = end + EPSILON;
                }
            }
            if (discontinuityEnd !== undefined) {
                log.info("Init: discontinuity found", stalledPosition, discontinuityEnd);
                maxDiscontinuityEnd =
                    maxDiscontinuityEnd !== null &&
                        maxDiscontinuityEnd > discontinuityEnd ? maxDiscontinuityEnd :
                        discontinuityEnd;
            }
        }
    }
    return maxDiscontinuityEnd;
}
/**
 * Return `true` if the given event indicates that a discontinuity is present.
 * @param {Object} evt
 * @returns {Array.<Object>}
 */
function eventContainsDiscontinuity(evt) {
    return evt.discontinuity !== null;
}
/**
 * Update the `discontinuitiesStore` Object with the given event information:
 *
 *   - If that event indicates than no discontinuity is found for a Period
 *     and buffer type, remove a possible existing discontinuity for that
 *     combination.
 *
 *   - If that event indicates that a discontinuity can be found for a Period
 *     and buffer type, replace previous occurences for that combination and
 *     store it in Period's chronological order in the Array.
 * @param {Array.<Object>} discontinuitiesStore
 * @param {Object} evt
 * @param {Object} tick
 * @returns {Array.<Object>}
 */
function updateDiscontinuitiesStore(discontinuitiesStore, evt, tick) {
    // First, perform clean-up of old discontinuities
    while (discontinuitiesStore.length > 0 &&
        discontinuitiesStore[0].period.end !== undefined &&
        discontinuitiesStore[0].period.end + 10 < tick.position) {
        discontinuitiesStore.shift();
    }
    var period = evt.period, bufferType = evt.bufferType;
    if (bufferType !== "audio" && bufferType !== "video") {
        return discontinuitiesStore;
    }
    for (var i = 0; i < discontinuitiesStore.length; i++) {
        if (discontinuitiesStore[i].period.id === period.id) {
            if (discontinuitiesStore[i].bufferType === bufferType) {
                if (!eventContainsDiscontinuity(evt)) {
                    discontinuitiesStore.splice(i, 1);
                }
                else {
                    discontinuitiesStore[i] = evt;
                }
                return discontinuitiesStore;
            }
        }
        else if (discontinuitiesStore[i].period.start > period.start) {
            if (eventContainsDiscontinuity(evt)) {
                discontinuitiesStore.splice(i, 0, evt);
            }
            return discontinuitiesStore;
        }
    }
    if (eventContainsDiscontinuity(evt)) {
        discontinuitiesStore.push(evt);
    }
    return discontinuitiesStore;
}
/**
 * Generate error emitted when a discontinuity has been encountered.
 * @param {number} stalledPosition
 * @param {number} seekTo
 * @returns {Error}
 */
function generateDiscontinuityError(stalledPosition, seekTo) {
    return new MediaError("DISCONTINUITY_ENCOUNTERED", "A discontinuity has been encountered at position " +
        String(stalledPosition) + ", seeked at position " +
        String(seekTo));
}

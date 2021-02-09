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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
/**
 * This file defines a global clock for the RxPlayer.
 *
 * Each clock tick also pass information about the current state of the
 * media element to sub-parts of the player.
 */
import { defer as observableDefer, fromEvent as observableFromEvent, interval as observableInterval, merge as observableMerge, ReplaySubject, } from "rxjs";
import { map, mapTo, multicast, refCount, startWith, } from "rxjs/operators";
import config from "../../config";
import log from "../../log";
import objectAssign from "../../utils/object_assign";
import { getRange } from "../../utils/ranges";
var SAMPLING_INTERVAL_MEDIASOURCE = config.SAMPLING_INTERVAL_MEDIASOURCE, SAMPLING_INTERVAL_LOW_LATENCY = config.SAMPLING_INTERVAL_LOW_LATENCY, SAMPLING_INTERVAL_NO_MEDIASOURCE = config.SAMPLING_INTERVAL_NO_MEDIASOURCE, RESUME_GAP_AFTER_SEEKING = config.RESUME_GAP_AFTER_SEEKING, RESUME_GAP_AFTER_NOT_ENOUGH_DATA = config.RESUME_GAP_AFTER_NOT_ENOUGH_DATA, RESUME_GAP_AFTER_BUFFERING = config.RESUME_GAP_AFTER_BUFFERING, STALL_GAP = config.STALL_GAP;
/**
 * HTMLMediaElement Events for which timings are calculated and emitted.
 * @type {Array.<string>}
 */
var SCANNED_MEDIA_ELEMENTS_EVENTS = ["canplay",
    "play",
    "progress",
    "seeking",
    "seeked",
    "loadedmetadata",
    "ratechange"];
/**
 * Returns the amount of time in seconds the buffer should have ahead of the
 * current position before resuming playback. Based on the infos of the stall.
 * Waiting time differs between a "seeking" stall and a buffering stall.
 * @param {Object|null} stalled
 * @param {Boolean} lowLatencyMode
 * @returns {Number}
 */
function getResumeGap(stalled, lowLatencyMode) {
    if (stalled === null) {
        return 0;
    }
    var suffix = lowLatencyMode ? "LOW_LATENCY" :
        "DEFAULT";
    switch (stalled.reason) {
        case "seeking":
            return RESUME_GAP_AFTER_SEEKING[suffix];
        case "not-ready":
            return RESUME_GAP_AFTER_NOT_ENOUGH_DATA[suffix];
        case "buffering":
            return RESUME_GAP_AFTER_BUFFERING[suffix];
    }
}
/**
 * @param {Object} currentRange
 * @param {Number} duration
 * @param {Boolean} lowLatencyMode
 * @returns {Boolean}
 */
function hasLoadedUntilTheEnd(currentRange, duration, lowLatencyMode) {
    var suffix = lowLatencyMode ? "LOW_LATENCY" :
        "DEFAULT";
    return currentRange !== null &&
        (duration - currentRange.end) <= STALL_GAP[suffix];
}
/**
 * Generate a basic timings object from the media element and the eventName
 * which triggered the request.
 * @param {HTMLMediaElement} mediaElement
 * @param {string} currentState
 * @returns {Object}
 */
function getMediaInfos(mediaElement, currentState) {
    var buffered = mediaElement.buffered, currentTime = mediaElement.currentTime, duration = mediaElement.duration, ended = mediaElement.ended, paused = mediaElement.paused, playbackRate = mediaElement.playbackRate, readyState = mediaElement.readyState, seeking = mediaElement.seeking;
    var currentRange = getRange(buffered, currentTime);
    return { bufferGap: currentRange !== null ? currentRange.end - currentTime :
            // TODO null/0 would probably be
            // more appropriate
            Infinity, buffered: buffered,
        currentRange: currentRange, position: currentTime, duration: duration,
        ended: ended,
        paused: paused,
        playbackRate: playbackRate,
        readyState: readyState,
        seeking: seeking, state: currentState };
}
/**
 * Infer stalled status of the media based on:
 *   - the return of the function getMediaInfos
 *   - the previous timings object.
 *
 * @param {Object} prevTimings - Previous timings object. See function to know
 * the different properties needed.
 * @param {Object} currentTimings - Current timings object. This does not need
 * to have every single infos, see function to know which properties are needed.
 * @param {Object} options
 * @returns {Object|null}
 */
function getStalledStatus(prevTimings, currentTimings, _a) {
    var withMediaSource = _a.withMediaSource, lowLatencyMode = _a.lowLatencyMode;
    var currentState = currentTimings.state, currentTime = currentTimings.position, bufferGap = currentTimings.bufferGap, currentRange = currentTimings.currentRange, duration = currentTimings.duration, paused = currentTimings.paused, readyState = currentTimings.readyState, ended = currentTimings.ended;
    var prevStalled = prevTimings.stalled, prevState = prevTimings.state, prevTime = prevTimings.position;
    var fullyLoaded = hasLoadedUntilTheEnd(currentRange, duration, lowLatencyMode);
    var canStall = (readyState >= 1 &&
        currentState !== "loadedmetadata" &&
        prevStalled === null &&
        !(fullyLoaded || ended));
    var stalledPosition = null;
    var shouldStall;
    var shouldUnstall;
    var stallGap = lowLatencyMode ? STALL_GAP.LOW_LATENCY :
        STALL_GAP.DEFAULT;
    if (withMediaSource) {
        if (canStall) {
            if (bufferGap <= stallGap) {
                shouldStall = true;
                stalledPosition = currentTime + bufferGap;
            }
            else if (bufferGap === Infinity) {
                shouldStall = true;
                stalledPosition = currentTime;
            }
            else if (readyState === 1) {
                shouldStall = true;
            }
        }
        else if (prevStalled !== null) {
            var resumeGap = getResumeGap(prevStalled, lowLatencyMode);
            if (shouldStall !== true && prevStalled !== null && readyState > 1 &&
                (fullyLoaded || ended || (bufferGap < Infinity && bufferGap > resumeGap))) {
                shouldUnstall = true;
            }
            else if (bufferGap === Infinity || bufferGap <= resumeGap) {
                stalledPosition = bufferGap === Infinity ? currentTime :
                    currentTime + bufferGap;
            }
        }
    }
    // when using a direct file, the media will stall and unstall on its
    // own, so we only try to detect when the media timestamp has not changed
    // between two consecutive timeupdates
    else {
        if (canStall &&
            (!paused && currentState === "timeupdate" &&
                prevState === "timeupdate" && currentTime === prevTime ||
                currentState === "seeking" && bufferGap === Infinity)) {
            shouldStall = true;
        }
        else if (prevStalled !== null &&
            (currentState !== "seeking" && currentTime !== prevTime ||
                currentState === "canplay" ||
                bufferGap < Infinity &&
                    (bufferGap > getResumeGap(prevStalled, lowLatencyMode) ||
                        fullyLoaded || ended))) {
            shouldUnstall = true;
        }
    }
    if (shouldUnstall === true) {
        return null;
    }
    else if (shouldStall === true || prevStalled !== null) {
        var reason = void 0;
        if (currentState === "seeking" ||
            currentTimings.seeking ||
            prevStalled !== null && prevStalled.reason === "seeking") {
            reason = "seeking";
        }
        else if (readyState === 1) {
            reason = "not-ready";
        }
        else {
            reason = "buffering";
        }
        if (prevStalled !== null && prevStalled.reason === reason) {
            return { reason: prevStalled.reason,
                timestamp: prevStalled.timestamp,
                position: stalledPosition };
        }
        return { reason: reason, timestamp: performance.now(),
            position: stalledPosition };
    }
    return null;
}
/**
 * Timings observable.
 *
 * This Observable samples snapshots of player's current state:
 *   * time position
 *   * playback rate
 *   * current buffered range
 *   * gap with current buffered range ending
 *   * media duration
 *
 * In addition to sampling, this Observable also reacts to "seeking" and "play"
 * events.
 *
 * Observable is shared for performance reason: reduces the number of event
 * listeners and intervals/timeouts but also limit access to the media element
 * properties and gap calculations.
 *
 * The sampling is manual instead of based on "timeupdate" to reduce the
 * number of events.
 * @param {HTMLMediaElement} mediaElement
 * @param {Object} options
 * @returns {Observable}
 */
function createClock(mediaElement, options) {
    return observableDefer(function () {
        var lastTimings = objectAssign(getMediaInfos(mediaElement, "init"), { stalled: null, getCurrentTime: function () { return mediaElement.currentTime; } });
        function getCurrentClockTick(state) {
            var mediaTimings = getMediaInfos(mediaElement, state);
            var stalledState = getStalledStatus(lastTimings, mediaTimings, options);
            var timings = objectAssign({}, { stalled: stalledState, getCurrentTime: function () { return mediaElement.currentTime; } }, mediaTimings);
            log.debug("API: current media element state", timings);
            return timings;
        }
        var eventObs = SCANNED_MEDIA_ELEMENTS_EVENTS.map(function (eventName) {
            return observableFromEvent(mediaElement, eventName)
                .pipe(mapTo(eventName));
        });
        var interval = options.lowLatencyMode ? SAMPLING_INTERVAL_LOW_LATENCY :
            options.withMediaSource ? SAMPLING_INTERVAL_MEDIASOURCE :
                SAMPLING_INTERVAL_NO_MEDIASOURCE;
        var interval$ = observableInterval(interval)
            .pipe(mapTo("timeupdate"));
        return observableMerge.apply(void 0, __spreadArrays([interval$], eventObs)).pipe(map(function (state) {
            lastTimings = getCurrentClockTick(state);
            if (log.getLevel() === "DEBUG") {
                log.debug("API: current playback timeline:\n" +
                    prettyPrintBuffered(lastTimings.buffered, lastTimings.position), "\n" + state);
            }
            return lastTimings;
        }), startWith(lastTimings));
    }).pipe(multicast(function () { return new ReplaySubject(1); }), // Always emit the last
    refCount());
}
/**
 * Pretty print a TimeRanges Object, to see the current content of it in a
 * one-liner string.
 *
 * @example
 * This function is called by giving it directly the TimeRanges, such as:
 * ```js
 * prettyPrintBuffered(document.getElementsByTagName("video")[0].buffered);
 * ```
 *
 * Let's consider this possible return:
 *
 * ```
 * 0.00|==29.95==|29.95 ~30.05~ 60.00|==29.86==|89.86
 *          ^14
 * ```
 * This means that our video element has 29.95 seconds of buffer between 0 and
 * 29.95 seconds.
 * Then 30.05 seconds where no buffer is found.
 * Then 29.86 seconds of buffer between 60.00 and 89.86 seconds.
 *
 * A caret on the second line indicates the current time we're at.
 * The number coming after it is the current time.
 * @param {TimeRanges} buffered
 * @param {number} currentTime
 * @returns {string}
 */
function prettyPrintBuffered(buffered, currentTime) {
    var str = "";
    var currentTimeStr = "";
    for (var i = 0; i < buffered.length; i++) {
        var start = buffered.start(i);
        var end = buffered.end(i);
        var fixedStart = start.toFixed(2);
        var fixedEnd = end.toFixed(2);
        var fixedDuration = (end - start).toFixed(2);
        var newIntervalStr = fixedStart + "|==" + fixedDuration + "==|" + fixedEnd;
        str += newIntervalStr;
        if (currentTimeStr.length === 0 && end > currentTime) {
            var padBefore = str.length - Math.floor(newIntervalStr.length / 2);
            currentTimeStr = " ".repeat(padBefore) + ("^" + currentTime);
        }
        if (i < buffered.length - 1) {
            var nextStart = buffered.start(i + 1);
            var fixedDiff = (nextStart - end).toFixed(2);
            var holeStr = " ~" + fixedDiff + "~ ";
            str += holeStr;
            if (currentTimeStr.length === 0 && currentTime < nextStart) {
                var padBefore = str.length - Math.floor(holeStr.length / 2);
                currentTimeStr = " ".repeat(padBefore) + ("^" + currentTime);
            }
        }
    }
    if (currentTimeStr.length === 0) {
        currentTimeStr = " ".repeat(str.length) + ("^" + currentTime);
    }
    return str + "\n" + currentTimeStr;
}
export default createClock;

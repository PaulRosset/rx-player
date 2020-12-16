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
import { concat as observableConcat, defer as observableDefer, EMPTY, merge as observableMerge, of as observableOf, Subject, } from "rxjs";
import { exhaustMap, filter, ignoreElements, map, mergeMap, share, take, takeUntil, tap, } from "rxjs/operators";
import config from "../../../config";
import { MediaError } from "../../../errors";
import log from "../../../log";
import deferSubscriptions from "../../../utils/defer_subscriptions";
import { fromEvent } from "../../../utils/event_emitter";
import filterMap from "../../../utils/filter_map";
import SortedList from "../../../utils/sorted_list";
import WeakMapMemory from "../../../utils/weak_map_memory";
import { BufferGarbageCollector, } from "../../source_buffers";
import EVENTS from "../events_generators";
import PeriodStream from "../period";
import ActivePeriodEmitter from "./active_period_emitter";
import areStreamsComplete from "./are_streams_complete";
import getBlacklistedRanges from "./get_blacklisted_ranges";
var MAXIMUM_MAX_BUFFER_AHEAD = config.MAXIMUM_MAX_BUFFER_AHEAD, MAXIMUM_MAX_BUFFER_BEHIND = config.MAXIMUM_MAX_BUFFER_BEHIND;
/**
 * Create and manage the various Stream Observables needed for the content to
 * play:
 *
 *   - Create or dispose SourceBuffers depending on the chosen Adaptations.
 *
 *   - Push the right segments to those SourceBuffers depending on the user's
 *     preferences, the current position, the bandwidth, the decryption
 *     conditions...
 *
 *   - Concatenate Streams for adaptation from separate Periods at the right
 *     time, to allow smooth transitions between periods.
 *
 *   - Emit various events to notify of its health and issues
 *
 * Here multiple Streams can be created at the same time to allow smooth
 * transitions between periods.
 * To do this, we dynamically create or destroy Streams as they are needed.
 * @param {Object} content
 * @param {Observable} clock$ - Emit position information
 * @param {Object} abrManager - Emit bitrate estimates and best Representation
 * to play.
 * @param {Object} sourceBuffersStore - Will be used to lazily create
 * SourceBuffer instances associated with the current content.
 * @param {Object} segmentFetcherCreator - Allow to download segments.
 * @param {Object} options
 * @returns {Observable}
 */
export default function StreamOrchestrator(content, clock$, abrManager, sourceBuffersStore, segmentFetcherCreator, options) {
    var manifest = content.manifest, initialPeriod = content.initialPeriod;
    var maxBufferAhead$ = options.maxBufferAhead$, maxBufferBehind$ = options.maxBufferBehind$, wantedBufferAhead$ = options.wantedBufferAhead$;
    // Keep track of a unique BufferGarbageCollector created per
    // QueuedSourceBuffer.
    var garbageCollectors = new WeakMapMemory(function (qSourceBuffer) {
        var bufferType = qSourceBuffer.bufferType;
        var defaultMaxBehind = MAXIMUM_MAX_BUFFER_BEHIND[bufferType] != null ?
            MAXIMUM_MAX_BUFFER_BEHIND[bufferType] :
            Infinity;
        var defaultMaxAhead = MAXIMUM_MAX_BUFFER_AHEAD[bufferType] != null ?
            MAXIMUM_MAX_BUFFER_AHEAD[bufferType] :
            Infinity;
        return BufferGarbageCollector({
            queuedSourceBuffer: qSourceBuffer,
            clock$: clock$.pipe(map(function (tick) { return tick.currentTime; })),
            maxBufferBehind$: maxBufferBehind$
                .pipe(map(function (val) { return Math.min(val, defaultMaxBehind); })),
            maxBufferAhead$: maxBufferAhead$
                .pipe(map(function (val) { return Math.min(val, defaultMaxAhead); })),
        });
    });
    // trigger warnings when the wanted time is before or after the manifest's
    // segments
    var outOfManifest$ = clock$.pipe(filterMap(function (_a) {
        var currentTime = _a.currentTime, wantedTimeOffset = _a.wantedTimeOffset;
        var position = wantedTimeOffset + currentTime;
        if (position < manifest.getMinimumPosition()) {
            var warning = new MediaError("MEDIA_TIME_BEFORE_MANIFEST", "The current position is behind the " +
                "earliest time announced in the Manifest.");
            return EVENTS.warning(warning);
        }
        else if (position > manifest.getMaximumPosition()) {
            var warning = new MediaError("MEDIA_TIME_AFTER_MANIFEST", "The current position is after the latest " +
                "time announced in the Manifest.");
            return EVENTS.warning(warning);
        }
        return null;
    }, null));
    var bufferTypes = sourceBuffersStore.getBufferTypes();
    // Every PeriodStreams for every possible types
    var streamsArray = bufferTypes.map(function (bufferType) {
        return manageEveryStreams(bufferType, initialPeriod)
            .pipe(deferSubscriptions(), share());
    });
    // Emits the activePeriodChanged events every time the active Period changes.
    var activePeriodChanged$ = ActivePeriodEmitter(streamsArray).pipe(filter(function (period) { return period != null; }), map(function (period) {
        log.info("Stream: New active period", period);
        return EVENTS.activePeriodChanged(period);
    }));
    // Emits an "end-of-stream" event once every PeriodStream are complete.
    // Emits a 'resume-stream" when it's not
    var endOfStream$ = areStreamsComplete.apply(void 0, streamsArray).pipe(map(function (areComplete) {
        return areComplete ? EVENTS.endOfStream() : EVENTS.resumeStream();
    }));
    return observableMerge.apply(void 0, __spreadArrays(streamsArray, [activePeriodChanged$,
        endOfStream$,
        outOfManifest$]));
    /**
     * Manage creation and removal of Streams for every Periods for a given type.
     *
     * Works by creating consecutive Streams through the
     * `manageConsecutivePeriodStreams` function, and restarting it when the clock
     * goes out of the bounds of these Streams.
     * @param {string} bufferType - e.g. "audio" or "video"
     * @param {Period} basePeriod - Initial Period downloaded.
     * @returns {Observable}
     */
    function manageEveryStreams(bufferType, basePeriod) {
        // Each Period for which there is currently a Stream, chronologically
        var periodList = new SortedList(function (a, b) { return a.start - b.start; });
        var destroyStreams$ = new Subject();
        // When set to `true`, all the currently active PeriodStream will be destroyed
        // and re-created from the new current position if we detect it to be out of
        // their bounds.
        // This is set to false when we're in the process of creating the first
        // PeriodStream, to avoid interferences while no PeriodStream is available.
        var enableOutOfBoundsCheck = false;
        /**
         * @param {Object} period
         * @returns {Observable}
         */
        function launchConsecutiveStreamsForPeriod(period) {
            return manageConsecutivePeriodStreams(bufferType, period, destroyStreams$).pipe(filterMap(function (message) {
                switch (message.type) {
                    case "needs-media-source-reload":
                        // Only reload the MediaSource when the more immediately required
                        // Period is the one asking for it
                        var firstPeriod = periodList.head();
                        if (firstPeriod === undefined ||
                            firstPeriod.id !== message.value.period.id) {
                            return null;
                        }
                        break;
                    case "periodStreamReady":
                        enableOutOfBoundsCheck = true;
                        periodList.add(message.value.period);
                        break;
                    case "periodStreamCleared":
                        periodList.removeElement(message.value.period);
                        break;
                }
                return message;
            }, null), share());
        }
        /**
         * Returns true if the given time is either:
         *   - less than the start of the chronologically first Period
         *   - more than the end of the chronologically last Period
         * @param {number} time
         * @returns {boolean}
         */
        function isOutOfPeriodList(time) {
            var head = periodList.head();
            var last = periodList.last();
            if (head == null || last == null) { // if no period
                return true;
            }
            return head.start > time ||
                (last.end == null ? Infinity :
                    last.end) < time;
        }
        // Restart the current Stream when the wanted time is in another period
        // than the ones already considered
        var restartStreamsWhenOutOfBounds$ = clock$.pipe(filter(function (_a) {
            var currentTime = _a.currentTime, wantedTimeOffset = _a.wantedTimeOffset;
            return enableOutOfBoundsCheck &&
                manifest.getPeriodForTime(wantedTimeOffset +
                    currentTime) !== undefined &&
                isOutOfPeriodList(wantedTimeOffset + currentTime);
        }), tap(function (_a) {
            var currentTime = _a.currentTime, wantedTimeOffset = _a.wantedTimeOffset;
            log.info("SO: Current position out of the bounds of the active periods," +
                "re-creating Streams.", bufferType, currentTime + wantedTimeOffset);
            enableOutOfBoundsCheck = false;
            destroyStreams$.next();
        }), mergeMap(function (_a) {
            var currentTime = _a.currentTime, wantedTimeOffset = _a.wantedTimeOffset;
            var newInitialPeriod = manifest
                .getPeriodForTime(currentTime + wantedTimeOffset);
            if (newInitialPeriod == null) {
                throw new MediaError("MEDIA_TIME_NOT_FOUND", "The wanted position is not found in the Manifest.");
            }
            return launchConsecutiveStreamsForPeriod(newInitialPeriod);
        }));
        var handleDecipherabilityUpdate$ = fromEvent(manifest, "decipherabilityUpdate")
            .pipe(mergeMap(function (updates) {
            var sourceBufferStatus = sourceBuffersStore.getStatus(bufferType);
            var hasType = updates.some(function (update) { return update.adaptation.type === bufferType; });
            if (!hasType || sourceBufferStatus.type !== "initialized") {
                return EMPTY; // no need to stop the current Streams.
            }
            var queuedSourceBuffer = sourceBufferStatus.value;
            var rangesToClean = getBlacklistedRanges(queuedSourceBuffer, updates);
            enableOutOfBoundsCheck = false;
            destroyStreams$.next();
            return observableConcat.apply(void 0, __spreadArrays(rangesToClean.map(function (_a) {
                var start = _a.start, end = _a.end;
                return queuedSourceBuffer.removeBuffer(start, end).pipe(ignoreElements());
            }), [clock$.pipe(take(1), mergeMap(function (lastTick) {
                    return observableConcat(observableOf(EVENTS.needsDecipherabilityFlush(lastTick)), observableDefer(function () {
                        var lastPosition = lastTick.currentTime + lastTick.wantedTimeOffset;
                        var newInitialPeriod = manifest.getPeriodForTime(lastPosition);
                        if (newInitialPeriod == null) {
                            throw new MediaError("MEDIA_TIME_NOT_FOUND", "The wanted position is not found in the Manifest.");
                        }
                        return launchConsecutiveStreamsForPeriod(newInitialPeriod);
                    }));
                }))]));
        }));
        return observableMerge(restartStreamsWhenOutOfBounds$, handleDecipherabilityUpdate$, launchConsecutiveStreamsForPeriod(basePeriod));
    }
    /**
     * Create lazily consecutive PeriodStreams:
     *
     * It first creates the PeriodStream for `basePeriod` and - once it becomes
     * full - automatically creates the next chronological one.
     * This process repeats until the PeriodStream linked to the last Period is
     * full.
     *
     * If an "old" PeriodStream becomes active again, it destroys all PeriodStream
     * coming after it (from the last chronological one to the first).
     *
     * To clean-up PeriodStreams, each one of them are also automatically
     * destroyed once the clock anounce a time superior or equal to the end of
     * the concerned Period.
     *
     * A "periodStreamReady" event is sent each times a new PeriodStream is
     * created. The first one (for `basePeriod`) should be sent synchronously on
     * subscription.
     *
     * A "periodStreamCleared" event is sent each times a PeriodStream is
     * destroyed.
     * @param {string} bufferType - e.g. "audio" or "video"
     * @param {Period} basePeriod - Initial Period downloaded.
     * @param {Observable} destroy$ - Emit when/if all created Streams from this
     * point should be destroyed.
     * @returns {Observable}
     */
    function manageConsecutivePeriodStreams(bufferType, basePeriod, destroy$) {
        log.info("SO: Creating new Stream for", bufferType, basePeriod);
        // Emits the Period of the next Period Stream when it can be created.
        var createNextPeriodStream$ = new Subject();
        // Emits when the Streams for the next Periods should be destroyed, if
        // created.
        var destroyNextStreams$ = new Subject();
        // Emits when the current position goes over the end of the current Stream.
        var endOfCurrentStream$ = clock$
            .pipe(filter(function (_a) {
            var currentTime = _a.currentTime, wantedTimeOffset = _a.wantedTimeOffset;
            return basePeriod.end != null &&
                (currentTime + wantedTimeOffset) >= basePeriod.end;
        }));
        // Create Period Stream for the next Period.
        var nextPeriodStream$ = createNextPeriodStream$
            .pipe(exhaustMap(function (nextPeriod) {
            return manageConsecutivePeriodStreams(bufferType, nextPeriod, destroyNextStreams$);
        }));
        // Allows to destroy each created Stream, from the newest to the oldest,
        // once destroy$ emits.
        var destroyAll$ = destroy$.pipe(take(1), tap(function () {
            // first complete createNextStream$ to allow completion of the
            // nextPeriodStream$ observable once every further Streams have been
            // cleared.
            createNextPeriodStream$.complete();
            // emit destruction signal to the next Stream first
            destroyNextStreams$.next();
            destroyNextStreams$.complete(); // we do not need it anymore
        }), share() // share side-effects
        );
        // Will emit when the current Stream should be destroyed.
        var killCurrentStream$ = observableMerge(endOfCurrentStream$, destroyAll$);
        var periodStream$ = PeriodStream({ abrManager: abrManager,
            bufferType: bufferType,
            clock$: clock$,
            content: { manifest: manifest, period: basePeriod },
            garbageCollectors: garbageCollectors,
            segmentFetcherCreator: segmentFetcherCreator,
            sourceBuffersStore: sourceBuffersStore,
            options: options,
            wantedBufferAhead$: wantedBufferAhead$, }).pipe(mergeMap(function (evt) {
            var type = evt.type;
            if (type === "full-stream") {
                var nextPeriod = manifest.getPeriodAfter(basePeriod);
                if (nextPeriod == null) {
                    return observableOf(EVENTS.streamComplete(bufferType));
                }
                else {
                    // current Stream is full, create the next one if not
                    createNextPeriodStream$.next(nextPeriod);
                }
            }
            else if (type === "active-stream") {
                // current Stream is active, destroy next Stream if created
                destroyNextStreams$.next();
            }
            return observableOf(evt);
        }), share());
        // Stream for the current Period.
        var currentStream$ = observableConcat(periodStream$.pipe(takeUntil(killCurrentStream$)), observableOf(EVENTS.periodStreamCleared(bufferType, basePeriod))
            .pipe(tap(function () {
            log.info("SO: Destroying Stream for", bufferType, basePeriod);
        })));
        return observableMerge(currentStream$, nextPeriodStream$, destroyAll$.pipe(ignoreElements()));
    }
}

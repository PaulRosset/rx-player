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
import { combineLatest as observableCombineLatest, concat as observableConcat, EMPTY, interval, of as observableOf, } from "rxjs";
import { distinctUntilChanged, ignoreElements, map, mergeMap, pairwise, scan, startWith, switchMap, tap, } from "rxjs/operators";
import config from "../../../config";
import { fromEvent } from "../../../utils/event_emitter";
import refreshScheduledEventsList from "./refresh_scheduled_events_list";
var STREAM_EVENT_EMITTER_POLL_INTERVAL = config.STREAM_EVENT_EMITTER_POLL_INTERVAL;
/**
 * Tells if a stream event has a duration
 * @param {Object} evt
 * @returns {Boolean}
 */
function isFiniteStreamEvent(evt) {
    return evt.end !== undefined;
}
/**
 * Get events from manifest and emit each time an event has to be emitted
 * @param {Object} manifest
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
function streamEventsEmitter(manifest, mediaElement, clock$) {
    var eventsBeingPlayed = new WeakMap();
    var lastScheduledEvents = [];
    var scheduledEvents$ = fromEvent(manifest, "manifestUpdate").pipe(startWith(null), scan(function (oldScheduledEvents) {
        return refreshScheduledEventsList(oldScheduledEvents, manifest);
    }, []));
    /**
     * Examine playback situation from clock ticks to emit stream events and
     * prepare set onExit callbacks if needed.
     * @param {Array.<Object>} scheduledEvents
     * @param {Object} oldTick
     * @param {Object} newTick
     * @returns {Observable}
     */
    function emitStreamEvents$(scheduledEvents, oldClockTick, newClockTick) {
        var previousTime = oldClockTick.currentTime;
        var isSeeking = newClockTick.isSeeking, currentTime = newClockTick.currentTime;
        var eventsToSend = [];
        var eventsToExit = [];
        for (var i = 0; i < scheduledEvents.length; i++) {
            var event_1 = scheduledEvents[i];
            var start = event_1.start;
            var end = isFiniteStreamEvent(event_1) ? event_1.end :
                undefined;
            var isBeingPlayed = eventsBeingPlayed.has(event_1);
            if (isBeingPlayed) {
                if (start > currentTime ||
                    (end !== undefined && currentTime >= end)) {
                    if (isFiniteStreamEvent(event_1)) {
                        eventsToExit.push(event_1.publicEvent);
                    }
                    eventsBeingPlayed.delete(event_1);
                }
            }
            else if (start <= currentTime &&
                end !== undefined &&
                currentTime < end) {
                eventsToSend.push({ type: "stream-event",
                    value: event_1.publicEvent });
                eventsBeingPlayed.set(event_1, true);
            }
            else if (previousTime < start &&
                currentTime >= (end !== null && end !== void 0 ? end : start)) {
                if (isSeeking) {
                    eventsToSend.push({ type: "stream-event-skip",
                        value: event_1.publicEvent });
                }
                else {
                    eventsToSend.push({ type: "stream-event",
                        value: event_1.publicEvent });
                    if (isFiniteStreamEvent(event_1)) {
                        eventsToExit.push(event_1.publicEvent);
                    }
                }
            }
        }
        return observableConcat(eventsToSend.length > 0 ? observableOf.apply(void 0, eventsToSend) :
            EMPTY, eventsToExit.length > 0 ? observableOf.apply(void 0, eventsToExit).pipe(tap(function (evt) {
            if (typeof evt.onExit === "function") {
                evt.onExit();
            }
        }), ignoreElements()) : EMPTY);
    }
    /**
     * This pipe allows to control wether the polling should occur, if there
     * are scheduledEvents, or not.
     */
    return scheduledEvents$.pipe(tap(function (scheduledEvents) { return lastScheduledEvents = scheduledEvents; }), map(function (evt) { return evt.length > 0; }), distinctUntilChanged(), switchMap(function (hasEvents) {
        if (!hasEvents) {
            return EMPTY;
        }
        return observableCombineLatest([
            interval(STREAM_EVENT_EMITTER_POLL_INTERVAL).pipe(startWith(null)),
            clock$,
        ]).pipe(map(function (_a) {
            var _ = _a[0], clockTick = _a[1];
            var seeking = clockTick.seeking;
            return { isSeeking: seeking,
                currentTime: mediaElement.currentTime };
        }), pairwise(), mergeMap(function (_a) {
            var oldTick = _a[0], newTick = _a[1];
            return emitStreamEvents$(lastScheduledEvents, oldTick, newTick);
        }));
    }));
}
export default streamEventsEmitter;

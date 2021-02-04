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
import { EMPTY, merge as observableMerge, of as observableOf, Subject, throwError, } from "rxjs";
import { filter, finalize, ignoreElements, mergeMap, takeUntil, } from "rxjs/operators";
import { MediaError } from "../../errors";
import log from "../../log";
import SegmentBuffersStore from "../segment_buffers";
import StreamOrchestrator from "../stream";
import { setDurationToMediaSource } from "./create_media_source";
import createStreamClock from "./create_stream_clock";
import { maintainEndOfStream } from "./end_of_stream";
import EVENTS from "./events_generators";
import seekAndLoadOnMediaEvents from "./initial_seek_and_play";
import StallAvoider from "./stall_avoider";
import streamEventsEmitter from "./stream_events_emitter";
import updatePlaybackRate from "./update_playback_rate";
/**
 * Returns a function allowing to load or reload the content in arguments into
 * a single or multiple MediaSources.
 * @param {Object} args
 * @returns {Function}
 */
export default function createMediaSourceLoader(_a) {
    var mediaElement = _a.mediaElement, manifest = _a.manifest, clock$ = _a.clock$, speed$ = _a.speed$, bufferOptions = _a.bufferOptions, abrManager = _a.abrManager, segmentFetcherCreator = _a.segmentFetcherCreator;
    /**
     * Load the content on the given MediaSource.
     * @param {MediaSource} mediaSource
     * @param {number} initialTime
     * @param {boolean} autoPlay
     */
    return function loadContentOnMediaSource(mediaSource, initialTime, autoPlay) {
        var _a;
        // TODO Update the duration if it evolves?
        var duration = manifest.isLive ? Infinity :
            manifest.getMaximumPosition();
        setDurationToMediaSource(mediaSource, duration);
        var initialPeriod = (_a = manifest.getPeriodForTime(initialTime)) !== null && _a !== void 0 ? _a : manifest.getNextPeriod(initialTime);
        if (initialPeriod === undefined) {
            var error = new MediaError("MEDIA_STARTING_TIME_NOT_FOUND", "Wanted starting time not found in the Manifest.");
            return throwError(error);
        }
        /** Interface to create media buffers for loaded segments. */
        var segmentBuffersStore = new SegmentBuffersStore(mediaElement, mediaSource);
        var _b = seekAndLoadOnMediaEvents({ clock$: clock$,
            mediaElement: mediaElement, startTime: initialTime,
            mustAutoPlay: autoPlay,
            isDirectfile: false }), seek$ = _b.seek$, load$ = _b.load$;
        var initialPlay$ = load$.pipe(filter(function (evt) { return evt !== "not-loaded-metadata"; }));
        var streamEvents$ = initialPlay$.pipe(mergeMap(function () { return streamEventsEmitter(manifest, mediaElement, clock$); }));
        var streamClock$ = createStreamClock(clock$, { autoPlay: autoPlay,
            initialPlay$: initialPlay$, initialSeek$: seek$, manifest: manifest,
            speed$: speed$, startTime: initialTime });
        /** Cancel endOfStream calls when streams become active again. */
        var cancelEndOfStream$ = new Subject();
        /** Emits discontinuities detected by the StreamOrchestrator. */
        var discontinuityUpdate$ = new Subject();
        // Creates Observable which will manage every Stream for the given Content.
        var streams$ = StreamOrchestrator({ manifest: manifest, initialPeriod: initialPeriod }, streamClock$, abrManager, segmentBuffersStore, segmentFetcherCreator, bufferOptions).pipe(mergeMap(function (evt) {
            switch (evt.type) {
                case "end-of-stream":
                    log.debug("Init: end-of-stream order received.");
                    return maintainEndOfStream(mediaSource).pipe(ignoreElements(), takeUntil(cancelEndOfStream$));
                case "resume-stream":
                    log.debug("Init: resume-stream order received.");
                    cancelEndOfStream$.next(null);
                    return EMPTY;
                case "stream-status":
                    var _a = evt.value, period = _a.period, bufferType = _a.bufferType, imminentDiscontinuity = _a.imminentDiscontinuity, position = _a.position;
                    discontinuityUpdate$.next({ period: period,
                        bufferType: bufferType, discontinuity: imminentDiscontinuity, position: position });
                    return EMPTY;
                default:
                    return observableOf(evt);
            }
        }));
        /**
         * On subscription, keep the playback speed synchronized to the speed set by
         * the user on the media element and force a speed of `0` when the buffer is
         * empty, so it can build back buffer.
         */
        var playbackRate$ = updatePlaybackRate(mediaElement, speed$, clock$, { pauseWhenStalled: true })
            .pipe(ignoreElements());
        /**
         * Observable trying to avoid various stalling situations, emitting "stalled"
         * events when it cannot, as well as "unstalled" events when it get out of one.
         */
        var stallAvoider$ = StallAvoider(clock$, mediaElement, manifest, discontinuityUpdate$);
        var loadedEvent$ = load$
            .pipe(mergeMap(function (evt) {
            if (evt === "autoplay-blocked") {
                var error = new MediaError("MEDIA_ERR_BLOCKED_AUTOPLAY", "Cannot trigger auto-play automatically: " +
                    "your browser does not allow it.");
                return observableOf(EVENTS.warning(error), EVENTS.loaded(segmentBuffersStore));
            }
            else if (evt === "not-loaded-metadata") {
                var error = new MediaError("MEDIA_ERR_NOT_LOADED_METADATA", "Cannot load automatically: your browser " +
                    "falsely announced having loaded the content.");
                return observableOf(EVENTS.warning(error));
            }
            log.debug("Init: The current content is loaded.");
            return observableOf(EVENTS.loaded(segmentBuffersStore));
        }));
        return observableMerge(loadedEvent$, playbackRate$, stallAvoider$, streams$, streamEvents$).pipe(finalize(function () {
            // clean-up every created SegmentBuffers
            segmentBuffersStore.disposeAll();
        }));
    };
}

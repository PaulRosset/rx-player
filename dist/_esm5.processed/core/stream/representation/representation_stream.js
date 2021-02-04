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
import nextTick from "next-tick";
import { combineLatest as observableCombineLatest, concat as observableConcat, defer as observableDefer, EMPTY, merge as observableMerge, of as observableOf, ReplaySubject, Subject, } from "rxjs";
import { finalize, ignoreElements, map, mergeMap, share, startWith, switchMap, take, takeWhile, withLatestFrom, } from "rxjs/operators";
import log from "../../../log";
import assertUnreachable from "../../../utils/assert_unreachable";
import objectAssign from "../../../utils/object_assign";
import EVENTS from "../events_generators";
import getBufferStatus from "./get_buffer_status";
import getSegmentPriority from "./get_segment_priority";
import pushInitSegment from "./push_init_segment";
import pushMediaSegment from "./push_media_segment";
/**
 * Build up buffer for a single Representation.
 *
 * Download and push segments linked to the given Representation according
 * to what is already in the SegmentBuffer and where the playback currently is.
 *
 * Multiple RepresentationStream observables can run on the same SegmentBuffer.
 * This allows for example smooth transitions between multiple periods.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function RepresentationStream(_a) {
    var bufferGoal$ = _a.bufferGoal$, clock$ = _a.clock$, content = _a.content, fastSwitchThreshold$ = _a.fastSwitchThreshold$, segmentBuffer = _a.segmentBuffer, segmentFetcher = _a.segmentFetcher, terminate$ = _a.terminate$;
    var manifest = content.manifest, period = content.period, adaptation = content.adaptation, representation = content.representation;
    var bufferType = adaptation.type;
    var initSegment = representation.index.getInitSegment();
    /**
     * Saved initialization segment state for this representation.
     * `null` if the initialization segment hasn't been loaded yet.
     */
    var initSegmentObject = initSegment === null ? { initializationData: null,
        segmentProtections: [],
        initTimescale: undefined } :
        null;
    /** Segments queued for download in this RepresentationStream. */
    var downloadQueue = [];
    /** Emit to start/restart a downloading Queue. */
    var startDownloadingQueue$ = new ReplaySubject(1);
    /** Emit when the RepresentationStream asks to re-check which segments are needed. */
    var reCheckNeededSegments$ = new Subject();
    /**
     * Keep track of the information about the pending segment request.
     * `null` if no segment request is pending in that RepresentationStream.
     */
    var currentSegmentRequest = null;
    var status$ = observableCombineLatest([
        clock$,
        bufferGoal$,
        terminate$.pipe(take(1), startWith(null)),
        reCheckNeededSegments$.pipe(startWith(undefined))
    ]).pipe(withLatestFrom(fastSwitchThreshold$), mergeMap(function (_a) {
        var _b = _a[0], tick = _b[0], bufferGoal = _b[1], terminate = _b[2], fastSwitchThreshold = _a[1];
        var status = getBufferStatus(content, tick, fastSwitchThreshold, bufferGoal, segmentBuffer);
        var neededSegments = status.neededSegments;
        // Add initialization segment if required
        if (!representation.index.isInitialized()) {
            if (initSegment === null) {
                log.warn("Stream: Uninitialized index without an initialization segment");
            }
            else if (initSegmentObject !== null) {
                log.warn("Stream: Uninitialized index with an already loaded " +
                    "initialization segment");
            }
            else {
                neededSegments.unshift({ segment: initSegment,
                    priority: getSegmentPriority(period.start, tick) });
            }
        }
        else if (neededSegments.length > 0 &&
            initSegment !== null &&
            initSegmentObject === null) {
            // prepend initialization segment
            var initSegmentPriority = neededSegments[0].priority;
            neededSegments.unshift({ segment: initSegment,
                priority: initSegmentPriority });
        }
        var mostNeededSegment = neededSegments[0];
        if (terminate !== null) {
            downloadQueue = [];
            if (terminate.urgent) {
                log.debug("Stream: urgent termination request, terminate.", bufferType);
                startDownloadingQueue$.complete(); // complete the downloading queue
                return observableOf(EVENTS.streamTerminating());
            }
            else if (currentSegmentRequest === null) {
                log.debug("Stream: no request, terminate.", bufferType);
                startDownloadingQueue$.complete(); // complete the downloading queue
                return observableOf(EVENTS.streamTerminating());
            }
            else if (mostNeededSegment === undefined ||
                currentSegmentRequest.segment.id !== mostNeededSegment.segment.id) {
                log.debug("Stream: cancel request and terminate.", bufferType);
                startDownloadingQueue$.next(); // interrupt the current request
                startDownloadingQueue$.complete(); // complete the downloading queue
                return observableOf(EVENTS.streamTerminating());
            }
            else if (currentSegmentRequest.priority !== mostNeededSegment.priority) {
                var request$ = currentSegmentRequest.request$;
                currentSegmentRequest.priority = mostNeededSegment.priority;
                segmentFetcher.updatePriority(request$, mostNeededSegment.priority);
            }
            log.debug("Stream: terminate after request.", bufferType);
        }
        else if (mostNeededSegment === undefined) {
            if (currentSegmentRequest !== null) {
                log.debug("Stream: interrupt segment request.", bufferType);
            }
            downloadQueue = [];
            startDownloadingQueue$.next(); // (re-)start with an empty queue
        }
        else if (currentSegmentRequest === null) {
            log.debug("Stream: start downloading queue.", bufferType);
            downloadQueue = neededSegments;
            startDownloadingQueue$.next(); // restart the queue
        }
        else if (currentSegmentRequest.segment.id !== mostNeededSegment.segment.id) {
            log.debug("Stream: restart download queue.", bufferType);
            downloadQueue = neededSegments;
            startDownloadingQueue$.next(); // restart the queue
        }
        else if (currentSegmentRequest.priority !== mostNeededSegment.priority) {
            log.debug("Stream: update request priority.", bufferType);
            var request$ = currentSegmentRequest.request$;
            currentSegmentRequest.priority = mostNeededSegment.priority;
            segmentFetcher.updatePriority(request$, mostNeededSegment.priority);
        }
        else {
            log.debug("Stream: update downloading queue", bufferType);
            // Update the previous queue to be all needed segments but the first one,
            // for which a request is already pending
            downloadQueue = neededSegments.slice().splice(1, neededSegments.length);
        }
        var bufferStatusEvt = observableOf({ type: "stream-status",
            value: { period: period, position: tick.position, bufferType: bufferType, imminentDiscontinuity: status.imminentDiscontinuity,
                hasFinishedLoading: status.hasFinishedLoading,
                neededSegments: status.neededSegments } });
        return status.shouldRefreshManifest ?
            observableConcat(observableOf(EVENTS.needsManifestRefresh()), bufferStatusEvt) :
            bufferStatusEvt;
    }), takeWhile(function (e) { return e.type !== "stream-terminating"; }, true));
    /**
     * Stream Queue:
     *   - download every segments queued sequentially
     *   - when a segment is loaded, append it to the SegmentBuffer
     */
    var streamQueue$ = startDownloadingQueue$.pipe(switchMap(function () { return downloadQueue.length > 0 ? loadSegmentsFromQueue() : EMPTY; }), mergeMap(onLoaderEvent));
    return observableMerge(status$, streamQueue$).pipe(share());
    /**
     * Request every Segment in the ``downloadQueue`` on subscription.
     * Emit the data of a segment when a request succeeded.
     *
     * Important side-effects:
     *   - Mutates `currentSegmentRequest` when doing and finishing a request.
     *   - Will emit from reCheckNeededSegments$ Subject when it's done.
     *
     * Might emit warnings when a request is retried.
     *
     * Throws when the request will not be retried (configuration or un-retryable
     * error).
     * @returns {Observable}
     */
    function loadSegmentsFromQueue() {
        var requestNextSegment$ = observableDefer(function () {
            var currentNeededSegment = downloadQueue.shift();
            if (currentNeededSegment === undefined) {
                nextTick(function () { reCheckNeededSegments$.next(); });
                return EMPTY;
            }
            var segment = currentNeededSegment.segment, priority = currentNeededSegment.priority;
            var context = { manifest: manifest, period: period, adaptation: adaptation, representation: representation, segment: segment };
            var request$ = segmentFetcher.createRequest(context, priority);
            currentSegmentRequest = { segment: segment, priority: priority, request$: request$ };
            return request$
                .pipe(mergeMap(function (evt) {
                switch (evt.type) {
                    case "warning":
                        return observableOf({ type: "retry",
                            value: { segment: segment, error: evt.value } });
                    case "chunk-complete":
                        currentSegmentRequest = null;
                        return observableOf({ type: "end-of-segment",
                            value: { segment: segment } });
                    case "interrupted":
                        log.info("Stream: segment request interrupted temporarly.", segment);
                        return EMPTY;
                    case "chunk":
                        var initTimescale = initSegmentObject === null || initSegmentObject === void 0 ? void 0 : initSegmentObject.initTimescale;
                        return evt.parse(initTimescale).pipe(map(function (parserResponse) {
                            return objectAssign({ segment: segment }, parserResponse);
                        }));
                    case "ended":
                        return requestNextSegment$;
                    default:
                        assertUnreachable(evt);
                }
            }));
        });
        return requestNextSegment$
            .pipe(finalize(function () { currentSegmentRequest = null; }));
    }
    /**
     * React to event from `loadSegmentsFromQueue`.
     * @param {Object} evt
     * @returns {Observable}
     */
    function onLoaderEvent(evt) {
        var _a;
        switch (evt.type) {
            case "retry":
                return observableConcat(observableOf({ type: "warning", value: evt.value.error }), observableDefer(function () {
                    var retriedSegment = evt.value.segment;
                    var index = representation.index;
                    if (index.isSegmentStillAvailable(retriedSegment) === false) {
                        reCheckNeededSegments$.next();
                    }
                    else if (index.canBeOutOfSyncError(evt.value.error, retriedSegment)) {
                        return observableOf(EVENTS.manifestMightBeOufOfSync());
                    }
                    return EMPTY; // else, ignore.
                }));
            case "parsed-init-segment":
                initSegmentObject = evt.value;
                var protectedEvents$ = observableOf.apply(void 0, evt.value.segmentProtections.map(function (segmentProt) {
                    return EVENTS.protectedSegment(segmentProt);
                }));
                var pushEvent$ = pushInitSegment({ clock$: clock$,
                    content: content, segment: evt.segment,
                    segmentData: evt.value.initializationData, segmentBuffer: segmentBuffer });
                return observableMerge(protectedEvents$, pushEvent$);
            case "parsed-segment":
                var initSegmentData = (_a = initSegmentObject === null || initSegmentObject === void 0 ? void 0 : initSegmentObject.initializationData) !== null && _a !== void 0 ? _a : null;
                return pushMediaSegment({ clock$: clock$,
                    content: content,
                    initSegmentData: initSegmentData, parsedSegment: evt.value,
                    segment: evt.segment, segmentBuffer: segmentBuffer });
            case "end-of-segment": {
                var segment = evt.value.segment;
                return segmentBuffer.endOfSegment(objectAssign({ segment: segment }, content))
                    .pipe(ignoreElements());
            }
            default:
                assertUnreachable(evt);
        }
    }
}

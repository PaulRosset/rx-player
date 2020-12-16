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
 * This file allows to create `AdaptationStream`s.
 *
 * An `AdaptationStream` downloads and push segment for a single Adaptation
 * (e.g.  a single audio, video or text track).
 * It chooses which Representation to download mainly thanks to the
 * ABRManager, and orchestrates a RepresentationStream, which will download and
 * push segments corresponding to a chosen Representation.
 */
import { BehaviorSubject, concat as observableConcat, defer as observableDefer, EMPTY, merge as observableMerge, of as observableOf, } from "rxjs";
import { catchError, distinctUntilChanged, exhaustMap, filter, map, mergeMap, share, take, tap, } from "rxjs/operators";
import { formatError } from "../../../errors";
import log from "../../../log";
import deferSubscriptions from "../../../utils/defer_subscriptions";
import EVENTS from "../events_generators";
import RepresentationStream from "../representation";
import createRepresentationEstimator from "./create_representation_estimator";
/**
 * Create new AdaptationStream Observable, which task will be to download the
 * media data for a given Adaptation (i.e. "track").
 *
 * It will rely on the ABRManager to choose at any time the best Representation
 * for this Adaptation and then run the logic to download and push the
 * corresponding segments in the SourceBuffer.
 *
 * After being subscribed to, it will start running and will emit various events
 * to report its current status.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function AdaptationStream(_a) {
    var abrManager = _a.abrManager, clock$ = _a.clock$, content = _a.content, options = _a.options, queuedSourceBuffer = _a.queuedSourceBuffer, segmentFetcherCreator = _a.segmentFetcherCreator, wantedBufferAhead$ = _a.wantedBufferAhead$;
    var directManualBitrateSwitching = options.manualBitrateSwitchingMode === "direct";
    var manifest = content.manifest, period = content.period, adaptation = content.adaptation;
    /**
     * The buffer goal ratio base itself on the value given by `wantedBufferAhead`
     * to determine a more dynamic buffer goal for a given Representation.
     *
     * It can help in cases such as : the current browser has issues with
     * buffering and tells us that we should try to bufferize less data :
     * https://developers.google.com/web/updates/2017/10/quotaexceedederror
     */
    var bufferGoalRatioMap = {};
    var _b = createRepresentationEstimator(adaptation, abrManager, clock$), estimator$ = _b.estimator$, requestFeedback$ = _b.requestFeedback$, streamFeedback$ = _b.streamFeedback$;
    /** Allows the `RepresentationStream` to easily fetch media segments. */
    var segmentFetcher = segmentFetcherCreator.createSegmentFetcher(adaptation.type, requestFeedback$);
    /**
     * Emits each time an estimate is made through the `abrEstimate$` Observable,
     * starting with the last one.
     * This allows to easily rely on that value in inner Observables which might also
     * need the last already-considered value.
     */
    var lastEstimate$ = new BehaviorSubject(null);
    /** Emits abr estimates on Subscription. */
    var abrEstimate$ = estimator$.pipe(tap(function (estimate) { lastEstimate$.next(estimate); }), deferSubscriptions(), share());
    /** Emit at each bitrate estimate done by the ABRManager. */
    var bitrateEstimate$ = abrEstimate$.pipe(filter(function (_a) {
        var bitrate = _a.bitrate;
        return bitrate != null;
    }), distinctUntilChanged(function (old, current) { return old.bitrate === current.bitrate; }), map(function (_a) {
        var bitrate = _a.bitrate;
        log.debug("Stream: new " + adaptation.type + " bitrate estimate", bitrate);
        return EVENTS.bitrateEstimationChange(adaptation.type, bitrate);
    }));
    /** Recursively create `RepresentationStream`s according to the last estimate. */
    var representationStreams$ = abrEstimate$
        .pipe(exhaustMap(function (estimate, i) {
        return recursivelyCreateRepresentationStreams(estimate, i === 0);
    }));
    return observableMerge(representationStreams$, bitrateEstimate$);
    /**
     * Create `RepresentationStream`s starting with the Representation indicated in
     * `fromEstimate` argument.
     * Each time a new estimate is made, this function will create a new
     * `RepresentationStream` corresponding to that new estimate.
     * @param {Object} fromEstimate - The first estimate we should start with
     * @param {boolean} isFirstEstimate - Whether this is the first time we're
     * creating a RepresentationStream in the corresponding `AdaptationStream`.
     * This is important because manual quality switches might need a full reload
     * of the MediaSource _except_ if we are talking about the first quality chosen.
     * @returns {Observable}
     */
    function recursivelyCreateRepresentationStreams(fromEstimate, isFirstEstimate) {
        var representation = fromEstimate.representation;
        // A manual bitrate switch might need an immediate feedback.
        // To do that properly, we need to reload the MediaSource
        if (directManualBitrateSwitching &&
            fromEstimate.manual &&
            !isFirstEstimate) {
            return clock$.pipe(map(function (t) { return EVENTS.needsMediaSourceReload(period, t); }));
        }
        /**
         * Emit when the current RepresentationStream should be terminated to make
         * place for a new one (e.g. when switching quality).
         */
        var terminateCurrentStream$ = lastEstimate$.pipe(filter(function (newEstimate) { return newEstimate === null ||
            newEstimate.representation.id !== representation.id ||
            (newEstimate.manual && !fromEstimate.manual); }), take(1), map(function (newEstimate) {
            if (newEstimate === null) {
                log.info("Stream: urgent Representation termination", adaptation.type);
                return ({ urgent: true });
            }
            if (newEstimate.urgent) {
                log.info("Stream: urgent Representation switch", adaptation.type);
                return ({ urgent: true });
            }
            else {
                log.info("Stream: slow Representation switch", adaptation.type);
                return ({ urgent: false });
            }
        }));
        /**
         * Bitrate higher or equal to this value should not be replaced by segments of
         * better quality.
         * undefined means everything can potentially be replaced
         */
        var knownStableBitrate$ = lastEstimate$.pipe(map(function (estimate) { return estimate === null ? undefined :
            estimate.knownStableBitrate; }), distinctUntilChanged());
        var representationChange$ = observableOf(EVENTS.representationChange(adaptation.type, period, representation));
        return observableConcat(representationChange$, createRepresentationStream(representation, terminateCurrentStream$, knownStableBitrate$))
            .pipe(tap(function (evt) {
            if (evt.type === "representationChange" ||
                evt.type === "added-segment") {
                return streamFeedback$.next(evt);
            }
        }), mergeMap(function (evt) {
            if (evt.type === "stream-terminating") {
                var lastEstimate = lastEstimate$.getValue();
                if (lastEstimate === null) {
                    return EMPTY;
                }
                return recursivelyCreateRepresentationStreams(lastEstimate, false);
            }
            return observableOf(evt);
        }));
    }
    /**
     * Create and returns a new RepresentationStream Observable, linked to the
     * given Representation.
     * @param {Representation} representation
     * @returns {Observable}
     */
    function createRepresentationStream(representation, terminateCurrentStream$, knownStableBitrate$) {
        return observableDefer(function () {
            var oldBufferGoalRatio = bufferGoalRatioMap[representation.id];
            var bufferGoalRatio = oldBufferGoalRatio != null ? oldBufferGoalRatio :
                1;
            bufferGoalRatioMap[representation.id] = bufferGoalRatio;
            var bufferGoal$ = wantedBufferAhead$.pipe(map(function (wba) { return wba * bufferGoalRatio; }));
            log.info("Stream: changing representation", adaptation.type, representation);
            return RepresentationStream({ clock$: clock$,
                content: { representation: representation,
                    adaptation: adaptation,
                    period: period,
                    manifest: manifest },
                queuedSourceBuffer: queuedSourceBuffer,
                segmentFetcher: segmentFetcher, terminate$: terminateCurrentStream$, bufferGoal$: bufferGoal$,
                knownStableBitrate$: knownStableBitrate$ })
                .pipe(catchError(function (err) {
                var formattedError = formatError(err, {
                    defaultCode: "NONE",
                    defaultReason: "Unknown `RepresentationStream` error",
                });
                if (formattedError.code === "BUFFER_FULL_ERROR") {
                    var wantedBufferAhead = wantedBufferAhead$.getValue();
                    var lastBufferGoalRatio = bufferGoalRatio;
                    if (lastBufferGoalRatio <= 0.25 ||
                        wantedBufferAhead * lastBufferGoalRatio <= 2) {
                        throw formattedError;
                    }
                    bufferGoalRatioMap[representation.id] = lastBufferGoalRatio - 0.25;
                    return createRepresentationStream(representation, terminateCurrentStream$, knownStableBitrate$);
                }
                throw formattedError;
            }));
        });
    }
}

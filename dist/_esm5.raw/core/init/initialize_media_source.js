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
import { combineLatest as observableCombineLatest, EMPTY, merge as observableMerge, of as observableOf, Subject, } from "rxjs";
import { exhaustMap, filter, finalize, map, mapTo, mergeMap, share, shareReplay, startWith, switchMap, take, takeUntil, tap, } from "rxjs/operators";
import { shouldReloadMediaSourceOnDecipherabilityUpdate } from "../../compat";
import config from "../../config";
import log from "../../log";
import deferSubscriptions from "../../utils/defer_subscriptions";
import { fromEvent } from "../../utils/event_emitter";
import objectAssign from "../../utils/object_assign";
import throttle from "../../utils/rx-throttle";
import ABRManager from "../abr";
import { getCurrentKeySystem, } from "../eme";
import { createManifestFetcher, SegmentFetcherCreator, } from "../fetchers";
import createEMEManager from "./create_eme_manager";
import openMediaSource from "./create_media_source";
import EVENTS from "./events_generators";
import getInitialTime from "./get_initial_time";
import createMediaSourceLoader from "./load_on_media_source";
import manifestUpdateScheduler from "./manifest_update_scheduler";
import throwOnMediaError from "./throw_on_media_error";
var OUT_OF_SYNC_MANIFEST_REFRESH_DELAY = config.OUT_OF_SYNC_MANIFEST_REFRESH_DELAY;
/**
 * Begin content playback.
 *
 * Returns an Observable emitting notifications about the content lifecycle.
 * On subscription, it will perform every necessary tasks so the content can
 * play. Among them:
 *
 *   - Creates a MediaSource on the given `mediaElement` and attach to it the
 *     necessary SourceBuffer instances.
 *
 *   - download the content's Manifest and handle its refresh logic
 *
 *   - Perform EME management if needed
 *
 *   - ask for the choice of the wanted Adaptation through events (e.g. to
 *     choose a language)
 *
 *   - requests and push the right segments (according to the Adaptation choice,
 *     the current position, the network conditions etc.)
 *
 * This Observable will throw in the case where a fatal error (i.e. which has
 * stopped content playback) is encountered, with the corresponding error as a
 * payload.
 *
 * This Observable will never complete, it will always run until it is
 * unsubscribed from.
 * Unsubscription will stop playback and reset the corresponding state.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function InitializeOnMediaSource(_a) {
    var adaptiveOptions = _a.adaptiveOptions, autoPlay = _a.autoPlay, bufferOptions = _a.bufferOptions, clock$ = _a.clock$, keySystems = _a.keySystems, lowLatencyMode = _a.lowLatencyMode, manifestUpdateUrl = _a.manifestUpdateUrl, mediaElement = _a.mediaElement, minimumManifestUpdateInterval = _a.minimumManifestUpdateInterval, networkConfig = _a.networkConfig, speed$ = _a.speed$, startAt = _a.startAt, textTrackOptions = _a.textTrackOptions, transportPipelines = _a.transportPipelines, url = _a.url;
    var offlineRetry = networkConfig.offlineRetry, segmentRetry = networkConfig.segmentRetry, manifestRetry = networkConfig.manifestRetry;
    var manifestFetcher = createManifestFetcher(transportPipelines, { lowLatencyMode: lowLatencyMode, maxRetryRegular: manifestRetry,
        maxRetryOffline: offlineRetry });
    /**
     * Fetch and parse the manifest from the URL given.
     * Throttled to avoid doing multiple simultaneous requests.
     */
    var fetchManifest = throttle(function (manifestURL, options) {
        return manifestFetcher.fetch(manifestURL).pipe(mergeMap(function (response) { return response.type === "warning" ?
            observableOf(response) : // bubble-up warnings
            response.parse(options); }), share());
    });
    /** Interface used to download segments. */
    var segmentFetcherCreator = new SegmentFetcherCreator(transportPipelines, { lowLatencyMode: lowLatencyMode, maxRetryOffline: offlineRetry,
        maxRetryRegular: segmentRetry });
    /** Choose the right "Representation" for a given "Adaptation". */
    var abrManager = new ABRManager(adaptiveOptions);
    /**
     * Create and open a new MediaSource object on the given media element on
     * subscription.
     * The MediaSource will be closed on unsubscription.
     */
    var openMediaSource$ = openMediaSource(mediaElement).pipe(shareReplay({ refCount: true }));
    /** Send content protection data to the `EMEManager`. */
    var protectedSegments$ = new Subject();
    /** Create `EMEManager`, an observable which will handle content DRM. */
    var emeManager$ = createEMEManager(mediaElement, keySystems, protectedSegments$).pipe(
    // Because multiple Observables here depend on this Observable as a source,
    // we prefer deferring Subscription until those Observables are themselves
    // all subscribed to.
    // This is needed because `emeManager$` might send events synchronously
    // on subscription. In that case, it might communicate those events directly
    // after the first Subscription is done, making the next subscription miss
    // out on those events, even if that second subscription is done
    // synchronously after the first one.
    // By calling `deferSubscriptions`, we ensure that subscription to
    // `emeManager$` effectively starts after a very short delay, thus
    // ensuring that no such race condition can occur.
    deferSubscriptions(), share());
    /**
     * Translate errors coming from the media element into RxPlayer errors
     * through a throwing Observable.
     */
    var mediaError$ = throwOnMediaError(mediaElement);
    /** Do the first Manifest request. */
    var initialManifestRequest$ = fetchManifest(url, { previousManifest: null,
        unsafeMode: false }).pipe(
    // Defer subscription and share for the same reasons than `openMediaSource$`
    deferSubscriptions(), share());
    var initialManifestRequestWarnings$ = initialManifestRequest$
        .pipe(filter(function (evt) { return evt.type === "warning"; }));
    var initialManifest$ = initialManifestRequest$
        .pipe(filter(function (evt) { return evt.type === "parsed"; }));
    /**
     * Wait for the MediaKeys to have been created before
     * opening MediaSource, and ask EME to attach MediaKeys.
     */
    var prepareMediaSource$ = emeManager$.pipe(mergeMap(function (evt) {
        switch (evt.type) {
            case "eme-disabled":
            case "attached-media-keys":
                return observableOf(undefined);
            case "created-media-keys":
                return openMediaSource$.pipe(mergeMap(function () {
                    evt.value.attachMediaKeys$.next();
                    if (evt.value.mediaKeysInfos.keySystemOptions
                        .disableMediaKeysAttachmentLock === true) {
                        return observableOf(undefined);
                    }
                    // wait for "attached-media-keys"
                    return EMPTY;
                }));
            default:
                return EMPTY;
        }
    }), take(1), exhaustMap(function () { return openMediaSource$; }));
    /** Load and play the content asked. */
    var loadContent$ = observableCombineLatest([initialManifest$,
        prepareMediaSource$]).pipe(mergeMap(function (_a) {
        var parsedManifest = _a[0], initialMediaSource = _a[1];
        var manifest = parsedManifest.manifest;
        log.debug("Init: Calculating initial time");
        var initialTime = getInitialTime(manifest, lowLatencyMode, startAt);
        log.debug("Init: Initial time calculated:", initialTime);
        var mediaSourceLoader = createMediaSourceLoader({
            abrManager: abrManager,
            bufferOptions: objectAssign({ textTrackOptions: textTrackOptions }, bufferOptions),
            clock$: clock$,
            manifest: manifest,
            mediaElement: mediaElement,
            segmentFetcherCreator: segmentFetcherCreator,
            speed$: speed$,
        });
        // handle initial load and reloads
        var recursiveLoad$ = recursivelyLoadOnMediaSource(initialMediaSource, initialTime, autoPlay);
        // Emit when we want to manually update the manifest.
        var scheduleRefresh$ = new Subject();
        var manifestUpdate$ = manifestUpdateScheduler({ fetchManifest: fetchManifest, initialManifest: parsedManifest, manifestUpdateUrl: manifestUpdateUrl,
            minimumManifestUpdateInterval: minimumManifestUpdateInterval,
            scheduleRefresh$: scheduleRefresh$ });
        var manifestEvents$ = observableMerge(fromEvent(manifest, "manifestUpdate")
            .pipe(mapTo(EVENTS.manifestUpdate())), fromEvent(manifest, "decipherabilityUpdate")
            .pipe(map(EVENTS.decipherabilityUpdate)));
        var setUndecipherableRepresentations$ = emeManager$.pipe(tap(function (evt) {
            if (evt.type === "blacklist-keys") {
                log.info("Init: blacklisting Representations based on keyIDs");
                manifest.addUndecipherableKIDs(evt.value);
            }
            else if (evt.type === "blacklist-protection-data") {
                log.info("Init: blacklisting Representations based on protection data.");
                manifest.addUndecipherableProtectionData(evt.value.type, evt.value.data);
            }
        }));
        return observableMerge(manifestEvents$, manifestUpdate$, setUndecipherableRepresentations$, recursiveLoad$)
            .pipe(startWith(EVENTS.manifestReady(manifest)), finalize(function () { scheduleRefresh$.complete(); }));
        /**
         * Load the content defined by the Manifest in the mediaSource given at the
         * given position and playing status.
         * This function recursively re-call itself when a MediaSource reload is
         * wanted.
         * @param {MediaSource} mediaSource
         * @param {number} position
         * @param {boolean} shouldPlay
         * @returns {Observable}
         */
        function recursivelyLoadOnMediaSource(mediaSource, position, shouldPlay) {
            var reloadMediaSource$ = new Subject();
            var mediaSourceLoader$ = mediaSourceLoader(mediaSource, position, shouldPlay)
                .pipe(tap(function (evt) {
                switch (evt.type) {
                    case "needs-manifest-refresh":
                        scheduleRefresh$.next({ completeRefresh: false,
                            canUseUnsafeMode: true });
                        break;
                    case "manifest-might-be-out-of-sync":
                        scheduleRefresh$.next({
                            completeRefresh: true,
                            canUseUnsafeMode: false,
                            delay: OUT_OF_SYNC_MANIFEST_REFRESH_DELAY,
                        });
                        break;
                    case "needs-media-source-reload":
                        reloadMediaSource$.next(evt.value);
                        break;
                    case "needs-decipherability-flush":
                        var keySystem = getCurrentKeySystem(mediaElement);
                        if (shouldReloadMediaSourceOnDecipherabilityUpdate(keySystem)) {
                            reloadMediaSource$.next(evt.value);
                            return;
                        }
                        // simple seek close to the current position
                        // to flush the buffers
                        var currentTime = evt.value.currentTime;
                        if (currentTime + 0.001 < evt.value.duration) {
                            mediaElement.currentTime += 0.001;
                        }
                        else {
                            mediaElement.currentTime = currentTime;
                        }
                        break;
                    case "protected-segment":
                        protectedSegments$.next(evt.value);
                        break;
                }
            }));
            var currentLoad$ = mediaSourceLoader$.pipe(takeUntil(reloadMediaSource$));
            var handleReloads$ = reloadMediaSource$.pipe(switchMap(function (_a) {
                var currentTime = _a.currentTime, isPaused = _a.isPaused;
                return openMediaSource(mediaElement).pipe(mergeMap(function (newMS) { return recursivelyLoadOnMediaSource(newMS, currentTime, !isPaused); }), startWith(EVENTS.reloadingMediaSource()));
            }));
            return observableMerge(handleReloads$, currentLoad$);
        }
    }));
    return observableMerge(initialManifestRequestWarnings$, loadContent$, mediaError$, emeManager$);
}

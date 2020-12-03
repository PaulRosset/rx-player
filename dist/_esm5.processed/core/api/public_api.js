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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
/**
 * This file defines the public API for the RxPlayer.
 * It also starts the different sub-parts of the player on various API calls.
 */
import { BehaviorSubject, combineLatest as observableCombineLatest, concat as observableConcat, EMPTY, merge as observableMerge, of as observableOf, ReplaySubject, Subject, } from "rxjs";
import { distinctUntilChanged, filter, map, mapTo, mergeMapTo, publish, share, skipWhile, startWith, switchMapTo, take, takeUntil, } from "rxjs/operators";
import config from "../../config";
import log from "../../log";
import areArraysOfNumbersEqual from "../../utils/are_arrays_of_numbers_equal";
import EventEmitter, { fromEvent, } from "../../utils/event_emitter";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import noop from "../../utils/noop";
import objectAssign from "../../utils/object_assign";
import PPromise from "../../utils/promise";
import { getLeftSizeOfRange, getPlayedSizeOfRange, getSizeOfRange, } from "../../utils/ranges";
import warnOnce from "../../utils/warn_once";
import { events, exitFullscreen, isFullscreen, requestFullscreen, } from "../../compat";
import { ErrorCodes, ErrorTypes, formatError, MediaError, } from "../../errors";
import features from "../../features";
import { clearEMESession, disposeEME, getCurrentKeySystem, } from "../eme";
import initializeMediaSourcePlayback from "../init";
import createClock from "./clock";
import emitSeekEvents from "./emit_seek_events";
import getPlayerState, { PLAYER_STATES, } from "./get_player_state";
import { parseConstructorOptions, parseLoadVideoOptions, } from "./option_parsers";
import TrackChoiceManager from "./track_choice_manager";
var DEFAULT_UNMUTED_VOLUME = config.DEFAULT_UNMUTED_VOLUME;
var isActive = events.isActive, isVideoVisible = events.isVideoVisible, onEnded$ = events.onEnded$, onFullscreenChange$ = events.onFullscreenChange$, onPlayPause$ = events.onPlayPause$, onPictureInPictureEvent$ = events.onPictureInPictureEvent$, onSeeking$ = events.onSeeking$, onTextTrackChanges$ = events.onTextTrackChanges$, videoWidth$ = events.videoWidth$;
/**
 * @class Player
 * @extends EventEmitter
 */
var Player = /** @class */ (function (_super) {
    __extends(Player, _super);
    /**
     * @constructor
     * @param {Object} options
     */
    function Player(options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        var _a = parseConstructorOptions(options), initialAudioBitrate = _a.initialAudioBitrate, initialVideoBitrate = _a.initialVideoBitrate, limitVideoWidth = _a.limitVideoWidth, maxAudioBitrate = _a.maxAudioBitrate, maxBufferAhead = _a.maxBufferAhead, maxBufferBehind = _a.maxBufferBehind, maxVideoBitrate = _a.maxVideoBitrate, preferredAudioTracks = _a.preferredAudioTracks, preferredTextTracks = _a.preferredTextTracks, preferredVideoTracks = _a.preferredVideoTracks, throttleWhenHidden = _a.throttleWhenHidden, throttleVideoBitrateWhenHidden = _a.throttleVideoBitrateWhenHidden, videoElement = _a.videoElement, wantedBufferAhead = _a.wantedBufferAhead, stopAtEnd = _a.stopAtEnd;
        // Workaround to support Firefox autoplay on FF 42.
        // See: https://bugzilla.mozilla.org/show_bug.cgi?id=1194624
        videoElement.preload = "auto";
        _this.version = /*PLAYER_VERSION*/ "3.22.0";
        _this.log = log;
        _this.state = "STOPPED";
        _this.videoElement = videoElement;
        _this._priv_destroy$ = new Subject();
        _this._priv_pictureInPictureEvent$ = new ReplaySubject(1);
        onPictureInPictureEvent$(videoElement)
            .pipe(takeUntil(_this._priv_destroy$))
            .subscribe(_this._priv_pictureInPictureEvent$);
        /** @deprecated */
        onFullscreenChange$(videoElement)
            .pipe(takeUntil(_this._priv_destroy$))
            /* tslint:disable deprecation */
            .subscribe(function () { return _this.trigger("fullscreenChange", _this.isFullscreen()); });
        /* tslint:enable deprecation */
        /** @deprecated */
        onTextTrackChanges$(videoElement.textTracks)
            .pipe(takeUntil(_this._priv_destroy$), map(function (evt) {
            var target = evt.target;
            var arr = [];
            for (var i = 0; i < target.length; i++) {
                var textTrack = target[i];
                arr.push(textTrack);
            }
            return arr;
        }), 
        // We can have two consecutive textTrackChanges with the exact same
        // payload when we perform multiple texttrack operations before the event
        // loop is freed.
        // In that case we only want to fire one time the observable.
        distinctUntilChanged(function (textTracksA, textTracksB) {
            if (textTracksA.length !== textTracksB.length) {
                return false;
            }
            for (var i = 0; i < textTracksA.length; i++) {
                if (textTracksA[i] !== textTracksB[i]) {
                    return false;
                }
            }
            return true;
        }))
            .subscribe(function (x) { return _this._priv_onNativeTextTracksNext(x); });
        _this._priv_playing$ = new ReplaySubject(1);
        _this._priv_speed$ = new BehaviorSubject(videoElement.playbackRate);
        _this._priv_stopCurrentContent$ = new Subject();
        _this._priv_contentLock$ = new BehaviorSubject(false);
        _this._priv_bufferOptions = {
            wantedBufferAhead$: new BehaviorSubject(wantedBufferAhead),
            maxBufferAhead$: new BehaviorSubject(maxBufferAhead),
            maxBufferBehind$: new BehaviorSubject(maxBufferBehind),
        };
        _this._priv_bitrateInfos = {
            lastBitrates: { audio: initialAudioBitrate,
                video: initialVideoBitrate },
            maxAutoBitrates: { audio: new BehaviorSubject(maxAudioBitrate),
                video: new BehaviorSubject(maxVideoBitrate) },
            manualBitrates: { audio: new BehaviorSubject(-1),
                video: new BehaviorSubject(-1) },
        };
        _this._priv_throttleWhenHidden = throttleWhenHidden;
        _this._priv_throttleVideoBitrateWhenHidden = throttleVideoBitrateWhenHidden;
        _this._priv_limitVideoWidth = limitVideoWidth;
        _this._priv_mutedMemory = DEFAULT_UNMUTED_VOLUME;
        _this._priv_trackChoiceManager = null;
        _this._priv_mediaElementTrackChoiceManager = null;
        _this._priv_currentError = null;
        _this._priv_contentInfos = null;
        _this._priv_contentEventsMemory = {};
        _this._priv_stopAtEnd = stopAtEnd;
        _this._priv_setPlayerState(PLAYER_STATES.STOPPED);
        _this._priv_preferredAudioTracks = preferredAudioTracks;
        _this._priv_preferredTextTracks = preferredTextTracks;
        _this._priv_preferredVideoTracks = preferredVideoTracks;
        return _this;
    }
    Object.defineProperty(Player, "ErrorTypes", {
        /** All possible Error types emitted by the RxPlayer. */
        get: function () {
            return ErrorTypes;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player, "ErrorCodes", {
        /** All possible Error codes emitted by the RxPlayer. */
        get: function () {
            return ErrorCodes;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player, "LogLevel", {
        /**
         * Current log level.
         * Update current log level.
         * Should be either (by verbosity ascending):
         *   - "NONE"
         *   - "ERROR"
         *   - "WARNING"
         *   - "INFO"
         *   - "DEBUG"
         * Any other value will be translated to "NONE".
         */
        get: function () {
            return log.getLevel();
        },
        set: function (logLevel) {
            log.setLevel(logLevel);
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Stop the playback for the current content.
     */
    Player.prototype.stop = function () {
        if (this.state !== PLAYER_STATES.STOPPED) {
            this._priv_stopCurrentContent$.next();
            this._priv_cleanUpCurrentContentState();
            this._priv_setPlayerState(PLAYER_STATES.STOPPED);
        }
    };
    /**
     * Free the resources used by the player.
     * /!\ The player cannot be "used" anymore after this method has been called.
     */
    Player.prototype.dispose = function () {
        // free resources linked to the loaded content
        this.stop();
        if (this.videoElement !== null) {
            // free resources used for EME management
            disposeEME(this.videoElement);
        }
        // free Observables linked to the Player instance
        this._priv_destroy$.next();
        this._priv_destroy$.complete();
        // Complete all subjects
        this._priv_stopCurrentContent$.complete();
        this._priv_playing$.complete();
        this._priv_speed$.complete();
        this._priv_contentLock$.complete();
        this._priv_bufferOptions.wantedBufferAhead$.complete();
        this._priv_bufferOptions.maxBufferAhead$.complete();
        this._priv_bufferOptions.maxBufferBehind$.complete();
        this._priv_pictureInPictureEvent$.complete();
        this._priv_bitrateInfos.manualBitrates.video.complete();
        this._priv_bitrateInfos.manualBitrates.audio.complete();
        this._priv_bitrateInfos.maxAutoBitrates.video.complete();
        this._priv_bitrateInfos.maxAutoBitrates.audio.complete();
        // un-attach video element
        this.videoElement = null;
    };
    /**
     * Load a new video.
     * @param {Object} opts
     */
    Player.prototype.loadVideo = function (opts) {
        var _this = this;
        var _a, _b, _c;
        var options = parseLoadVideoOptions(opts);
        log.info("API: Calling loadvideo", options);
        var autoPlay = options.autoPlay, audioTrackSwitchingMode = options.audioTrackSwitchingMode, defaultAudioTrack = options.defaultAudioTrack, defaultTextTrack = options.defaultTextTrack, enableFastSwitching = options.enableFastSwitching, initialManifest = options.initialManifest, keySystems = options.keySystems, lowLatencyMode = options.lowLatencyMode, manualBitrateSwitchingMode = options.manualBitrateSwitchingMode, manifestUpdateUrl = options.manifestUpdateUrl, minimumManifestUpdateInterval = options.minimumManifestUpdateInterval, networkConfig = options.networkConfig, startAt = options.startAt, transport = options.transport, transportOptions = options.transportOptions, url = options.url;
        // Perform multiple checks on the given options
        if (this.videoElement === null) {
            throw new Error("the attached video element is disposed");
        }
        // now that every checks have passed, stop previous content
        this.stop();
        var isDirectFile = transport === "directfile";
        this._priv_currentError = null;
        this._priv_contentInfos = { url: url,
            isDirectFile: isDirectFile, segmentBuffersStore: null,
            thumbnails: null,
            manifest: null,
            currentPeriod: null,
            activeAdaptations: null,
            activeRepresentations: null,
            initialAudioTrack: defaultAudioTrack,
            initialTextTrack: defaultTextTrack };
        // inilialize `_priv_playing$` to false (meaning the content is not playing yet)
        this._priv_playing$.next(false);
        var videoElement = this.videoElement;
        /** Global "clock" used for content playback */
        var clock$ = createClock(videoElement, { withMediaSource: !isDirectFile, lowLatencyMode: lowLatencyMode });
        /** Emit when the current content has been stopped. */
        var contentIsStopped$ = observableMerge(this._priv_stopCurrentContent$, this._priv_stopAtEnd ? onEnded$(videoElement) :
            EMPTY).pipe(take(1));
        /** Emit playback events. */
        var playback$;
        if (!isDirectFile) {
            var transportFn = features.transports[transport];
            if (typeof transportFn !== "function") {
                throw new Error("transport \"" + transport + "\" not supported");
            }
            var transportPipelines = transportFn(transportOptions);
            /** Options used by the ABR Manager. */
            var adaptiveOptions = {
                initialBitrates: this._priv_bitrateInfos.lastBitrates,
                lowLatencyMode: lowLatencyMode,
                manualBitrates: this._priv_bitrateInfos.manualBitrates,
                maxAutoBitrates: this._priv_bitrateInfos.maxAutoBitrates,
                throttlers: {
                    throttle: this._priv_throttleWhenHidden ?
                        {
                            video: isActive().pipe(map(function (active) { return active ? Infinity :
                                0; }), takeUntil(this._priv_stopCurrentContent$)),
                        } :
                        {},
                    throttleBitrate: this._priv_throttleVideoBitrateWhenHidden ?
                        {
                            video: isVideoVisible(this._priv_pictureInPictureEvent$).pipe(map(function (active) { return active ? Infinity :
                                0; }), takeUntil(this._priv_stopCurrentContent$)),
                        } :
                        {},
                    limitWidth: this._priv_limitVideoWidth ?
                        {
                            video: videoWidth$(videoElement, this._priv_pictureInPictureEvent$)
                                .pipe(takeUntil(this._priv_stopCurrentContent$)),
                        } :
                        {},
                },
            };
            /** Options used by the TextTrack SegmentBuffer. */
            var textTrackOptions = options.textTrackMode === "native" ?
                { textTrackMode: "native", hideNativeSubtitle: options.hideNativeSubtitle } :
                { textTrackMode: "html", textTrackElement: options.textTrackElement };
            var bufferOptions = objectAssign({ enableFastSwitching: enableFastSwitching,
                manualBitrateSwitchingMode: manualBitrateSwitchingMode,
                audioTrackSwitchingMode: audioTrackSwitchingMode }, this._priv_bufferOptions);
            // We've every options set up. Start everything now
            var init$ = initializeMediaSourcePlayback({ adaptiveOptions: adaptiveOptions,
                autoPlay: autoPlay,
                bufferOptions: bufferOptions,
                clock$: clock$,
                content: { initialManifest: initialManifest,
                    manifestUpdateUrl: manifestUpdateUrl,
                    url: url },
                keySystems: keySystems,
                lowLatencyMode: lowLatencyMode, mediaElement: videoElement, minimumManifestUpdateInterval: minimumManifestUpdateInterval,
                networkConfig: networkConfig,
                transportPipelines: transportPipelines, speed$: this._priv_speed$, startAt: startAt,
                textTrackOptions: textTrackOptions })
                .pipe(takeUntil(contentIsStopped$));
            playback$ = publish()(init$);
        }
        else {
            if (features.directfile === null) {
                throw new Error("DirectFile feature not activated in your build.");
            }
            this._priv_mediaElementTrackChoiceManager =
                new features.directfile.mediaElementTrackChoiceManager(this.videoElement);
            var preferredAudioTracks = defaultAudioTrack === undefined ?
                this._priv_preferredAudioTracks :
                [defaultAudioTrack];
            this._priv_mediaElementTrackChoiceManager
                .setPreferredAudioTracks(preferredAudioTracks, true);
            var preferredTextTracks = defaultTextTrack === undefined ?
                this._priv_preferredTextTracks :
                [defaultTextTrack];
            this._priv_mediaElementTrackChoiceManager
                .setPreferredTextTracks(preferredTextTracks, true);
            this._priv_mediaElementTrackChoiceManager
                .setPreferredVideoTracks(this._priv_preferredVideoTracks, true);
            this.trigger("availableAudioTracksChange", this._priv_mediaElementTrackChoiceManager.getAvailableAudioTracks());
            this.trigger("availableVideoTracksChange", this._priv_mediaElementTrackChoiceManager.getAvailableVideoTracks());
            this.trigger("availableTextTracksChange", this._priv_mediaElementTrackChoiceManager.getAvailableTextTracks());
            this.trigger("audioTrackChange", (_a = this._priv_mediaElementTrackChoiceManager.getChosenAudioTrack()) !== null && _a !== void 0 ? _a : null);
            this.trigger("textTrackChange", (_b = this._priv_mediaElementTrackChoiceManager.getChosenTextTrack()) !== null && _b !== void 0 ? _b : null);
            this.trigger("videoTrackChange", (_c = this._priv_mediaElementTrackChoiceManager.getChosenVideoTrack()) !== null && _c !== void 0 ? _c : null);
            this._priv_mediaElementTrackChoiceManager
                .addEventListener("availableVideoTracksChange", function (val) {
                return _this.trigger("availableVideoTracksChange", val);
            });
            this._priv_mediaElementTrackChoiceManager
                .addEventListener("availableAudioTracksChange", function (val) {
                return _this.trigger("availableAudioTracksChange", val);
            });
            this._priv_mediaElementTrackChoiceManager
                .addEventListener("availableTextTracksChange", function (val) {
                return _this.trigger("availableTextTracksChange", val);
            });
            this._priv_mediaElementTrackChoiceManager
                .addEventListener("audioTrackChange", function (val) {
                return _this.trigger("audioTrackChange", val);
            });
            this._priv_mediaElementTrackChoiceManager
                .addEventListener("videoTrackChange", function (val) {
                return _this.trigger("videoTrackChange", val);
            });
            this._priv_mediaElementTrackChoiceManager
                .addEventListener("textTrackChange", function (val) {
                return _this.trigger("textTrackChange", val);
            });
            var directfileInit$ = features.directfile.initDirectFile({ autoPlay: autoPlay,
                clock$: clock$,
                keySystems: keySystems, mediaElement: videoElement,
                speed$: this._priv_speed$, startAt: startAt,
                url: url })
                .pipe(takeUntil(contentIsStopped$));
            playback$ = publish()(directfileInit$);
        }
        /** Emit an object when the player "stalls" and null when it un-stalls */
        var stalled$ = playback$.pipe(filter(function (evt) { return evt.type === "stalled"; }), map(function (x) { return x.value; }));
        /** Emit when the content is considered "loaded". */
        var loaded$ = playback$.pipe(filter(function (evt) { return evt.type === "loaded"; }), share());
        /** Emit when we will "reload" the MediaSource. */
        var reloading$ = playback$
            .pipe(filter(function (evt) {
            return evt.type === "reloading-media-source";
        }), share());
        /** Emit when the media element emits an "ended" event. */
        var endedEvent$ = onEnded$(videoElement);
        /** Emit when the media element emits a "seeking" event. */
        var seekingEvent$ = onSeeking$(videoElement);
        /** Emit state updates once the content is considered "loaded". */
        var loadedStateUpdates$ = observableCombineLatest([
            this._priv_playing$,
            stalled$.pipe(startWith(null)),
            endedEvent$.pipe(startWith(null)),
            seekingEvent$.pipe(startWith(null)),
        ]).pipe(takeUntil(this._priv_stopCurrentContent$), map(function (_a) {
            var isPlaying = _a[0], stalledStatus = _a[1];
            return getPlayerState(videoElement, isPlaying, stalledStatus);
        }));
        /** Emit all player "state" updates. */
        var playerState$ = observableConcat(observableOf(PLAYER_STATES.LOADING), // Begin with LOADING
        // LOADED as soon as the first "loaded" event is sent
        loaded$.pipe(take(1), mapTo(PLAYER_STATES.LOADED)), observableMerge(loadedStateUpdates$
            .pipe(
        // From the first reload onward, we enter another dynamic (below)
        takeUntil(reloading$), skipWhile(function (state) { return state === PLAYER_STATES.PAUSED; })), 
        // when reloading
        reloading$.pipe(switchMapTo(loaded$.pipe(take(1), // wait for the next loaded event
        mergeMapTo(loadedStateUpdates$), // to update the state as usual
        startWith(PLAYER_STATES.RELOADING) // Starts with "RELOADING" state
        ))))).pipe(distinctUntilChanged());
        var playbackSubscription;
        this._priv_stopCurrentContent$
            .pipe(take(1))
            .subscribe(function () {
            if (playbackSubscription !== undefined) {
                playbackSubscription.unsubscribe();
            }
        });
        // Link `_priv_onPlayPauseNext` Observable to "play"/"pause" events
        onPlayPause$(videoElement)
            .pipe(takeUntil(this._priv_stopCurrentContent$))
            .subscribe(function (e) { return _this._priv_onPlayPauseNext(e.type === "play"); }, noop);
        // Link "positionUpdate" events to the clock
        clock$
            .pipe(takeUntil(this._priv_stopCurrentContent$))
            .subscribe(function (x) { return _this._priv_triggerPositionUpdate(x); }, noop);
        // Link "seeking" and "seeked" events (once the content is loaded)
        loaded$.pipe(switchMapTo(emitSeekEvents(this.videoElement, clock$)), takeUntil(this._priv_stopCurrentContent$)).subscribe(function (evt) {
            log.info("API: Triggering \"" + evt + "\" event");
            _this.trigger(evt, null);
        });
        // Handle state updates
        playerState$
            .pipe(takeUntil(this._priv_stopCurrentContent$))
            .subscribe(function (x) { return _this._priv_setPlayerState(x); }, noop);
        // Link playback events to the corresponding callbacks
        playback$.subscribe(function (x) { return _this._priv_onPlaybackEvent(x); }, function (err) { return _this._priv_onPlaybackError(err); }, function () { return _this._priv_onPlaybackFinished(); });
        // initialize the content only when the lock is inactive
        this._priv_contentLock$
            .pipe(filter(function (isLocked) { return !isLocked; }), take(1), takeUntil(this._priv_stopCurrentContent$))
            .subscribe(function () {
            // start playback!
            playbackSubscription = playback$.connect();
        });
    };
    /**
     * Returns fatal error if one for the current content.
     * null otherwise.
     * @returns {Object|null} - The current Error (`null` when no error).
     */
    Player.prototype.getError = function () {
        return this._priv_currentError;
    };
    /**
     * Returns manifest/playlist object.
     * null if the player is STOPPED.
     * @deprecated
     * @returns {Manifest|null} - The current Manifest (`null` when not known).
     */
    Player.prototype.getManifest = function () {
        warnOnce("getManifest is deprecated." +
            " Please open an issue if you used this API.");
        if (this._priv_contentInfos === null) {
            return null;
        }
        return this._priv_contentInfos.manifest;
    };
    /**
     * Returns Adaptations (tracks) for every currently playing type
     * (audio/video/text...).
     * @deprecated
     * @returns {Object|null} - The current Adaptation objects, per type (`null`
     * when none is known for now.
     */
    Player.prototype.getCurrentAdaptations = function () {
        warnOnce("getCurrentAdaptations is deprecated." +
            " Please open an issue if you used this API.");
        if (this._priv_contentInfos === null) {
            return null;
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, activeAdaptations = _a.activeAdaptations;
        if (currentPeriod === null ||
            activeAdaptations === null ||
            isNullOrUndefined(activeAdaptations[currentPeriod.id])) {
            return null;
        }
        return activeAdaptations[currentPeriod.id];
    };
    /**
     * Returns representations (qualities) for every currently playing type
     * (audio/video/text...).
     * @deprecated
     * @returns {Object|null} - The current Representation objects, per type
     * (`null` when none is known for now.
     */
    Player.prototype.getCurrentRepresentations = function () {
        warnOnce("getCurrentRepresentations is deprecated." +
            " Please open an issue if you used this API.");
        return this._priv_getCurrentRepresentations();
    };
    /**
     * Returns the media DOM element used by the player.
     * You should not its HTML5 API directly and use the player's method instead,
     * to ensure a well-behaved player.
     * @returns {HTMLMediaElement|null} - The HTMLMediaElement used (`null` when
     * disposed)
     */
    Player.prototype.getVideoElement = function () {
        return this.videoElement;
    };
    /**
     * If one returns the first native text-track element attached to the media element.
     * @deprecated
     * @returns {TextTrack} - The native TextTrack attached (`null` when none)
     */
    Player.prototype.getNativeTextTrack = function () {
        warnOnce("getNativeTextTrack is deprecated." +
            " Please open an issue if you used this API.");
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        var videoElement = this.videoElement;
        var textTracks = videoElement.textTracks;
        if (textTracks.length > 0) {
            return videoElement.textTracks[0];
        }
        else {
            return null;
        }
    };
    /**
     * Returns the player's current state.
     * @returns {string} - The current Player's state
     */
    Player.prototype.getPlayerState = function () {
        return this.state;
    };
    /**
     * Returns true if both:
     *   - a content is loaded
     *   - the content loaded is a live content
     * @returns {Boolean} - `true` if we're playing a live content, `false` otherwise.
     */
    Player.prototype.isLive = function () {
        if (this._priv_contentInfos === null) {
            return false;
        }
        var _a = this._priv_contentInfos, isDirectFile = _a.isDirectFile, manifest = _a.manifest;
        if (isDirectFile || manifest === null) {
            return false;
        }
        return manifest.isLive;
    };
    /**
     * Returns the url of the content's manifest
     * @returns {string|undefined} - Current URL. `undefined` if not known or no
     * URL yet.
     */
    Player.prototype.getUrl = function () {
        if (this._priv_contentInfos === null) {
            return undefined;
        }
        var _a = this._priv_contentInfos, isDirectFile = _a.isDirectFile, manifest = _a.manifest, url = _a.url;
        if (isDirectFile) {
            return url;
        }
        if (manifest !== null) {
            return manifest.getUrl();
        }
        return undefined;
    };
    /**
     * Returns the video duration, in seconds.
     * NaN if no video is playing.
     * @returns {Number}
     */
    Player.prototype.getVideoDuration = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        return this.videoElement.duration;
    };
    /**
     * Returns in seconds the difference between:
     *   - the end of the current contiguous loaded range.
     *   - the current time
     * @returns {Number}
     */
    Player.prototype.getVideoBufferGap = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        var videoElement = this.videoElement;
        return getLeftSizeOfRange(videoElement.buffered, videoElement.currentTime);
    };
    /**
     * Returns in seconds the difference between:
     *   - the end of the current contiguous loaded range.
     *   - the start of the current contiguous loaded range.
     * @returns {Number}
     */
    Player.prototype.getVideoLoadedTime = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        var videoElement = this.videoElement;
        return getSizeOfRange(videoElement.buffered, videoElement.currentTime);
    };
    /**
     * Returns in seconds the difference between:
     *   - the current time.
     *   - the start of the current contiguous loaded range.
     * @returns {Number}
     */
    Player.prototype.getVideoPlayedTime = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        var videoElement = this.videoElement;
        return getPlayedSizeOfRange(videoElement.buffered, videoElement.currentTime);
    };
    /**
     * Get the current position, in s, in wall-clock time.
     * That is:
     *   - for live content, get a timestamp, in s, of the current played content.
     *   - for static content, returns the position from beginning in s.
     *
     * If you do not know if you want to use this method or getPosition:
     *   - If what you want is to display the current time to the user, use this
     *     one.
     *   - If what you want is to interact with the player's API or perform other
     *     actions (like statistics) with the real player data, use getPosition.
     *
     * @returns {Number}
     */
    Player.prototype.getWallClockTime = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        if (this._priv_contentInfos === null) {
            return this.videoElement.currentTime;
        }
        var _a = this._priv_contentInfos, isDirectFile = _a.isDirectFile, manifest = _a.manifest;
        if (isDirectFile) {
            return this.videoElement.currentTime;
        }
        if (manifest !== null) {
            var currentTime = this.videoElement.currentTime;
            var ast = manifest.availabilityStartTime !== undefined ?
                manifest.availabilityStartTime :
                0;
            return currentTime + ast;
        }
        return 0;
    };
    /**
     * Get the current position, in seconds, of the video element.
     *
     * If you do not know if you want to use this method or getWallClockTime:
     *   - If what you want is to display the current time to the user, use
     *     getWallClockTime.
     *   - If what you want is to interact with the player's API or perform other
     *     actions (like statistics) with the real player data, use this one.
     *
     * @returns {Number}
     */
    Player.prototype.getPosition = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        return this.videoElement.currentTime;
    };
    /**
     * Returns the current speed at which the video plays.
     * @returns {Number}
     */
    Player.prototype.getPlaybackRate = function () {
        return this._priv_speed$.getValue();
    };
    /**
     * Update the playback rate of the video.
     * @param {Number} rate
     */
    Player.prototype.setPlaybackRate = function (rate) {
        this._priv_speed$.next(rate);
    };
    /**
     * Returns all available bitrates for the current video Adaptation.
     * @returns {Array.<Number>}
     */
    Player.prototype.getAvailableVideoBitrates = function () {
        if (this._priv_contentInfos === null) {
            return [];
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, activeAdaptations = _a.activeAdaptations;
        if (currentPeriod === null || activeAdaptations === null) {
            return [];
        }
        var adaptations = activeAdaptations[currentPeriod.id];
        if (adaptations === undefined || isNullOrUndefined(adaptations.video)) {
            return [];
        }
        return adaptations.video.getAvailableBitrates();
    };
    /**
     * Returns all available bitrates for the current audio Adaptation.
     * @returns {Array.<Number>}
     */
    Player.prototype.getAvailableAudioBitrates = function () {
        if (this._priv_contentInfos === null) {
            return [];
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, activeAdaptations = _a.activeAdaptations;
        if (currentPeriod === null || activeAdaptations === null) {
            return [];
        }
        var adaptations = activeAdaptations[currentPeriod.id];
        if (adaptations === undefined || isNullOrUndefined(adaptations.audio)) {
            return [];
        }
        return adaptations.audio.getAvailableBitrates();
    };
    /**
     * Returns the manual audio bitrate set. -1 if in AUTO mode.
     * @returns {Number}
     */
    Player.prototype.getManualAudioBitrate = function () {
        return this._priv_bitrateInfos.manualBitrates.audio.getValue();
    };
    /**
     * Returns the manual video bitrate set. -1 if in AUTO mode.
     * @returns {Number}
     */
    Player.prototype.getManualVideoBitrate = function () {
        return this._priv_bitrateInfos.manualBitrates.video.getValue();
    };
    /**
     * Returns currently considered bitrate for video segments.
     * @returns {Number|undefined}
     */
    Player.prototype.getVideoBitrate = function () {
        var representations = this._priv_getCurrentRepresentations();
        if (representations === null || isNullOrUndefined(representations.video)) {
            return undefined;
        }
        return representations.video.bitrate;
    };
    /**
     * Returns currently considered bitrate for audio segments.
     * @returns {Number|undefined}
     */
    Player.prototype.getAudioBitrate = function () {
        var representations = this._priv_getCurrentRepresentations();
        if (representations === null || isNullOrUndefined(representations.audio)) {
            return undefined;
        }
        return representations.audio.bitrate;
    };
    /**
     * Returns max wanted video bitrate currently set.
     * @returns {Number}
     */
    Player.prototype.getMaxVideoBitrate = function () {
        return this._priv_bitrateInfos.maxAutoBitrates.video.getValue();
    };
    /**
     * Returns max wanted audio bitrate currently set.
     * @returns {Number}
     */
    Player.prototype.getMaxAudioBitrate = function () {
        return this._priv_bitrateInfos.maxAutoBitrates.audio.getValue();
    };
    /**
     * Play/Resume the current video.
     * @returns {Promise}
     */
    Player.prototype.play = function () {
        var _this = this;
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        var playPromise = this.videoElement.play();
        /* tslint:disable no-unbound-method */
        if (isNullOrUndefined(playPromise) || typeof playPromise.catch !== "function") {
            /* tslint:enable no-unbound-method */
            return PPromise.resolve();
        }
        return playPromise.catch(function (error) {
            if (error.name === "NotAllowedError") {
                var warning = new MediaError("MEDIA_ERR_PLAY_NOT_ALLOWED", error.toString());
                _this.trigger("warning", warning);
            }
            throw error;
        });
    };
    /**
     * Pause the current video.
     */
    Player.prototype.pause = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        this.videoElement.pause();
    };
    /**
     * Seek to a given absolute position.
     * @param {Number|Object} time
     * @returns {Number} - The time the player has seek to
     */
    Player.prototype.seekTo = function (time) {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        if (this._priv_contentInfos === null) {
            throw new Error("player: no content loaded");
        }
        var _a = this._priv_contentInfos, isDirectFile = _a.isDirectFile, manifest = _a.manifest;
        if (!isDirectFile && manifest === null) {
            throw new Error("player: the content did not load yet");
        }
        var positionWanted;
        if (typeof time === "number") {
            positionWanted = time;
        }
        else if (typeof time === "object") {
            var timeObj = time;
            var currentTs = this.videoElement.currentTime;
            if (!isNullOrUndefined(timeObj.relative)) {
                positionWanted = currentTs + timeObj.relative;
            }
            else if (!isNullOrUndefined(timeObj.position)) {
                positionWanted = timeObj.position;
            }
            else if (!isNullOrUndefined(timeObj.wallClockTime)) {
                positionWanted = (isDirectFile || manifest === null) ?
                    timeObj.wallClockTime :
                    timeObj.wallClockTime - (manifest.availabilityStartTime !== undefined ?
                        manifest.availabilityStartTime :
                        0);
            }
            else {
                throw new Error("invalid time object. You must set one of the " +
                    "following properties: \"relative\", \"position\" or " +
                    "\"wallClockTime\"");
            }
        }
        if (positionWanted === undefined) {
            throw new Error("invalid time given");
        }
        this.videoElement.currentTime = positionWanted;
        return positionWanted;
    };
    /**
     * Returns true if the media element is full screen.
     * @deprecated
     * @returns {Boolean}
     */
    Player.prototype.isFullscreen = function () {
        warnOnce("isFullscreen is deprecated." +
            " Fullscreen management should now be managed by the application");
        return isFullscreen();
    };
    /**
     * Set/exit fullScreen.
     * @deprecated
     * @param {Boolean} [goFull=true] - if false, exit full screen.
     */
    Player.prototype.setFullscreen = function (goFull) {
        if (goFull === void 0) { goFull = true; }
        warnOnce("setFullscreen is deprecated." +
            " Fullscreen management should now be managed by the application");
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        if (goFull) {
            requestFullscreen(this.videoElement);
        }
        else {
            exitFullscreen();
        }
    };
    /**
     * Exit from full screen mode.
     * @deprecated
     */
    Player.prototype.exitFullscreen = function () {
        warnOnce("exitFullscreen is deprecated." +
            " Fullscreen management should now be managed by the application");
        exitFullscreen();
    };
    /**
     * Returns the current player's audio volume on the media element.
     * From 0 (no audio) to 1 (maximum volume).
     * @returns {Number}
     */
    Player.prototype.getVolume = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        return this.videoElement.volume;
    };
    /**
     * Set the player's audio volume. From 0 (no volume) to 1 (maximum volume).
     * @param {Number} volume
     */
    Player.prototype.setVolume = function (volume) {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        var videoElement = this.videoElement;
        if (volume !== videoElement.volume) {
            videoElement.volume = volume;
            this.trigger("volumeChange", volume);
        }
    };
    /**
     * Returns true if the volume is set to 0. false otherwise.
     * @returns {Boolean}
     */
    Player.prototype.isMute = function () {
        return this.getVolume() === 0;
    };
    /**
     * Set the volume to 0 and save current one for when unmuted.
     */
    Player.prototype.mute = function () {
        this._priv_mutedMemory = this.getVolume();
        this.setVolume(0);
    };
    /**
     * Set the volume back to when it was when mute was last called.
     * If the volume was set to 0, set a default volume instead (see config).
     */
    Player.prototype.unMute = function () {
        var vol = this.getVolume();
        if (vol === 0) {
            this.setVolume(this._priv_mutedMemory === 0 ? DEFAULT_UNMUTED_VOLUME :
                this._priv_mutedMemory);
        }
    };
    /**
     * Force the video bitrate to a given value. Act as a ceil.
     * -1 to set it on AUTO Mode
     * @param {Number} btr
     */
    Player.prototype.setVideoBitrate = function (btr) {
        this._priv_bitrateInfos.manualBitrates.video.next(btr);
    };
    /**
     * Force the audio bitrate to a given value. Act as a ceil.
     * -1 to set it on AUTO Mode
     * @param {Number} btr
     */
    Player.prototype.setAudioBitrate = function (btr) {
        this._priv_bitrateInfos.manualBitrates.audio.next(btr);
    };
    /**
     * Update the maximum video bitrate the user can switch to.
     * @param {Number} btr
     */
    Player.prototype.setMaxVideoBitrate = function (btr) {
        this._priv_bitrateInfos.maxAutoBitrates.video.next(btr);
    };
    /**
     * Update the maximum audio bitrate the user can switch to.
     * @param {Number} btr
     */
    Player.prototype.setMaxAudioBitrate = function (btr) {
        this._priv_bitrateInfos.maxAutoBitrates.audio.next(btr);
    };
    /**
     * Set the max buffer size for the buffer behind the current position.
     * Every buffer data before will be removed.
     * @param {Number} depthInSeconds
     */
    Player.prototype.setMaxBufferBehind = function (depthInSeconds) {
        this._priv_bufferOptions.maxBufferBehind$.next(depthInSeconds);
    };
    /**
     * Set the max buffer size for the buffer behind the current position.
     * Every buffer data before will be removed.
     * @param {Number} depthInSeconds
     */
    Player.prototype.setMaxBufferAhead = function (depthInSeconds) {
        this._priv_bufferOptions.maxBufferAhead$.next(depthInSeconds);
    };
    /**
     * Set the max buffer size for the buffer ahead of the current position.
     * The player will stop downloading chunks when this size is reached.
     * @param {Number} sizeInSeconds
     */
    Player.prototype.setWantedBufferAhead = function (sizeInSeconds) {
        this._priv_bufferOptions.wantedBufferAhead$.next(sizeInSeconds);
    };
    /**
     * Returns the max buffer size for the buffer behind the current position.
     * @returns {Number}
     */
    Player.prototype.getMaxBufferBehind = function () {
        return this._priv_bufferOptions.maxBufferBehind$.getValue();
    };
    /**
     * Returns the max buffer size for the buffer behind the current position.
     * @returns {Number}
     */
    Player.prototype.getMaxBufferAhead = function () {
        return this._priv_bufferOptions.maxBufferAhead$.getValue();
    };
    /**
     * Returns the max buffer size for the buffer ahead of the current position.
     * @returns {Number}
     */
    Player.prototype.getWantedBufferAhead = function () {
        return this._priv_bufferOptions.wantedBufferAhead$.getValue();
    };
    /**
     * Returns type of current keysystem (e.g. playready, widevine) if the content
     * is encrypted. null otherwise.
     * @returns {string|null}
     */
    Player.prototype.getCurrentKeySystem = function () {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        return getCurrentKeySystem(this.videoElement);
    };
    /**
     * Returns every available audio tracks for the current Period.
     * @returns {Array.<Object>|null}
     */
    Player.prototype.getAvailableAudioTracks = function () {
        var _a, _b;
        if (this._priv_contentInfos === null) {
            return [];
        }
        var _c = this._priv_contentInfos, currentPeriod = _c.currentPeriod, isDirectFile = _c.isDirectFile;
        if (isDirectFile) {
            return (_b = (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.getAvailableAudioTracks()) !== null && _b !== void 0 ? _b : [];
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return [];
        }
        return this._priv_trackChoiceManager.getAvailableAudioTracks(currentPeriod);
    };
    /**
     * Returns every available text tracks for the current Period.
     * @returns {Array.<Object>|null}
     */
    Player.prototype.getAvailableTextTracks = function () {
        var _a, _b;
        if (this._priv_contentInfos === null) {
            return [];
        }
        var _c = this._priv_contentInfos, currentPeriod = _c.currentPeriod, isDirectFile = _c.isDirectFile;
        if (isDirectFile) {
            return (_b = (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.getAvailableTextTracks()) !== null && _b !== void 0 ? _b : [];
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return [];
        }
        return this._priv_trackChoiceManager.getAvailableTextTracks(currentPeriod);
    };
    /**
     * Returns every available video tracks for the current Period.
     * @returns {Array.<Object>|null}
     */
    Player.prototype.getAvailableVideoTracks = function () {
        var _a, _b;
        if (this._priv_contentInfos === null) {
            return [];
        }
        var _c = this._priv_contentInfos, currentPeriod = _c.currentPeriod, isDirectFile = _c.isDirectFile;
        if (isDirectFile) {
            return (_b = (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.getAvailableVideoTracks()) !== null && _b !== void 0 ? _b : [];
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return [];
        }
        return this._priv_trackChoiceManager.getAvailableVideoTracks(currentPeriod);
    };
    /**
     * Returns currently chosen audio language for the current Period.
     * @returns {string}
     */
    Player.prototype.getAudioTrack = function () {
        if (this._priv_contentInfos === null) {
            return undefined;
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, isDirectFile = _a.isDirectFile;
        if (isDirectFile) {
            if (this._priv_mediaElementTrackChoiceManager === null) {
                return undefined;
            }
            return this._priv_mediaElementTrackChoiceManager.getChosenAudioTrack();
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return undefined;
        }
        return this._priv_trackChoiceManager.getChosenAudioTrack(currentPeriod);
    };
    /**
     * Returns currently chosen subtitle for the current Period.
     * @returns {string}
     */
    Player.prototype.getTextTrack = function () {
        if (this._priv_contentInfos === null) {
            return undefined;
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, isDirectFile = _a.isDirectFile;
        if (isDirectFile) {
            if (this._priv_mediaElementTrackChoiceManager === null) {
                return undefined;
            }
            return this._priv_mediaElementTrackChoiceManager.getChosenTextTrack();
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return undefined;
        }
        return this._priv_trackChoiceManager.getChosenTextTrack(currentPeriod);
    };
    /**
     * Returns currently chosen video track for the current Period.
     * @returns {string}
     */
    Player.prototype.getVideoTrack = function () {
        if (this._priv_contentInfos === null) {
            return undefined;
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, isDirectFile = _a.isDirectFile;
        if (isDirectFile) {
            if (this._priv_mediaElementTrackChoiceManager === null) {
                return undefined;
            }
            return this._priv_mediaElementTrackChoiceManager.getChosenVideoTrack();
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return undefined;
        }
        return this._priv_trackChoiceManager.getChosenVideoTrack(currentPeriod);
    };
    /**
     * Update the audio language for the current Period.
     * @param {string} audioId
     * @throws Error - the current content has no TrackChoiceManager.
     * @throws Error - the given id is linked to no audio track.
     */
    Player.prototype.setAudioTrack = function (audioId) {
        var _a;
        if (this._priv_contentInfos === null) {
            throw new Error("No content loaded");
        }
        var _b = this._priv_contentInfos, currentPeriod = _b.currentPeriod, isDirectFile = _b.isDirectFile;
        if (isDirectFile) {
            try {
                (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.setAudioTrackById(audioId);
                return;
            }
            catch (e) {
                throw new Error("player: unknown audio track");
            }
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            throw new Error("No compatible content launched.");
        }
        try {
            this._priv_trackChoiceManager.setAudioTrackByID(currentPeriod, audioId);
        }
        catch (e) {
            throw new Error("player: unknown audio track");
        }
    };
    /**
     * Update the text language for the current Period.
     * @param {string} sub
     * @throws Error - the current content has no TrackChoiceManager.
     * @throws Error - the given id is linked to no text track.
     */
    Player.prototype.setTextTrack = function (textId) {
        var _a;
        if (this._priv_contentInfos === null) {
            throw new Error("No content loaded");
        }
        var _b = this._priv_contentInfos, currentPeriod = _b.currentPeriod, isDirectFile = _b.isDirectFile;
        if (isDirectFile) {
            try {
                (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.setTextTrackById(textId);
                return;
            }
            catch (e) {
                throw new Error("player: unknown text track");
            }
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            throw new Error("No compatible content launched.");
        }
        try {
            this._priv_trackChoiceManager.setTextTrackByID(currentPeriod, textId);
        }
        catch (e) {
            throw new Error("player: unknown text track");
        }
    };
    /**
     * Disable subtitles for the current content.
     */
    Player.prototype.disableTextTrack = function () {
        var _a;
        if (this._priv_contentInfos === null) {
            return;
        }
        var _b = this._priv_contentInfos, currentPeriod = _b.currentPeriod, isDirectFile = _b.isDirectFile;
        if (isDirectFile) {
            (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.disableTextTrack();
            return;
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return;
        }
        return this._priv_trackChoiceManager.disableTextTrack(currentPeriod);
    };
    /**
     * Update the video track for the current Period.
     * @param {string} videoId
     * @throws Error - the current content has no TrackChoiceManager.
     * @throws Error - the given id is linked to no video track.
     */
    Player.prototype.setVideoTrack = function (videoId) {
        var _a;
        if (this._priv_contentInfos === null) {
            throw new Error("No content loaded");
        }
        var _b = this._priv_contentInfos, currentPeriod = _b.currentPeriod, isDirectFile = _b.isDirectFile;
        if (isDirectFile) {
            try {
                (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.setVideoTrackById(videoId);
                return;
            }
            catch (e) {
                throw new Error("player: unknown video track");
            }
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            throw new Error("No compatible content launched.");
        }
        try {
            this._priv_trackChoiceManager.setVideoTrackByID(currentPeriod, videoId);
        }
        catch (e) {
            throw new Error("player: unknown video track");
        }
    };
    /**
     * Disable video track for the current content.
     */
    Player.prototype.disableVideoTrack = function () {
        if (this._priv_contentInfos === null) {
            return;
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, isDirectFile = _a.isDirectFile;
        if (isDirectFile && this._priv_mediaElementTrackChoiceManager !== null) {
            return this._priv_mediaElementTrackChoiceManager.disableVideoTrack();
        }
        if (this._priv_trackChoiceManager === null || currentPeriod === null) {
            return;
        }
        return this._priv_trackChoiceManager.disableVideoTrack(currentPeriod);
    };
    /**
     * Returns the current list of preferred audio tracks, in preference order.
     * @returns {Array.<Object>}
     */
    Player.prototype.getPreferredAudioTracks = function () {
        return this._priv_preferredAudioTracks;
    };
    /**
     * Returns the current list of preferred text tracks, in preference order.
     * @returns {Array.<Object>}
     */
    Player.prototype.getPreferredTextTracks = function () {
        return this._priv_preferredTextTracks;
    };
    /**
     * Returns the current list of preferred text tracks, in preference order.
     * @returns {Array.<Object>}
     */
    Player.prototype.getPreferredVideoTracks = function () {
        return this._priv_preferredVideoTracks;
    };
    /**
     * Set the list of preferred audio tracks, in preference order.
     * @param {Array.<Object>} tracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    Player.prototype.setPreferredAudioTracks = function (tracks, shouldApply) {
        if (shouldApply === void 0) { shouldApply = false; }
        if (!Array.isArray(tracks)) {
            throw new Error("Invalid `setPreferredAudioTracks` argument. " +
                "Should have been an Array.");
        }
        this._priv_preferredAudioTracks = tracks;
        if (this._priv_trackChoiceManager !== null) {
            this._priv_trackChoiceManager.setPreferredAudioTracks(tracks, shouldApply);
        }
        else if (this._priv_mediaElementTrackChoiceManager !== null) {
            this._priv_mediaElementTrackChoiceManager.setPreferredAudioTracks(tracks, shouldApply);
        }
    };
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} tracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Periods. `false` if it should only
     * be applied to new content.
     */
    Player.prototype.setPreferredTextTracks = function (tracks, shouldApply) {
        if (shouldApply === void 0) { shouldApply = false; }
        if (!Array.isArray(tracks)) {
            throw new Error("Invalid `setPreferredTextTracks` argument. " +
                "Should have been an Array.");
        }
        this._priv_preferredTextTracks = tracks;
        if (this._priv_trackChoiceManager !== null) {
            this._priv_trackChoiceManager.setPreferredTextTracks(tracks, shouldApply);
        }
        else if (this._priv_mediaElementTrackChoiceManager !== null) {
            this._priv_mediaElementTrackChoiceManager.setPreferredTextTracks(tracks, shouldApply);
        }
    };
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} tracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    Player.prototype.setPreferredVideoTracks = function (tracks, shouldApply) {
        if (shouldApply === void 0) { shouldApply = false; }
        if (!Array.isArray(tracks)) {
            throw new Error("Invalid `setPreferredVideoTracks` argument. " +
                "Should have been an Array.");
        }
        this._priv_preferredVideoTracks = tracks;
        if (this._priv_trackChoiceManager !== null) {
            this._priv_trackChoiceManager.setPreferredVideoTracks(tracks, shouldApply);
        }
        else if (this._priv_mediaElementTrackChoiceManager !== null) {
            this._priv_mediaElementTrackChoiceManager.setPreferredVideoTracks(tracks, shouldApply);
        }
    };
    /**
     * @returns {Array.<Object>|null}
     * @deprecated
     */
    Player.prototype.getImageTrackData = function () {
        warnOnce("`getImageTrackData` is deprecated." +
            "Please use the `parseBifThumbnails` tool instead.");
        if (this._priv_contentInfos === null) {
            return null;
        }
        /* tslint:disable deprecation */
        return this._priv_contentInfos.thumbnails;
        /* tslint:enable deprecation */
    };
    /**
     * Get minimum seek-able position.
     * @returns {number}
     */
    Player.prototype.getMinimumPosition = function () {
        if (this._priv_contentInfos === null) {
            return null;
        }
        if (this._priv_contentInfos.isDirectFile) {
            return 0;
        }
        var manifest = this._priv_contentInfos.manifest;
        if (manifest !== null) {
            return manifest.getMinimumPosition();
        }
        return null;
    };
    /**
     * Get maximum seek-able position.
     * @returns {number}
     */
    Player.prototype.getMaximumPosition = function () {
        if (this._priv_contentInfos === null) {
            return null;
        }
        var _a = this._priv_contentInfos, isDirectFile = _a.isDirectFile, manifest = _a.manifest;
        if (isDirectFile) {
            if (this.videoElement === null) {
                throw new Error("Disposed player");
            }
            return this.videoElement.duration;
        }
        if (manifest !== null) {
            return manifest.getMaximumPosition();
        }
        return null;
    };
    /**
     * /!\ For demo use only! Do not touch!
     *
     * Returns every chunk buffered for a given buffer type.
     * Returns `null` if no SegmentBuffer was created for this type of buffer.
     * @param {string} bufferType
     * @returns {Array.<Object>|null}
     */
    Player.prototype.__priv_getSegmentBufferContent = function (bufferType) {
        if (this._priv_contentInfos === null ||
            this._priv_contentInfos.segmentBuffersStore === null) {
            return null;
        }
        var segmentBufferStatus = this._priv_contentInfos
            .segmentBuffersStore.getStatus(bufferType);
        return segmentBufferStatus.type === "initialized" ?
            segmentBufferStatus.value.getInventory() :
            null;
    };
    /**
     * Reset all state properties relative to a playing content.
     */
    Player.prototype._priv_cleanUpCurrentContentState = function () {
        var _this = this;
        var _a;
        log.debug("Locking `contentLock` to clean-up the current content.");
        // lock playback of new contents while cleaning up is pending
        this._priv_contentLock$.next(true);
        this._priv_contentInfos = null;
        this._priv_trackChoiceManager = null;
        (_a = this._priv_mediaElementTrackChoiceManager) === null || _a === void 0 ? void 0 : _a.dispose();
        this._priv_mediaElementTrackChoiceManager = null;
        this._priv_contentEventsMemory = {};
        // EME cleaning
        var freeUpContentLock = function () {
            log.debug("Unlocking `contentLock`. Next content can begin.");
            _this._priv_contentLock$.next(false);
        };
        if (!isNullOrUndefined(this.videoElement)) {
            clearEMESession(this.videoElement)
                .subscribe(noop, function (err) {
                log.error("API: An error arised when trying to clean-up the EME session:" +
                    (err instanceof Error ? err.toString() :
                        "Unknown Error"));
                freeUpContentLock();
            }, function () {
                log.debug("API: EME session cleaned-up with success!");
                freeUpContentLock();
            });
        }
        else {
            freeUpContentLock();
        }
    };
    /**
     * Triggered each time the playback Observable emits.
     *
     * React to various events.
     *
     * @param {Object} event - payload emitted
     */
    Player.prototype._priv_onPlaybackEvent = function (event) {
        switch (event.type) {
            case "stream-event":
                this.trigger("streamEvent", event.value);
                break;
            case "stream-event-skip":
                this.trigger("streamEventSkip", event.value);
                break;
            case "activePeriodChanged":
                this._priv_onActivePeriodChanged(event.value);
                break;
            case "periodStreamReady":
                this._priv_onPeriodStreamReady(event.value);
                break;
            case "periodStreamCleared":
                this._priv_onPeriodStreamCleared(event.value);
                break;
            case "reloading-media-source":
                this._priv_onReloadingMediaSource();
                break;
            case "representationChange":
                this._priv_onRepresentationChange(event.value);
                break;
            case "adaptationChange":
                this._priv_onAdaptationChange(event.value);
                break;
            case "bitrateEstimationChange":
                this._priv_onBitrateEstimationChange(event.value);
                break;
            case "manifestReady":
                this._priv_onManifestReady(event.value);
                break;
            case "warning":
                this._priv_onPlaybackWarning(event.value);
                break;
            case "loaded":
                if (this._priv_contentInfos === null) {
                    log.error("API: Loaded event while no content is loaded");
                    return;
                }
                this._priv_contentInfos.segmentBuffersStore = event.value.segmentBuffersStore;
                break;
            case "decipherabilityUpdate":
                this.trigger("decipherabilityUpdate", event.value);
                break;
            case "added-segment":
                if (this._priv_contentInfos === null) {
                    log.error("API: Added segment while no content is loaded");
                    return;
                }
                // Manage image tracks
                // @deprecated
                var _a = event.value, content = _a.content, segmentData = _a.segmentData;
                if (content.adaptation.type === "image") {
                    if (!isNullOrUndefined(segmentData) &&
                        segmentData.type === "bif") {
                        var imageData = segmentData.data;
                        /* tslint:disable deprecation */
                        this._priv_contentInfos.thumbnails = imageData;
                        this.trigger("imageTrackUpdate", { data: this._priv_contentInfos.thumbnails });
                        /* tslint:enable deprecation */
                    }
                }
        }
    };
    /**
     * Triggered when we received a fatal error.
     * Clean-up ressources and signal that the content has stopped on error.
     * @param {Error} error
     */
    Player.prototype._priv_onPlaybackError = function (error) {
        var formattedError = formatError(error, {
            defaultCode: "NONE",
            defaultReason: "An unknown error stopped content playback.",
        });
        formattedError.fatal = true;
        this._priv_stopCurrentContent$.next();
        this._priv_cleanUpCurrentContentState();
        this._priv_currentError = formattedError;
        log.error("API: The player stopped because of an error:", error);
        this._priv_setPlayerState(PLAYER_STATES.STOPPED);
        // TODO This condition is here because the eventual callback called when the
        // player state is updated can launch a new content, thus the error will not
        // be here anymore, in which case triggering the "error" event is unwanted.
        // This is very ugly though, and we should probable have a better solution
        if (this._priv_currentError === formattedError) {
            this.trigger("error", formattedError);
        }
    };
    /**
     * Triggered when the playback Observable completes.
     * Clean-up ressources and signal that the content has ended.
     */
    Player.prototype._priv_onPlaybackFinished = function () {
        log.info("API: Previous playback finished. Stopping and cleaning-up...");
        this._priv_stopCurrentContent$.next();
        this._priv_cleanUpCurrentContentState();
        this._priv_setPlayerState(PLAYER_STATES.ENDED);
    };
    /**
     * Triggered when we received a warning event during playback.
     * Trigger the right API event.
     * @param {Error} error
     */
    Player.prototype._priv_onPlaybackWarning = function (error) {
        var formattedError = formatError(error, {
            defaultCode: "NONE",
            defaultReason: "An unknown error happened.",
        });
        log.warn("API: Sending warning:", formattedError);
        this.trigger("warning", formattedError);
    };
    /**
     * Triggered when the Manifest has been loaded for the current content.
     * Initialize various private properties and emit initial event.
     * @param {Object} value
     */
    Player.prototype._priv_onManifestReady = function (_a) {
        var _this = this;
        var manifest = _a.manifest;
        if (this._priv_contentInfos === null) {
            log.error("API: The manifest is loaded but no content is.");
            return;
        }
        this._priv_contentInfos.manifest = manifest;
        var _b = this._priv_contentInfos, initialAudioTrack = _b.initialAudioTrack, initialTextTrack = _b.initialTextTrack;
        this._priv_trackChoiceManager = new TrackChoiceManager();
        var preferredAudioTracks = initialAudioTrack === undefined ?
            this._priv_preferredAudioTracks :
            [initialAudioTrack];
        this._priv_trackChoiceManager.setPreferredAudioTracks(preferredAudioTracks, true);
        var preferredTextTracks = initialTextTrack === undefined ?
            this._priv_preferredTextTracks :
            [initialTextTrack];
        this._priv_trackChoiceManager.setPreferredTextTracks(preferredTextTracks, true);
        this._priv_trackChoiceManager.setPreferredVideoTracks(this._priv_preferredVideoTracks, true);
        fromEvent(manifest, "manifestUpdate")
            .pipe(takeUntil(this._priv_stopCurrentContent$))
            .subscribe(function () {
            // Update the tracks chosen if it changed
            if (_this._priv_trackChoiceManager !== null) {
                _this._priv_trackChoiceManager.update();
            }
        });
    };
    /**
     * Triggered each times the current Period Changed.
     * Store and emit initial state for the Period.
     *
     * @param {Object} value
     */
    Player.prototype._priv_onActivePeriodChanged = function (_a) {
        var _b, _c, _d, _e, _f, _g;
        var period = _a.period;
        if (this._priv_contentInfos === null) {
            log.error("API: The active period changed but no content is loaded");
            return;
        }
        this._priv_contentInfos.currentPeriod = period;
        if (this._priv_contentEventsMemory.periodChange !== period) {
            this._priv_contentEventsMemory.periodChange = period;
            this.trigger("periodChange", period);
        }
        this.trigger("availableAudioTracksChange", this.getAvailableAudioTracks());
        this.trigger("availableTextTracksChange", this.getAvailableTextTracks());
        this.trigger("availableVideoTracksChange", this.getAvailableVideoTracks());
        // Emit intial events for the Period
        if (this._priv_trackChoiceManager !== null) {
            var audioTrack = this._priv_trackChoiceManager.getChosenAudioTrack(period);
            var textTrack = this._priv_trackChoiceManager.getChosenTextTrack(period);
            var videoTrack = this._priv_trackChoiceManager.getChosenVideoTrack(period);
            this.trigger("audioTrackChange", audioTrack);
            this.trigger("textTrackChange", textTrack);
            this.trigger("videoTrackChange", videoTrack);
        }
        else {
            this.trigger("audioTrackChange", null);
            this.trigger("textTrackChange", null);
            this.trigger("videoTrackChange", null);
        }
        this._priv_triggerAvailableBitratesChangeEvent("availableAudioBitratesChange", this.getAvailableAudioBitrates());
        this._priv_triggerAvailableBitratesChangeEvent("availableVideoBitratesChange", this.getAvailableVideoBitrates());
        var audioBitrate = (_d = (_c = (_b = this._priv_getCurrentRepresentations()) === null || _b === void 0 ? void 0 : _b.audio) === null || _c === void 0 ? void 0 : _c.bitrate) !== null && _d !== void 0 ? _d : -1;
        this._priv_triggerCurrentBitrateChangeEvent("audioBitrateChange", audioBitrate);
        var videoBitrate = (_g = (_f = (_e = this._priv_getCurrentRepresentations()) === null || _e === void 0 ? void 0 : _e.video) === null || _f === void 0 ? void 0 : _f.bitrate) !== null && _g !== void 0 ? _g : -1;
        this._priv_triggerCurrentBitrateChangeEvent("videoBitrateChange", videoBitrate);
    };
    /**
     * Triggered each times a new "PeriodStream" is ready.
     * Choose the right Adaptation for the Period and emit it.
     * @param {Object} value
     */
    Player.prototype._priv_onPeriodStreamReady = function (value) {
        var type = value.type, period = value.period, adaptation$ = value.adaptation$;
        switch (type) {
            case "video":
                if (this._priv_trackChoiceManager === null) {
                    log.error("API: TrackChoiceManager not instanciated for a new video period");
                    adaptation$.next(null);
                }
                else {
                    this._priv_trackChoiceManager.addPeriod(type, period, adaptation$);
                    this._priv_trackChoiceManager.setInitialVideoTrack(period);
                }
                break;
            case "audio":
                if (this._priv_trackChoiceManager === null) {
                    log.error("API: TrackChoiceManager not instanciated for a new " + type + " period");
                    adaptation$.next(null);
                }
                else {
                    this._priv_trackChoiceManager.addPeriod(type, period, adaptation$);
                    this._priv_trackChoiceManager.setInitialAudioTrack(period);
                }
                break;
            case "text":
                if (this._priv_trackChoiceManager === null) {
                    log.error("API: TrackChoiceManager not instanciated for a new " + type + " period");
                    adaptation$.next(null);
                }
                else {
                    this._priv_trackChoiceManager.addPeriod(type, period, adaptation$);
                    this._priv_trackChoiceManager.setInitialTextTrack(period);
                }
                break;
            default:
                var adaptations = period.adaptations[type];
                if (!isNullOrUndefined(adaptations) && adaptations.length > 0) {
                    adaptation$.next(adaptations[0]);
                }
                else {
                    adaptation$.next(null);
                }
                break;
        }
    };
    /**
     * Triggered each times we "remove" a PeriodStream.
     * @param {Object} value
     */
    Player.prototype._priv_onPeriodStreamCleared = function (value) {
        var type = value.type, period = value.period;
        // Clean-up track choice from TrackChoiceManager
        switch (type) {
            case "audio":
            case "text":
            case "video":
                if (this._priv_trackChoiceManager !== null) {
                    this._priv_trackChoiceManager.removePeriod(type, period);
                }
                break;
        }
        // Clean-up stored Representation and Adaptation information
        if (this._priv_contentInfos === null) {
            return;
        }
        var _a = this._priv_contentInfos, activeAdaptations = _a.activeAdaptations, activeRepresentations = _a.activeRepresentations;
        if (!isNullOrUndefined(activeAdaptations) &&
            !isNullOrUndefined(activeAdaptations[period.id])) {
            var activePeriodAdaptations = activeAdaptations[period.id];
            delete activePeriodAdaptations[type];
            if (Object.keys(activePeriodAdaptations).length === 0) {
                delete activeAdaptations[period.id];
            }
        }
        if (!isNullOrUndefined(activeRepresentations) &&
            !isNullOrUndefined(activeRepresentations[period.id])) {
            var activePeriodRepresentations = activeRepresentations[period.id];
            delete activePeriodRepresentations[type];
            if (Object.keys(activePeriodRepresentations).length === 0) {
                delete activeRepresentations[period.id];
            }
        }
    };
    /**
     * Triggered each time the content is re-loaded on the MediaSource.
     */
    Player.prototype._priv_onReloadingMediaSource = function () {
        if (this._priv_contentInfos !== null) {
            this._priv_contentInfos.segmentBuffersStore = null;
        }
        if (this._priv_trackChoiceManager !== null) {
            this._priv_trackChoiceManager.resetPeriods();
        }
    };
    /**
     * Triggered each times a new Adaptation is considered for the current
     * content.
     * Store given Adaptation and emit it if from the current Period.
     * @param {Object} value
     */
    Player.prototype._priv_onAdaptationChange = function (_a) {
        var _b;
        var type = _a.type, adaptation = _a.adaptation, period = _a.period;
        if (this._priv_contentInfos === null) {
            log.error("API: The adaptations changed but no content is loaded");
            return;
        }
        // lazily create this._priv_contentInfos.activeAdaptations
        if (this._priv_contentInfos.activeAdaptations === null) {
            this._priv_contentInfos.activeAdaptations = {};
        }
        var _c = this._priv_contentInfos, activeAdaptations = _c.activeAdaptations, currentPeriod = _c.currentPeriod;
        var activePeriodAdaptations = activeAdaptations[period.id];
        if (isNullOrUndefined(activePeriodAdaptations)) {
            activeAdaptations[period.id] = (_b = {}, _b[type] = adaptation, _b);
        }
        else {
            activePeriodAdaptations[type] = adaptation;
        }
        if (this._priv_trackChoiceManager !== null &&
            currentPeriod !== null && !isNullOrUndefined(period) &&
            period.id === currentPeriod.id) {
            switch (type) {
                case "audio":
                    var audioTrack = this._priv_trackChoiceManager
                        .getChosenAudioTrack(currentPeriod);
                    this.trigger("audioTrackChange", audioTrack);
                    var availableAudioBitrates = this.getAvailableAudioBitrates();
                    this._priv_triggerAvailableBitratesChangeEvent("availableAudioBitratesChange", availableAudioBitrates);
                    break;
                case "text":
                    var textTrack = this._priv_trackChoiceManager
                        .getChosenTextTrack(currentPeriod);
                    this.trigger("textTrackChange", textTrack);
                    break;
                case "video":
                    var videoTrack = this._priv_trackChoiceManager
                        .getChosenVideoTrack(currentPeriod);
                    this.trigger("videoTrackChange", videoTrack);
                    var availableVideoBitrates = this.getAvailableVideoBitrates();
                    this._priv_triggerAvailableBitratesChangeEvent("availableVideoBitratesChange", availableVideoBitrates);
                    break;
            }
        }
    };
    /**
     * Triggered each times a new Representation is considered during playback.
     *
     * Store given Representation and emit it if from the current Period.
     *
     * @param {Object} obj
     */
    Player.prototype._priv_onRepresentationChange = function (_a) {
        var _b;
        var _c;
        var type = _a.type, period = _a.period, representation = _a.representation;
        if (this._priv_contentInfos === null) {
            log.error("API: The representations changed but no content is loaded");
            return;
        }
        // lazily create this._priv_contentInfos.activeRepresentations
        if (this._priv_contentInfos.activeRepresentations === null) {
            this._priv_contentInfos.activeRepresentations = {};
        }
        var _d = this._priv_contentInfos, activeRepresentations = _d.activeRepresentations, currentPeriod = _d.currentPeriod;
        var activePeriodRepresentations = activeRepresentations[period.id];
        if (isNullOrUndefined(activePeriodRepresentations)) {
            activeRepresentations[period.id] = (_b = {}, _b[type] = representation, _b);
        }
        else {
            activePeriodRepresentations[type] = representation;
        }
        var bitrate = (_c = representation === null || representation === void 0 ? void 0 : representation.bitrate) !== null && _c !== void 0 ? _c : -1;
        if (!isNullOrUndefined(period) &&
            currentPeriod !== null &&
            currentPeriod.id === period.id) {
            if (type === "video") {
                this._priv_triggerCurrentBitrateChangeEvent("videoBitrateChange", bitrate);
            }
            else if (type === "audio") {
                this._priv_triggerCurrentBitrateChangeEvent("audioBitrateChange", bitrate);
            }
        }
    };
    /**
     * Triggered each time a bitrate estimate is calculated.
     *
     * Emit it.
     *
     * @param {Object} value
     */
    Player.prototype._priv_onBitrateEstimationChange = function (_a) {
        var type = _a.type, bitrate = _a.bitrate;
        if (bitrate !== undefined) {
            this._priv_bitrateInfos.lastBitrates[type] = bitrate;
        }
        this.trigger("bitrateEstimationChange", { type: type, bitrate: bitrate });
    };
    /**
     * Triggered each time the videoElement alternates between play and pause.
     *
     * Emit the info through the right Subject.
     *
     * @param {Boolean} isPlaying
     */
    Player.prototype._priv_onPlayPauseNext = function (isPlaying) {
        if (this.videoElement === null) {
            throw new Error("Disposed player");
        }
        this._priv_playing$.next(isPlaying);
    };
    /**
     * Triggered each time a textTrack is added to the video DOM Element.
     *
     * Trigger the right Player Event.
     *
     * @param {Array.<TextTrackElement>} tracks
     */
    Player.prototype._priv_onNativeTextTracksNext = function (tracks) {
        this.trigger("nativeTextTracksChange", tracks);
    };
    /**
     * Triggered each time the player state updates.
     *
     * Trigger the right Player Event.
     *
     * @param {string} newState
     */
    Player.prototype._priv_setPlayerState = function (newState) {
        if (this.state !== newState) {
            this.state = newState;
            log.info("API: playerStateChange event", newState);
            this.trigger("playerStateChange", newState);
        }
    };
    /**
     * Triggered each time a new clock tick object is emitted.
     *
     * Trigger the right Player Event
     *
     * @param {Object} clockTick
     */
    Player.prototype._priv_triggerPositionUpdate = function (clockTick) {
        var _a;
        if (this._priv_contentInfos === null) {
            log.warn("API: Cannot perform time update: no content loaded.");
            return;
        }
        if (this.state === PLAYER_STATES.RELOADING) {
            return;
        }
        var _b = this._priv_contentInfos, isDirectFile = _b.isDirectFile, manifest = _b.manifest;
        if ((!isDirectFile && manifest === null) || isNullOrUndefined(clockTick)) {
            return;
        }
        var maximumPosition = manifest !== null ? manifest.getMaximumPosition() :
            undefined;
        var positionData = {
            position: clockTick.position,
            duration: clockTick.duration,
            playbackRate: clockTick.playbackRate,
            maximumBufferTime: maximumPosition,
            // TODO fix higher up?
            bufferGap: isFinite(clockTick.bufferGap) ? clockTick.bufferGap :
                0,
        };
        if (manifest !== null &&
            maximumPosition !== undefined &&
            manifest.isLive &&
            clockTick.position > 0) {
            var ast = (_a = manifest.availabilityStartTime) !== null && _a !== void 0 ? _a : 0;
            positionData.wallClockTime = clockTick.position + ast;
            positionData.liveGap = maximumPosition - clockTick.position;
        }
        this.trigger("positionUpdate", positionData);
    };
    /**
     * Trigger one of the "availableBitratesChange" event only if it changed from
     * the previously stored value.
     * @param {string} event
     * @param {Array.<number>} newVal
     */
    Player.prototype._priv_triggerAvailableBitratesChangeEvent = function (event, newVal) {
        var prevVal = this._priv_contentEventsMemory[event];
        if (prevVal === undefined || areArraysOfNumbersEqual(newVal, prevVal)) {
            this._priv_contentEventsMemory[event] = newVal;
            this.trigger(event, newVal);
        }
    };
    /**
     * Trigger one of the "bitrateChange" event only if it changed from the
     * previously stored value.
     * @param {string} event
     * @param {number} newVal
     */
    Player.prototype._priv_triggerCurrentBitrateChangeEvent = function (event, newVal) {
        if (newVal !== this._priv_contentEventsMemory[event]) {
            this._priv_contentEventsMemory[event] = newVal;
            this.trigger(event, newVal);
        }
    };
    Player.prototype._priv_getCurrentRepresentations = function () {
        if (this._priv_contentInfos === null) {
            return null;
        }
        var _a = this._priv_contentInfos, currentPeriod = _a.currentPeriod, activeRepresentations = _a.activeRepresentations;
        if (currentPeriod === null ||
            activeRepresentations === null ||
            isNullOrUndefined(activeRepresentations[currentPeriod.id])) {
            return null;
        }
        return activeRepresentations[currentPeriod.id];
    };
    return Player;
}(EventEmitter));
Player.version = /*PLAYER_VERSION*/ "3.22.0";
export default Player;

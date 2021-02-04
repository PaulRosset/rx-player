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
import EventEmitter from "../../utils/event_emitter";
import normalizeLanguage from "../../utils/languages";
/**
 * Check if track array is different from an other one
 * @param {Array.<Object>} oldTrackArray
 * @param {Array.<Object>} newTrackArray
 * @returns {boolean}
 */
function areTrackArraysDifferent(oldTrackArray, newTrackArray) {
    var _a;
    if (newTrackArray.length !== oldTrackArray.length) {
        return true;
    }
    for (var i = 0; i < newTrackArray.length; i++) {
        if (newTrackArray[i].nativeTrack !== ((_a = oldTrackArray[i]) === null || _a === void 0 ? void 0 : _a.nativeTrack)) {
            return true;
        }
    }
    return false;
}
/**
 * Create audio tracks from native audio tracks.
 * @param {AudioTrackList} audioTracks
 * @returns {Array.<Object>}
 */
function createAudioTracks(audioTracks) {
    var _a;
    var newAudioTracks = [];
    var languagesOccurences = {};
    for (var i = 0; i < audioTracks.length; i++) {
        var audioTrack = audioTracks[i];
        var language = audioTrack.language === "" ? "nolang" :
            audioTrack.language;
        var occurences = (_a = languagesOccurences[language]) !== null && _a !== void 0 ? _a : 1;
        var id = "gen_audio_" +
            language +
            "_" +
            occurences.toString();
        languagesOccurences[language] = occurences + 1;
        var track = { language: audioTrack.language, id: id, normalized: normalizeLanguage(audioTrack.language),
            audioDescription: false, representations: [] };
        newAudioTracks.push({ track: track, nativeTrack: audioTrack });
    }
    return newAudioTracks;
}
/**
 * Create text tracks from native text tracks.
 * @param {TextTrackList} textTracks
 * @returns {Array.<Object>}
 */
function createTextTracks(textTracks) {
    var _a;
    var newTextTracks = [];
    var languagesOccurences = {};
    for (var i = 0; i < textTracks.length; i++) {
        var textTrack = textTracks[i];
        var language = textTrack.language === "" ? "nolang" :
            textTrack.language;
        var occurences = (_a = languagesOccurences[language]) !== null && _a !== void 0 ? _a : 1;
        var id = "gen_text_" +
            language +
            "_" +
            occurences.toString();
        languagesOccurences[language] = occurences + 1;
        var track = { language: textTrack.language, id: id, normalized: normalizeLanguage(textTrack.language),
            closedCaption: textTrack.kind === "captions" };
        newTextTracks.push({ track: track, nativeTrack: textTrack });
    }
    return newTextTracks;
}
/**
 * Create video tracks from native video tracks.
 * @param {VideoTrackList} videoTracks
 * @returns {Array.<Object>}
 */
function createVideoTracks(videoTracks) {
    var _a;
    var newVideoTracks = [];
    var languagesOccurences = {};
    for (var i = 0; i < videoTracks.length; i++) {
        var videoTrack = videoTracks[i];
        var language = videoTrack.language === "" ? "nolang" :
            videoTrack.language;
        var occurences = (_a = languagesOccurences[language]) !== null && _a !== void 0 ? _a : 1;
        var id = "gen_video_" +
            language +
            "_" +
            occurences.toString();
        languagesOccurences[language] = occurences + 1;
        newVideoTracks.push({ track: { id: id,
                representations: [] }, nativeTrack: videoTrack });
    }
    return newVideoTracks;
}
/**
 * Manage video, audio and text tracks for current direct file content.
 * @class MediaElementTrackChoiceManager
 */
var MediaElementTrackChoiceManager = /** @class */ (function (_super) {
    __extends(MediaElementTrackChoiceManager, _super);
    function MediaElementTrackChoiceManager(mediaElement) {
        var _a, _b, _c;
        var _this = _super.call(this) || this;
        _this._preferredAudioTracks = [];
        _this._preferredTextTracks = [];
        _this._preferredVideoTracks = [];
        // TODO In practice, the audio/video/text tracks API are not always implemented on
        // the media element, although Typescript HTMLMediaElement types tend to mean
        // that can't be undefined.
        _this._nativeAudioTracks = mediaElement.audioTracks;
        _this._nativeVideoTracks = mediaElement.videoTracks;
        _this._nativeTextTracks = mediaElement.textTracks;
        _this._audioTracks =
            _this._nativeAudioTracks !== undefined ? createAudioTracks(_this._nativeAudioTracks) :
                [];
        _this._videoTracks =
            _this._nativeVideoTracks !== undefined ? createVideoTracks(_this._nativeVideoTracks) :
                [];
        _this._textTracks =
            _this._nativeTextTracks !== undefined ? createTextTracks(_this._nativeTextTracks) :
                [];
        _this._lastEmittedNativeAudioTrack = (_a = _this._getPrivateChosenAudioTrack()) === null || _a === void 0 ? void 0 : _a.nativeTrack;
        _this._lastEmittedNativeVideoTrack = (_b = _this._getPrivateChosenVideoTrack()) === null || _b === void 0 ? void 0 : _b.nativeTrack;
        _this._lastEmittedNativeTextTrack = (_c = _this._getPrivateChosenTextTrack()) === null || _c === void 0 ? void 0 : _c.nativeTrack;
        _this._handleNativeTracksCallbacks();
        return _this;
    }
    /**
     * Set the list of preferred audio tracks, in preference order.
     * @param {Array.<Object>} preferredAudioTracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    MediaElementTrackChoiceManager.prototype.setPreferredAudioTracks = function (preferredAudioTracks, shouldApply) {
        this._preferredAudioTracks = preferredAudioTracks;
        if (shouldApply) {
            this._applyAudioPreferences();
        }
    };
    /**
     * Set the list of preferred text tracks, in preference order.
     * @param {Array.<Object>} preferredTextTracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    MediaElementTrackChoiceManager.prototype.setPreferredTextTracks = function (preferredTextTracks, shouldApply) {
        this._preferredTextTracks = preferredTextTracks;
        if (shouldApply) {
            this._applyTextPreferences();
        }
    };
    /**
     * Set the list of preferred video tracks, in preference order.
     * @param {Array.<Object>} preferredVideoTracks
     * @param {boolean} shouldApply - `true` if those preferences should be
     * applied on the currently loaded Period. `false` if it should only
     * be applied to new content.
     */
    MediaElementTrackChoiceManager.prototype.setPreferredVideoTracks = function (preferredVideoTracks, shouldApply) {
        this._preferredVideoTracks = preferredVideoTracks;
        if (shouldApply) {
            this._applyVideoPreferences();
        }
    };
    /**
     * Update the currently active audio track by setting the wanted audio track's
     * ID property.
     * Throws if the wanted audio track is not found.
     * @param {string|number|undefined} id
     */
    MediaElementTrackChoiceManager.prototype.setAudioTrackById = function (id) {
        for (var i = 0; i < this._audioTracks.length; i++) {
            var _a = this._audioTracks[i], track = _a.track, nativeTrack = _a.nativeTrack;
            if (track.id === id) {
                nativeTrack.enabled = true;
                this._audioTrackLockedOn = nativeTrack;
                return;
            }
        }
        throw new Error("Audio track not found.");
    };
    /**
     * Disable the currently-active text track, if one.
     */
    MediaElementTrackChoiceManager.prototype.disableTextTrack = function () {
        disableTextTracks(this._textTracks);
        this._textTrackLockedOn = null;
    };
    /**
     * Update the currently active text track by setting the wanted text track's
     * ID property.
     * Throws if the wanted text track is not found.
     * @param {string|number|undefined} id
     */
    MediaElementTrackChoiceManager.prototype.setTextTrackById = function (id) {
        var hasSetTrack = false;
        for (var i = 0; i < this._textTracks.length; i++) {
            var _a = this._textTracks[i], track = _a.track, nativeTrack = _a.nativeTrack;
            if (track.id === id) {
                nativeTrack.mode = "showing";
                hasSetTrack = true;
                this._textTrackLockedOn = nativeTrack;
            }
            else if (nativeTrack.mode === "showing" || nativeTrack.mode === "hidden") {
                nativeTrack.mode = "disabled";
            }
        }
        if (!hasSetTrack) {
            throw new Error("Text track not found.");
        }
    };
    /**
     * Disable the currently-active video track, if one.
     */
    MediaElementTrackChoiceManager.prototype.disableVideoTrack = function () {
        disableVideoTracks(this._videoTracks);
        this._videoTrackLockedOn = null;
    };
    /**
     * Update the currently active video track by setting the wanted video track's
     * ID property.
     * Throws if the wanted video track is not found.
     * @param {string|number|undefined} id
     */
    MediaElementTrackChoiceManager.prototype.setVideoTrackById = function (id) {
        for (var i = 0; i < this._videoTracks.length; i++) {
            var _a = this._videoTracks[i], track = _a.track, nativeTrack = _a.nativeTrack;
            if (track.id === id) {
                nativeTrack.selected = true;
                this._videoTrackLockedOn = nativeTrack;
                return;
            }
        }
        throw new Error("Video track not found.");
    };
    /**
     * Returns the currently active audio track.
     * Returns `null` if no audio track is active.
     * Returns `undefined` if we cannot know which audio track is active.
     * @returns {Object|null|undefined}
     */
    MediaElementTrackChoiceManager.prototype.getChosenAudioTrack = function () {
        var chosenPrivateAudioTrack = this._getPrivateChosenAudioTrack();
        if (chosenPrivateAudioTrack != null) {
            return chosenPrivateAudioTrack.track;
        }
        return chosenPrivateAudioTrack;
    };
    /**
     * Returns the currently active text track.
     * Returns `null` if no text track is active.
     * Returns `undefined` if we cannot know which text track is active.
     * @returns {Object|null|undefined}
     */
    MediaElementTrackChoiceManager.prototype.getChosenTextTrack = function () {
        var chosenPrivateTextTrack = this._getPrivateChosenTextTrack();
        if (chosenPrivateTextTrack != null) {
            return chosenPrivateTextTrack.track;
        }
        return chosenPrivateTextTrack;
    };
    /**
     * Returns the currently active video track.
     * Returns `null` if no video track is active.
     * Returns `undefined` if we cannot know which video track is active.
     * @returns {Object|null|undefined}
     */
    MediaElementTrackChoiceManager.prototype.getChosenVideoTrack = function () {
        var chosenPrivateVideoTrack = this._getPrivateChosenVideoTrack();
        if (chosenPrivateVideoTrack != null) {
            return chosenPrivateVideoTrack.track;
        }
        return chosenPrivateVideoTrack;
    };
    /**
     * Returns a description of every available audio tracks.
     * @returns {Array.<Object>}
     */
    MediaElementTrackChoiceManager.prototype.getAvailableAudioTracks = function () {
        return this._audioTracks.map(function (_a) {
            var track = _a.track, nativeTrack = _a.nativeTrack;
            return { id: track.id,
                language: track.language,
                normalized: track.normalized,
                audioDescription: track.audioDescription,
                active: nativeTrack.enabled,
                representations: track.representations };
        });
    };
    /**
     * Returns a description of every available text tracks.
     * @returns {Array.<Object>}
     */
    MediaElementTrackChoiceManager.prototype.getAvailableTextTracks = function () {
        return this._textTracks.map(function (_a) {
            var track = _a.track, nativeTrack = _a.nativeTrack;
            return { id: track.id,
                language: track.language,
                normalized: track.normalized,
                closedCaption: track.closedCaption,
                active: nativeTrack.mode === "showing" };
        });
    };
    /**
     * Returns a description of every available video tracks.
     * @returns {Array.<Object>}
     */
    MediaElementTrackChoiceManager.prototype.getAvailableVideoTracks = function () {
        return this._videoTracks.map(function (_a) {
            var track = _a.track, nativeTrack = _a.nativeTrack;
            return { id: track.id,
                representations: track.representations,
                active: nativeTrack.selected };
        });
    };
    /**
     * Free the resources used by the MediaElementTrackChoiceManager.
     */
    MediaElementTrackChoiceManager.prototype.dispose = function () {
        if (this._nativeVideoTracks !== undefined) {
            this._nativeVideoTracks.onchange = null;
            this._nativeVideoTracks.onaddtrack = null;
            this._nativeVideoTracks.onremovetrack = null;
        }
        if (this._nativeAudioTracks !== undefined) {
            this._nativeAudioTracks.onchange = null;
            this._nativeAudioTracks.onaddtrack = null;
            this._nativeAudioTracks.onremovetrack = null;
        }
        if (this._nativeTextTracks !== undefined) {
            this._nativeTextTracks.onchange = null;
            this._nativeTextTracks.onaddtrack = null;
            this._nativeTextTracks.onremovetrack = null;
        }
        this.removeEventListener();
    };
    /**
     * Get information about the currently chosen audio track.
     * `undefined` if we cannot know it.
     * `null` if no audio track is chosen.
     * @returns {Object|undefined|null}
     */
    MediaElementTrackChoiceManager.prototype._getPrivateChosenAudioTrack = function () {
        if (this._nativeAudioTracks === undefined) {
            return undefined;
        }
        for (var i = 0; i < this._audioTracks.length; i++) {
            var audioTrack = this._audioTracks[i];
            if (audioTrack.nativeTrack.enabled) {
                return audioTrack;
            }
        }
        return null;
    };
    /**
     * Get information about the currently chosen video track.
     * `undefined` if we cannot know it.
     * `null` if no video track is chosen.
     * @returns {Object|undefined|null}
     */
    MediaElementTrackChoiceManager.prototype._getPrivateChosenVideoTrack = function () {
        if (this._nativeVideoTracks === undefined) {
            return undefined;
        }
        for (var i = 0; i < this._videoTracks.length; i++) {
            var videoTrack = this._videoTracks[i];
            if (videoTrack.nativeTrack.selected) {
                return videoTrack;
            }
        }
        return null;
    };
    /**
     * Get information about the currently chosen text track.
     * `undefined` if we cannot know it.
     * `null` if no text track is chosen.
     * @returns {Object|undefined|null}
     */
    MediaElementTrackChoiceManager.prototype._getPrivateChosenTextTrack = function () {
        if (this._nativeTextTracks === undefined) {
            return undefined;
        }
        for (var i = 0; i < this._textTracks.length; i++) {
            var textTrack = this._textTracks[i];
            if (textTrack.nativeTrack.mode === "showing") {
                return textTrack;
            }
        }
        return null;
    };
    /**
     * Iterate over every available audio tracks on the media element and either:
     *   - if the last manually set audio track is found, set that one.
     *   - if not, set the most preferred one
     *   - if we still do not find an optimal track, let the one chosen by default
     */
    MediaElementTrackChoiceManager.prototype._setOptimalAudioTrack = function () {
        // First check if the last set track is available, set it if that's the case
        if (this._audioTrackLockedOn !== undefined) {
            for (var i = 0; i < this._audioTracks.length; i++) {
                var nativeTrack = this._audioTracks[i].nativeTrack;
                if (nativeTrack === this._audioTrackLockedOn) {
                    nativeTrack.enabled = true;
                    return;
                }
            }
        }
        this._applyAudioPreferences();
    };
    /**
     * Try to find a track corresponding to the audio track preferences:
     *   - if found, set it as the active track
     *   - if not found, let the chosen audio track by default
     */
    MediaElementTrackChoiceManager.prototype._applyAudioPreferences = function () {
        // Re-set the last manually set audio track
        this._audioTrackLockedOn = undefined;
        var preferredAudioTracks = this._preferredAudioTracks;
        for (var i = 0; i < preferredAudioTracks.length; i++) {
            var track = preferredAudioTracks[i];
            if (track !== null && track.language !== undefined) {
                var normalized = normalizeLanguage(track.language);
                for (var j = 0; j < this._audioTracks.length; j++) {
                    var audioTrack = this._audioTracks[j];
                    if (audioTrack.track.normalized === normalized &&
                        audioTrack.track.audioDescription === track.audioDescription) {
                        audioTrack.nativeTrack.enabled = true;
                        return;
                    }
                }
            }
        }
        // else just let the default one instead
    };
    /**
     * Iterate over every available text tracks on the media element and either:
     *   - if the last manually set text track is found, set that one.
     *   - if not, set the most preferred one
     *   - if we still do not find an optimal track, just disable it.
     */
    MediaElementTrackChoiceManager.prototype._setOptimalTextTrack = function () {
        // First check if the last set track is available, set it if that's the case
        if (this._textTrackLockedOn === null) {
            disableTextTracks(this._textTracks);
            return;
        }
        else if (this._textTrackLockedOn !== undefined) {
            for (var i = 0; i < this._textTracks.length; i++) {
                var nativeTrack = this._textTracks[i].nativeTrack;
                if (nativeTrack === this._textTrackLockedOn) {
                    // disable the rest
                    disableAllTextTracksBut(this._textTracks, nativeTrack);
                    if (nativeTrack.mode !== "showing") {
                        nativeTrack.mode = "showing";
                    }
                    return;
                }
            }
        }
        // Else set the preferred one
        this._applyTextPreferences();
    };
    /**
     * Try to find a track corresponding to the text track preferences:
     *   - if found, set it as the active track
     *   - if not found, let the chosen text track by default
     */
    MediaElementTrackChoiceManager.prototype._applyTextPreferences = function () {
        // Re-set the last manually set audio track
        this._textTrackLockedOn = undefined;
        var preferredTextTracks = this._preferredTextTracks;
        for (var i = 0; i < preferredTextTracks.length; i++) {
            var track = preferredTextTracks[i];
            if (track === null) {
                disableTextTracks(this._textTracks);
                return;
            }
            var normalized = normalizeLanguage(track.language);
            for (var j = 0; j < this._textTracks.length; j++) {
                var textTrack = this._textTracks[j];
                if (textTrack.track.normalized === normalized &&
                    textTrack.track.closedCaption === track.closedCaption) {
                    // disable the rest
                    disableAllTextTracksBut(this._textTracks, textTrack.nativeTrack);
                    if (textTrack.nativeTrack.mode !== "showing") {
                        textTrack.nativeTrack.mode = "showing";
                    }
                    return;
                }
            }
        }
        // Else just disable text tracks
        disableTextTracks(this._textTracks);
    };
    /**
     * Iterate over every available video tracks on the media element and either:
     *   - if the last manually set video track is found, set that one.
     *   - if not, set the most preferred one
     *   - if we still do not find an optimal track, let the one chosen by default
     */
    MediaElementTrackChoiceManager.prototype._setOptimalVideoTrack = function () {
        // 1. first check if the last set track is available, set it if that's the case
        if (this._videoTrackLockedOn === null) {
            disableVideoTracks(this._videoTracks);
            return;
        }
        else if (this._videoTrackLockedOn !== undefined) {
            for (var i = 0; i < this._videoTracks.length; i++) {
                var nativeTrack = this._videoTracks[i].nativeTrack;
                if (nativeTrack === this._videoTrackLockedOn) {
                    nativeTrack.selected = true;
                    return;
                }
            }
        }
        // Else set the preferred one
        this._applyVideoPreferences();
    };
    /**
     * Try to find a track corresponding to the text track preferences:
     *   - if found, set it as the active track
     *   - if not found, let the chosen text track by default
     */
    MediaElementTrackChoiceManager.prototype._applyVideoPreferences = function () {
        // Re-set the last manually set video track
        this._videoTrackLockedOn = undefined;
        // NOTE: As we cannot access either codec information or sign interpretation
        // information easily about the different codecs. It is the same case than
        // if we had only tracks where those were set to undefined.
        // Based on that, we should disable the video track as long as one of the
        // set preferrence is "no video track" (i.e. `null`) as this is the only
        // constraint that we know we can respect.
        // Else, just chose the first track.
        var preferredVideoTracks = this._preferredVideoTracks;
        var hasNullPreference = preferredVideoTracks.some(function (p) { return p === null; });
        if (hasNullPreference) {
            disableVideoTracks(this._videoTracks);
        }
        // else just let the default one instead
    };
    /**
     * Monitor native tracks add, remove and change callback and trigger the
     * change events.
     */
    MediaElementTrackChoiceManager.prototype._handleNativeTracksCallbacks = function () {
        var _this = this;
        if (this._nativeAudioTracks !== undefined) {
            this._nativeAudioTracks.onaddtrack = function () {
                var _a, _b;
                if (_this._nativeAudioTracks !== undefined) {
                    var newAudioTracks = createAudioTracks(_this._nativeAudioTracks);
                    if (areTrackArraysDifferent(_this._audioTracks, newAudioTracks)) {
                        _this._audioTracks = newAudioTracks;
                        _this._setOptimalAudioTrack();
                        _this.trigger("availableAudioTracksChange", _this.getAvailableAudioTracks());
                        var chosenAudioTrack = _this._getPrivateChosenAudioTrack();
                        if ((chosenAudioTrack === null || chosenAudioTrack === void 0 ? void 0 : chosenAudioTrack.nativeTrack) !== _this._lastEmittedNativeAudioTrack) {
                            _this.trigger("audioTrackChange", (_a = chosenAudioTrack === null || chosenAudioTrack === void 0 ? void 0 : chosenAudioTrack.track) !== null && _a !== void 0 ? _a : null);
                            _this._lastEmittedNativeAudioTrack = (_b = chosenAudioTrack === null || chosenAudioTrack === void 0 ? void 0 : chosenAudioTrack.nativeTrack) !== null && _b !== void 0 ? _b : null;
                        }
                    }
                }
            };
            this._nativeAudioTracks.onremovetrack = function () {
                var _a, _b;
                if (_this._nativeAudioTracks !== undefined) {
                    var newAudioTracks = createAudioTracks(_this._nativeAudioTracks);
                    if (areTrackArraysDifferent(_this._audioTracks, newAudioTracks)) {
                        _this._audioTracks = newAudioTracks;
                        _this.trigger("availableAudioTracksChange", _this.getAvailableAudioTracks());
                        var chosenAudioTrack = _this._getPrivateChosenAudioTrack();
                        if ((chosenAudioTrack === null || chosenAudioTrack === void 0 ? void 0 : chosenAudioTrack.nativeTrack) !== _this._lastEmittedNativeAudioTrack) {
                            _this.trigger("audioTrackChange", (_a = chosenAudioTrack === null || chosenAudioTrack === void 0 ? void 0 : chosenAudioTrack.track) !== null && _a !== void 0 ? _a : null);
                            _this._lastEmittedNativeAudioTrack = (_b = chosenAudioTrack === null || chosenAudioTrack === void 0 ? void 0 : chosenAudioTrack.nativeTrack) !== null && _b !== void 0 ? _b : null;
                        }
                    }
                }
            };
            this._nativeAudioTracks.onchange = function () {
                if (_this._audioTracks !== undefined) {
                    for (var i = 0; i < _this._audioTracks.length; i++) {
                        var _a = _this._audioTracks[i], track = _a.track, nativeTrack = _a.nativeTrack;
                        if (nativeTrack.enabled) {
                            if (nativeTrack !== _this._lastEmittedNativeAudioTrack) {
                                _this.trigger("audioTrackChange", track);
                                _this._lastEmittedNativeAudioTrack = nativeTrack;
                            }
                            return;
                        }
                    }
                }
                if (_this._lastEmittedNativeAudioTrack !== null) {
                    _this.trigger("audioTrackChange", null);
                    _this._lastEmittedNativeAudioTrack = null;
                }
                return;
            };
        }
        if (this._nativeTextTracks !== undefined) {
            this._nativeTextTracks.onaddtrack = function () {
                var _a, _b;
                if (_this._nativeTextTracks !== undefined) {
                    var newTextTracks = createTextTracks(_this._nativeTextTracks);
                    if (areTrackArraysDifferent(_this._textTracks, newTextTracks)) {
                        _this._textTracks = newTextTracks;
                        _this._setOptimalTextTrack();
                        _this.trigger("availableTextTracksChange", _this.getAvailableTextTracks());
                        var chosenTextTrack = _this._getPrivateChosenTextTrack();
                        if ((chosenTextTrack === null || chosenTextTrack === void 0 ? void 0 : chosenTextTrack.nativeTrack) !== _this._lastEmittedNativeTextTrack) {
                            _this.trigger("textTrackChange", (_a = chosenTextTrack === null || chosenTextTrack === void 0 ? void 0 : chosenTextTrack.track) !== null && _a !== void 0 ? _a : null);
                            _this._lastEmittedNativeTextTrack = (_b = chosenTextTrack === null || chosenTextTrack === void 0 ? void 0 : chosenTextTrack.nativeTrack) !== null && _b !== void 0 ? _b : null;
                        }
                    }
                }
            };
            this._nativeTextTracks.onremovetrack = function () {
                var _a, _b;
                if (_this._nativeTextTracks !== undefined) {
                    var newTextTracks = createTextTracks(_this._nativeTextTracks);
                    if (areTrackArraysDifferent(_this._textTracks, newTextTracks)) {
                        _this._textTracks = newTextTracks;
                        _this._setOptimalTextTrack();
                        _this.trigger("availableTextTracksChange", _this.getAvailableTextTracks());
                        var chosenTextTrack = _this._getPrivateChosenTextTrack();
                        if ((chosenTextTrack === null || chosenTextTrack === void 0 ? void 0 : chosenTextTrack.nativeTrack) !== _this._lastEmittedNativeTextTrack) {
                            _this.trigger("textTrackChange", (_a = chosenTextTrack === null || chosenTextTrack === void 0 ? void 0 : chosenTextTrack.track) !== null && _a !== void 0 ? _a : null);
                            _this._lastEmittedNativeTextTrack = (_b = chosenTextTrack === null || chosenTextTrack === void 0 ? void 0 : chosenTextTrack.nativeTrack) !== null && _b !== void 0 ? _b : null;
                        }
                    }
                }
            };
            this._nativeTextTracks.onchange = function () {
                if (_this._textTracks !== undefined) {
                    for (var i = 0; i < _this._textTracks.length; i++) {
                        var _a = _this._textTracks[i], track = _a.track, nativeTrack = _a.nativeTrack;
                        if (nativeTrack.mode === "showing") {
                            if (nativeTrack !== _this._lastEmittedNativeTextTrack) {
                                _this.trigger("textTrackChange", track);
                                _this._lastEmittedNativeTextTrack = nativeTrack;
                            }
                            return;
                        }
                    }
                }
                if (_this._lastEmittedNativeTextTrack !== null) {
                    _this.trigger("textTrackChange", null);
                    _this._lastEmittedNativeTextTrack = null;
                }
                return;
            };
        }
        if (this._nativeVideoTracks !== undefined) {
            this._nativeVideoTracks.onaddtrack = function () {
                var _a, _b;
                if (_this._nativeVideoTracks !== undefined) {
                    var newVideoTracks = createVideoTracks(_this._nativeVideoTracks);
                    if (areTrackArraysDifferent(_this._videoTracks, newVideoTracks)) {
                        _this._videoTracks = newVideoTracks;
                        _this._setOptimalVideoTrack();
                        _this.trigger("availableVideoTracksChange", _this.getAvailableVideoTracks());
                        var chosenVideoTrack = _this._getPrivateChosenVideoTrack();
                        if ((chosenVideoTrack === null || chosenVideoTrack === void 0 ? void 0 : chosenVideoTrack.nativeTrack) !== _this._lastEmittedNativeVideoTrack) {
                            _this.trigger("videoTrackChange", (_a = chosenVideoTrack === null || chosenVideoTrack === void 0 ? void 0 : chosenVideoTrack.track) !== null && _a !== void 0 ? _a : null);
                            _this._lastEmittedNativeVideoTrack = (_b = chosenVideoTrack === null || chosenVideoTrack === void 0 ? void 0 : chosenVideoTrack.nativeTrack) !== null && _b !== void 0 ? _b : null;
                        }
                    }
                }
            };
            this._nativeVideoTracks.onremovetrack = function () {
                var _a, _b;
                if (_this._nativeVideoTracks !== undefined) {
                    var newVideoTracks = createVideoTracks(_this._nativeVideoTracks);
                    if (areTrackArraysDifferent(_this._videoTracks, newVideoTracks)) {
                        _this._videoTracks = newVideoTracks;
                        _this._setOptimalVideoTrack();
                        _this.trigger("availableVideoTracksChange", _this.getAvailableVideoTracks());
                        var chosenVideoTrack = _this._getPrivateChosenVideoTrack();
                        if ((chosenVideoTrack === null || chosenVideoTrack === void 0 ? void 0 : chosenVideoTrack.nativeTrack) !== _this._lastEmittedNativeVideoTrack) {
                            _this.trigger("videoTrackChange", (_a = chosenVideoTrack === null || chosenVideoTrack === void 0 ? void 0 : chosenVideoTrack.track) !== null && _a !== void 0 ? _a : null);
                            _this._lastEmittedNativeVideoTrack = (_b = chosenVideoTrack === null || chosenVideoTrack === void 0 ? void 0 : chosenVideoTrack.nativeTrack) !== null && _b !== void 0 ? _b : null;
                        }
                    }
                }
            };
            this._nativeVideoTracks.onchange = function () {
                if (_this._videoTracks !== undefined) {
                    for (var i = 0; i < _this._videoTracks.length; i++) {
                        var _a = _this._videoTracks[i], track = _a.track, nativeTrack = _a.nativeTrack;
                        if (nativeTrack.selected) {
                            if (nativeTrack !== _this._lastEmittedNativeVideoTrack) {
                                _this.trigger("videoTrackChange", track);
                                _this._lastEmittedNativeVideoTrack = nativeTrack;
                            }
                            return;
                        }
                    }
                }
                if (_this._lastEmittedNativeVideoTrack !== null) {
                    _this.trigger("videoTrackChange", null);
                    _this._lastEmittedNativeVideoTrack = null;
                }
                return;
            };
        }
    };
    return MediaElementTrackChoiceManager;
}(EventEmitter));
export default MediaElementTrackChoiceManager;
/**
 * Disable all text track elements in the given array from showing.
 * @param {Array.<Object>} textTracks
 */
function disableTextTracks(textTracks) {
    for (var i = 0; i < textTracks.length; i++) {
        var nativeTrack = textTracks[i].nativeTrack;
        nativeTrack.mode = "disabled";
    }
}
/**
 * Disable all text track elements in the given array from showing but one which
 * should stay in the same state it was before.
 * @param {Array.<Object>} textTracks
 * @param {TextTrack} track
 */
function disableAllTextTracksBut(textTracks, track) {
    for (var i = 0; i < textTracks.length; i++) {
        var nativeTrack = textTracks[i].nativeTrack;
        if (nativeTrack !== track &&
            (nativeTrack.mode === "showing" || nativeTrack.mode === "hidden")) {
            nativeTrack.mode = "disabled";
        }
    }
}
/**
 * Disable all video track elements in the given array from showing.
 * Note that browser need to support that use case, which they often do not.
 * @param {Array.<Object>} videoTracks
 */
function disableVideoTracks(videoTracks) {
    for (var i = 0; i < videoTracks.length; i++) {
        var nativeTrack = videoTracks[i].nativeTrack;
        nativeTrack.selected = false;
    }
}

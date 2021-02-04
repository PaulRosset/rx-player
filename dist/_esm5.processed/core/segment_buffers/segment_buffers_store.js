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
import { Observable, of as observableOf, } from "rxjs";
import { MediaError } from "../../errors";
import features from "../../features";
import log from "../../log";
import { AudioVideoSegmentBuffer, } from "./implementations";
var POSSIBLE_BUFFER_TYPES = ["audio",
    "video",
    "text",
    "image"];
/**
 * Allows to easily create and dispose SegmentBuffers, which are interfaces to
 * push and remove segments.
 *
 * Only one SegmentBuffer per type is allowed at the same time:
 *
 *   - SegmentBuffers linked to a "native" media buffer (relying on a
 *     SourceBuffer: "audio" and "video" here) are reused if one is
 *     re-created.
 *
 *   - SegmentBuffers for custom types (the other types of media) are aborted
 *     each time a new one of the same type is created.
 *
 * To be able to use a SegmentBuffer linked to a native media buffer, you
 * will first need to create it, but also wait until the other one is either
 * created or explicitely disabled through the `disableSegmentBuffer` method.
 * The Observable returned by `waitForUsableBuffers` will emit when
 * that is the case.
 *
 * @class SegmentBuffersStore
 */
var SegmentBuffersStore = /** @class */ (function () {
    /**
     * @param {HTMLMediaElement} mediaElement
     * @param {MediaSource} mediaSource
     * @constructor
     */
    function SegmentBuffersStore(mediaElement, mediaSource) {
        this._mediaElement = mediaElement;
        this._mediaSource = mediaSource;
        this._initializedSegmentBuffers = {};
        this._onNativeBufferAddedOrDisabled = [];
    }
    /**
     * Returns true if the type is linked to a "native" media buffer (i.e. relying
     * on a SourceBuffer object, native to the browser).
     * Native media buffers needed for the current content must all be created
     * before the content begins to be played and cannot be disposed during
     * playback.
     * @param {string} bufferType
     * @returns {Boolean}
     */
    SegmentBuffersStore.isNative = function (bufferType) {
        return shouldHaveNativeBuffer(bufferType);
    };
    /**
     * Get all currently available buffer types.
     * /!\ This list can evolve at runtime depending on feature switching.
     * @returns {Array.<string>}
     */
    SegmentBuffersStore.prototype.getBufferTypes = function () {
        var bufferTypes = this.getNativeBufferTypes();
        if (features.nativeTextTracksBuffer != null ||
            features.htmlTextTracksBuffer != null) {
            bufferTypes.push("text");
        }
        if (features.imageBuffer != null) {
            bufferTypes.push("image");
        }
        return bufferTypes;
    };
    /**
     * Get all "native" buffer types that should be created before beginning to
     * push contents.
     * @returns {Array.<string>}
     */
    SegmentBuffersStore.prototype.getNativeBufferTypes = function () {
        return this._mediaElement.nodeName === "AUDIO" ? ["audio"] :
            ["video", "audio"];
    };
    /**
     * Returns the current "status" of the SegmentBuffer linked to the buffer
     * type given.
     *
     * This function will return  an object containing a key named `type` which
     * can be equal to either one of those three value:
     *
     *   - "initialized": A SegmentBuffer has been created for that type.
     *     You will in this case also have a second key, `value`, which will
     *     contain the related SegmentBuffer instance.
     *     Please note that you will need to wait until
     *     `this.waitForUsableBuffers()` has emitted before pushing segment
     *     data to a SegmentBuffer relying on a SourceBuffer.
     *
     *   - "disabled": The SegmentBuffer has been explicitely disabled for this
     *     type.
     *
     *   - "uninitialized": No action has yet been yet for that SegmentBuffer.
     *
     * @param {string} bufferType
     * @returns {Object|null}
     */
    SegmentBuffersStore.prototype.getStatus = function (bufferType) {
        var initializedBuffer = this._initializedSegmentBuffers[bufferType];
        return initializedBuffer === undefined ? { type: "uninitialized" } :
            initializedBuffer === null ? { type: "disabled" } :
                { type: "initialized",
                    value: initializedBuffer };
    };
    /**
     * Native media buffers (audio and video) needed for playing the current
     * content need to all be created (by creating SegmentBuffers linked to them)
     * before any one can be used.
     *
     * This function will return an Observable emitting when any and all native
     * SourceBuffers can be used.
     *
     * From https://w3c.github.io/media-source/#methods
     *   For example, a user agent may throw a QuotaExceededError
     *   exception if the media element has reached the HAVE_METADATA
     *   readyState. This can occur if the user agent's media engine
     *   does not support adding more tracks during playback.
     * @return {Observable}
     */
    SegmentBuffersStore.prototype.waitForUsableBuffers = function () {
        var _this = this;
        if (this._areNativeBuffersUsable()) {
            return observableOf(undefined);
        }
        return new Observable(function (obs) {
            _this._onNativeBufferAddedOrDisabled.push(function () {
                if (_this._areNativeBuffersUsable()) {
                    obs.next(undefined);
                    obs.complete();
                }
            });
        });
    };
    /**
     * Explicitely disable the SegmentBuffer for a given buffer type.
     * A call to this function is needed at least for unused native buffer types
     * (usually "audio" and "video"), to be able to emit through
     * `waitForUsableBuffers` when conditions are met.
     * @param {string}
     */
    SegmentBuffersStore.prototype.disableSegmentBuffer = function (bufferType) {
        var currentValue = this._initializedSegmentBuffers[bufferType];
        if (currentValue === null) {
            log.warn("SBS: The " + bufferType + " SegmentBuffer was already disabled.");
            return;
        }
        if (currentValue !== undefined) {
            throw new Error("Cannot disable an active SegmentBuffer.");
        }
        this._initializedSegmentBuffers[bufferType] = null;
        if (SegmentBuffersStore.isNative(bufferType)) {
            this._onNativeBufferAddedOrDisabled.forEach(function (cb) { return cb(); });
        }
    };
    /**
     * Creates a new SegmentBuffer associated to a type.
     * Reuse an already created one if a SegmentBuffer for the given type
     * already exists.
     *
     * Please note that you will need to wait until `this.waitForUsableBuffers()`
     * has emitted before pushing segment data to a SegmentBuffer of a native
     * type.
     * @param {string} bufferType
     * @param {string} codec
     * @param {Object|undefined} options
     * @returns {Object}
     */
    SegmentBuffersStore.prototype.createSegmentBuffer = function (bufferType, codec, options) {
        if (options === void 0) { options = {}; }
        var memorizedSegmentBuffer = this._initializedSegmentBuffers[bufferType];
        if (shouldHaveNativeBuffer(bufferType)) {
            if (memorizedSegmentBuffer != null) {
                if (memorizedSegmentBuffer instanceof AudioVideoSegmentBuffer &&
                    memorizedSegmentBuffer.codec !== codec) {
                    log.warn("SB: Reusing native SegmentBuffer with codec", memorizedSegmentBuffer.codec, "for codec", codec);
                }
                else {
                    log.info("SB: Reusing native SegmentBuffer with codec", codec);
                }
                return memorizedSegmentBuffer;
            }
            log.info("SB: Adding native SegmentBuffer with codec", codec);
            var nativeSegmentBuffer = new AudioVideoSegmentBuffer(bufferType, codec, this._mediaSource);
            this._initializedSegmentBuffers[bufferType] = nativeSegmentBuffer;
            this._onNativeBufferAddedOrDisabled.forEach(function (cb) { return cb(); });
            return nativeSegmentBuffer;
        }
        if (memorizedSegmentBuffer != null) {
            log.info("SB: Reusing a previous custom SegmentBuffer for the type", bufferType);
            return memorizedSegmentBuffer;
        }
        var segmentBuffer;
        if (bufferType === "text") {
            log.info("SB: Creating a new text SegmentBuffer");
            if (options.textTrackMode === "html") {
                if (features.htmlTextTracksBuffer == null) {
                    throw new Error("HTML Text track feature not activated");
                }
                segmentBuffer = new features.htmlTextTracksBuffer(this._mediaElement, options.textTrackElement);
            }
            else {
                if (features.nativeTextTracksBuffer == null) {
                    throw new Error("Native Text track feature not activated");
                }
                segmentBuffer = new features
                    .nativeTextTracksBuffer(this._mediaElement, options.hideNativeSubtitle === true);
            }
            this._initializedSegmentBuffers.text = segmentBuffer;
            return segmentBuffer;
        }
        else if (bufferType === "image") {
            if (features.imageBuffer == null) {
                throw new Error("Image buffer feature not activated");
            }
            log.info("SB: Creating a new image SegmentBuffer");
            segmentBuffer = new features.imageBuffer();
            this._initializedSegmentBuffers.image = segmentBuffer;
            return segmentBuffer;
        }
        log.error("SB: Unknown buffer type:", bufferType);
        throw new MediaError("BUFFER_TYPE_UNKNOWN", "The player wants to create a SegmentBuffer " +
            "of an unknown type.");
    };
    /**
     * Dispose of the active SegmentBuffer for the given type.
     * @param {string} bufferType
     */
    SegmentBuffersStore.prototype.disposeSegmentBuffer = function (bufferType) {
        var memorizedSegmentBuffer = this._initializedSegmentBuffers[bufferType];
        if (memorizedSegmentBuffer == null) {
            log.warn("SB: Trying to dispose a SegmentBuffer that does not exist");
            return;
        }
        log.info("SB: Aborting SegmentBuffer", bufferType);
        memorizedSegmentBuffer.dispose();
        delete this._initializedSegmentBuffers[bufferType];
    };
    /**
     * Dispose of all SegmentBuffer created on this SegmentBuffersStore.
     */
    SegmentBuffersStore.prototype.disposeAll = function () {
        var _this = this;
        POSSIBLE_BUFFER_TYPES.forEach(function (bufferType) {
            if (_this.getStatus(bufferType).type === "initialized") {
                _this.disposeSegmentBuffer(bufferType);
            }
        });
    };
    /**
     * Returns `true` when we're ready to push and decode contents to
     * SourceBuffers created by SegmentBuffers of a native buffer type.
     */
    SegmentBuffersStore.prototype._areNativeBuffersUsable = function () {
        var _this = this;
        var nativeBufferTypes = this.getNativeBufferTypes();
        var hasUnitializedBuffers = nativeBufferTypes.some(function (sbType) {
            return _this._initializedSegmentBuffers[sbType] === undefined;
        });
        if (hasUnitializedBuffers) {
            // one is not yet initialized/disabled
            return false;
        }
        var areAllDisabled = nativeBufferTypes.every(function (sbType) {
            return _this._initializedSegmentBuffers[sbType] === null;
        });
        if (areAllDisabled) {
            // they all are disabled: we can't play the content
            return false;
        }
        return true;
    };
    return SegmentBuffersStore;
}());
export default SegmentBuffersStore;
/**
 * Returns true if the given buffeType has a linked SourceBuffer implementation,
 * false otherwise.
 * SourceBuffers are directly added to the MediaSource.
 * @param {string} bufferType
 * @returns {Boolean}
 */
function shouldHaveNativeBuffer(bufferType) {
    return bufferType === "audio" || bufferType === "video";
}

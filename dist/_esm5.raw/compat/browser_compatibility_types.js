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
import { MediaError } from "../errors";
import isNullOrUndefined from "../utils/is_null_or_undefined";
import isNode from "./is_node";
/**
 * Shortcut to the global browser object `window`. Set to an empty object in
 * non-browser platforms
 */
var win = isNode ? {} :
    window;
/* tslint:disable no-unsafe-any */
/** Browser implementation of an HTMLElement. */
var HTMLElement_ = win.HTMLElement;
/** TextTrack cue constructor, as implemented by the browser. */
var VTTCue_ = !isNullOrUndefined(win.VTTCue) ? win.VTTCue :
    win.TextTrackCue;
/* tslint:enable no-unsafe-any */
/* tslint:disable no-unsafe-any */
/** MediaSource implementation, including vendored implementations. */
var MediaSource_ = !isNullOrUndefined(win.MediaSource) ? win.MediaSource :
    !isNullOrUndefined(win.MozMediaSource) ? win.MozMediaSource :
        !isNullOrUndefined(win.WebKitMediaSource) ? win.WebKitMediaSource :
            win.MSMediaSource;
/* tslint:enable no-unsafe-any */
/**
 * MediaKeys implementation, including vendored implementations and a fallback
 * one which will throw when calling one of its methods.
 */
var MediaKeys_ = (function () {
    /* tslint:disable no-unsafe-any */
    return !isNullOrUndefined(win.MediaKeys) ? win.MediaKeys :
        !isNullOrUndefined(win.MozMediaKeys) ? win.MozMediaKeys : /** @class */ (function () {
            function class_1() {
                var noMediaKeys = function () {
                    throw new MediaError("MEDIA_KEYS_NOT_SUPPORTED", "No `MediaKeys` implementation found " +
                        "in the current browser.");
                };
                this.create = noMediaKeys;
                this.createSession = noMediaKeys;
                this.isTypeSupported = noMediaKeys;
                this.setServerCertificate = noMediaKeys;
            }
            return class_1;
        }());
    /* tslint:enable no-unsafe-any */
})();
/** List an HTMLMediaElement's possible values for its readyState property. */
var READY_STATES = { HAVE_NOTHING: 0,
    HAVE_METADATA: 1,
    HAVE_CURRENT_DATA: 2,
    HAVE_FUTURE_DATA: 3,
    HAVE_ENOUGH_DATA: 4 };
export { HTMLElement_, MediaKeys_, MediaSource_, READY_STATES, VTTCue_, };

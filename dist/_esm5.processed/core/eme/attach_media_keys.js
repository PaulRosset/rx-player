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
import { defer as observableDefer, of as observableOf, } from "rxjs";
import { mergeMap, tap } from "rxjs/operators";
import { setMediaKeys, } from "../../compat";
import log from "../../log";
import MediaKeysInfosStore from "./media_keys_infos_store";
/**
 * Dispose the media keys on media element.
 * @param {Object} mediaElement
 * @returns {Observable}
 */
export function disableMediaKeys(mediaElement) {
    return observableDefer(function () {
        MediaKeysInfosStore.setState(mediaElement, null);
        return setMediaKeys(mediaElement, null);
    });
}
/**
 * Attach MediaKeys and its associated state to an HTMLMediaElement.
 *
 * /!\ Mutates heavily MediaKeysInfosStore
 * @param {Object} mediaKeysInfos
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
export default function attachMediaKeys(mediaElement, _a) {
    var keySystemOptions = _a.keySystemOptions, loadedSessionsStore = _a.loadedSessionsStore, mediaKeySystemAccess = _a.mediaKeySystemAccess, mediaKeys = _a.mediaKeys;
    return observableDefer(function () {
        var previousState = MediaKeysInfosStore.getState(mediaElement);
        var closeAllSessions$ = previousState !== null &&
            previousState.loadedSessionsStore !== loadedSessionsStore ?
            previousState.loadedSessionsStore.closeAllSessions() :
            observableOf(null);
        return closeAllSessions$.pipe(mergeMap(function () {
            MediaKeysInfosStore.setState(mediaElement, { keySystemOptions: keySystemOptions,
                mediaKeySystemAccess: mediaKeySystemAccess,
                mediaKeys: mediaKeys,
                loadedSessionsStore: loadedSessionsStore });
            if (mediaElement.mediaKeys === mediaKeys) {
                return observableOf(null);
            }
            log.info("EME: Attaching MediaKeys to the media element");
            return setMediaKeys(mediaElement, mediaKeys)
                .pipe(tap(function () { log.info("EME: MediaKeys attached with success"); }));
        }));
    });
}

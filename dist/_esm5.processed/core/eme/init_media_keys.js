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
import { of as observableOf, ReplaySubject, } from "rxjs";
import { mapTo, mergeMap, startWith, take, } from "rxjs/operators";
import log from "../../log";
import attachMediaKeys, { disableMediaKeys, } from "./attach_media_keys";
import getMediaKeysInfos from "./get_media_keys";
/**
 * Get media keys infos from key system configs then attach media keys to media element.
 * @param {HTMLMediaElement} mediaElement
 * @param {Array.<Object>} keySystemsConfigs
 * @returns {Observable}
 */
export default function initMediaKeys(mediaElement, keySystemsConfigs) {
    return getMediaKeysInfos(mediaElement, keySystemsConfigs)
        .pipe(mergeMap(function (_a) {
        var mediaKeys = _a.mediaKeys, mediaKeySystemAccess = _a.mediaKeySystemAccess, stores = _a.stores, options = _a.options;
        var attachMediaKeys$ = new ReplaySubject(1);
        var shouldDisableOldMediaKeys = mediaElement.mediaKeys !== null &&
            mediaElement.mediaKeys !== undefined &&
            mediaKeys !== mediaElement.mediaKeys;
        var disableOldMediaKeys$ = shouldDisableOldMediaKeys ?
            disableMediaKeys(mediaElement) :
            observableOf(null);
        log.debug("EME: Disabling old MediaKeys");
        return disableOldMediaKeys$.pipe(mergeMap(function () {
            log.debug("EME: Disabled old MediaKeys. Waiting to attach new MediaKeys");
            return attachMediaKeys$.pipe(mergeMap(function () {
                var stateToAttatch = { loadedSessionsStore: stores.loadedSessionsStore, mediaKeySystemAccess: mediaKeySystemAccess,
                    mediaKeys: mediaKeys, keySystemOptions: options };
                return attachMediaKeys(mediaElement, stateToAttatch);
            }), take(1), mapTo({ type: "attached-media-keys",
                value: { mediaKeySystemAccess: mediaKeySystemAccess, mediaKeys: mediaKeys, stores: stores, options: options } }), startWith({ type: "created-media-keys",
                value: { mediaKeySystemAccess: mediaKeySystemAccess,
                    mediaKeys: mediaKeys,
                    stores: stores,
                    options: options,
                    attachMediaKeys$: attachMediaKeys$ } }));
        }));
    }));
}

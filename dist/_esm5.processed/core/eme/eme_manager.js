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
import { concat as observableConcat, EMPTY, merge as observableMerge, of as observableOf, throwError, } from "rxjs";
import { catchError, filter, ignoreElements, map, mergeMap, shareReplay, take, tap, } from "rxjs/operators";
import { events, generateKeyRequest, getInitData, } from "../../compat/";
import config from "../../config";
import { EncryptedMediaError } from "../../errors";
import log from "../../log";
import arrayIncludes from "../../utils/array_includes";
import assertUnreachable from "../../utils/assert_unreachable";
import filterMap from "../../utils/filter_map";
import isNullOrUndefined from "../../utils/is_null_or_undefined";
import cleanOldStoredPersistentInfo from "./clean_old_stored_persistent_info";
import getSession from "./get_session";
import initMediaKeys from "./init_media_keys";
import SessionEventsListener, { BlacklistedSessionError, } from "./session_events_listener";
import setServerCertificate from "./set_server_certificate";
import InitDataStore from "./utils/init_data_store";
var EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION = config.EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION;
var onEncrypted$ = events.onEncrypted$;
/**
 * EME abstraction used to communicate with the Content Decryption Module (or
 * CDM) to be able to decrypt contents.
 *
 * The `EMEManager` can be given one or multiple key systems. It will choose the
 * appropriate one depending on user settings and browser support.
 * @param {HTMLMediaElement} mediaElement - The MediaElement which will be
 * associated to a MediaKeys object
 * @param {Array.<Object>} keySystemsConfigs - key system configuration
 * @param {Observable} contentProtections$ - Observable emitting external
 * initialization data.
 * @returns {Observable}
 */
export default function EMEManager(mediaElement, keySystemsConfigs, contentProtections$) {
    log.debug("EME: Starting EMEManager logic.");
    /**
     * Keep track of all initialization data handled for the current `EMEManager`
     * instance.
     * This allows to avoid handling multiple times the same encrypted events.
     */
    var handledInitData = new InitDataStore();
    /**
     * Keep track of which initialization data have been blacklisted (linked to
     * non-decypherable content).
     * If the same initialization data is encountered again, we can directly emit
     * the same `BlacklistedSessionError`.
     */
    var blacklistedInitData = new InitDataStore();
    /** Emit the MediaKeys instance and its related information when ready. */
    var mediaKeysInit$ = initMediaKeys(mediaElement, keySystemsConfigs)
        .pipe(shareReplay()); // Share side-effects and cache success
    /** Emit when the MediaKeys instance has been attached the HTMLMediaElement. */
    var attachedMediaKeys$ = mediaKeysInit$.pipe(filter(function (evt) {
        return evt.type === "attached-media-keys";
    }), take(1));
    /** Parsed `encrypted` events coming from the HTMLMediaElement. */
    var mediaEncryptedEvents$ = onEncrypted$(mediaElement).pipe(tap(function (evt) {
        log.debug("EME: Encrypted event received from media element.", evt);
    }), filterMap(function (evt) {
        var _a = getInitData(evt), initData = _a.initData, initDataType = _a.initDataType;
        return initData === null ? null :
            { type: initDataType, data: initData };
    }, null), shareReplay({ refCount: true })); // multiple Observables listen to that one
    // as soon as the EMEManager is subscribed
    /** Encryption events coming from the `contentProtections$` argument. */
    var externalEvents$ = contentProtections$.pipe(tap(function (evt) { log.debug("EME: Encrypted event received from Player", evt); }));
    /** Emit events signaling that an encryption initialization data is encountered. */
    var initializationData$ = observableMerge(externalEvents$, mediaEncryptedEvents$);
    /** Create MediaKeySessions and handle the corresponding events. */
    var bindSession$ = initializationData$.pipe(take(1), 
    // Add attached MediaKeys info once available
    mergeMap(function (initializationData) { return attachedMediaKeys$.pipe(map(function (mediaKeysEvt) {
        return [initializationData, mediaKeysEvt];
    })); }), 
    /* Attach server certificate and create/reuse MediaKeySession */
    mergeMap(function (_a, i) {
        var initializationData = _a[0], mediaKeysEvent = _a[1];
        var _b = mediaKeysEvent.value, mediaKeys = _b.mediaKeys, mediaKeySystemAccess = _b.mediaKeySystemAccess, stores = _b.stores, options = _b.options;
        var blacklistError = blacklistedInitData.get(initializationData);
        if (blacklistError !== undefined) {
            if (initializationData.type === undefined) {
                log.error("EME: The current session has already been blacklisted " +
                    "but the current content is not known. Throwing.");
                var sessionError = blacklistError.sessionError;
                sessionError.fatal = true;
                return throwError(sessionError);
            }
            log.warn("EME: The current session has already been blacklisted. " +
                "Blacklisting content.");
            return observableOf({ type: "blacklist-protection-data", value: initializationData });
        }
        if (!handledInitData.storeIfNone(initializationData, true)) {
            log.debug("EME: Init data already received. Skipping it.");
            return observableOf({ type: "init-data-ignored",
                value: { initializationData: initializationData } });
        }
        var serverCertificate = options.serverCertificate;
        var serverCertificate$ = i === 0 && !isNullOrUndefined(serverCertificate) ?
            setServerCertificate(mediaKeys, serverCertificate) :
            EMPTY;
        var wantedSessionType;
        if (options.persistentLicense !== true) {
            wantedSessionType = "temporary";
        }
        else if (!canCreatePersistentSession(mediaKeySystemAccess)) {
            log.warn("EME: Cannot create \"persistent-license\" session: not supported");
            wantedSessionType = "temporary";
        }
        else {
            wantedSessionType = "persistent-license";
        }
        return observableConcat(serverCertificate$, getSession(initializationData, stores, wantedSessionType))
            .pipe(mergeMap(function (sessionEvt) {
            switch (sessionEvt.type) {
                case "warning":
                    return observableOf(sessionEvt);
                case "cleaning-old-session":
                    handledInitData.remove(sessionEvt.value.initializationData);
                    return EMPTY;
                case "cleaned-old-session":
                    return EMPTY;
                case "created-session":
                case "loaded-open-session":
                case "loaded-persistent-session":
                    // Do nothing, just to check every possibility is taken
                    break;
                default: // Use TypeScript to check if all possibilities have been checked
                    assertUnreachable(sessionEvt);
            }
            var _a = sessionEvt.value, mediaKeySession = _a.mediaKeySession, sessionType = _a.sessionType;
            var generateRequest$ = sessionEvt.type !== "created-session" ?
                EMPTY :
                generateKeyRequest(mediaKeySession, initializationData).pipe(tap(function () {
                    var persistentSessionsStore = stores.persistentSessionsStore;
                    if (sessionType === "persistent-license" &&
                        persistentSessionsStore !== null) {
                        cleanOldStoredPersistentInfo(persistentSessionsStore, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
                        persistentSessionsStore.add(initializationData, mediaKeySession);
                    }
                }), catchError(function (error) {
                    throw new EncryptedMediaError("KEY_GENERATE_REQUEST_ERROR", error instanceof Error ? error.toString() :
                        "Unknown error");
                }), ignoreElements());
            return observableMerge(SessionEventsListener(mediaKeySession, options, mediaKeySystemAccess.keySystem, initializationData), generateRequest$)
                .pipe(catchError(function (err) {
                if (!(err instanceof BlacklistedSessionError)) {
                    throw err;
                }
                blacklistedInitData.store(initializationData, err);
                var sessionError = err.sessionError;
                if (initializationData.type === undefined) {
                    log.error("EME: Current session blacklisted and content not known. " +
                        "Throwing.");
                    sessionError.fatal = true;
                    throw sessionError;
                }
                log.warn("EME: Current session blacklisted. Blacklisting content.");
                return observableOf({ type: "warning", value: sessionError }, { type: "blacklist-protection-data", value: initializationData });
            }));
        }));
    }));
    return observableMerge(mediaKeysInit$, mediaEncryptedEvents$
        .pipe(map(function (evt) { return ({ type: "encrypted-event-received", value: evt }); })), bindSession$);
}
/**
 * Returns `true` if the given MediaKeySystemAccess can create
 * "persistent-license" MediaKeySessions.
 * @param {MediaKeySystemAccess} mediaKeySystemAccess
 * @returns {Boolean}
 */
function canCreatePersistentSession(mediaKeySystemAccess) {
    var sessionTypes = mediaKeySystemAccess.getConfiguration().sessionTypes;
    return sessionTypes !== undefined &&
        arrayIncludes(sessionTypes, "persistent-license");
}

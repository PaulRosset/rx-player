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
import { EncryptedMediaError, isKnownError } from "../../errors";
import log from "../../log";
import assertUnreachable from "../../utils/assert_unreachable";
import filterMap from "../../utils/filter_map";
import objectAssign from "../../utils/object_assign";
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
    var mediaKeysInfos$ = initMediaKeys(mediaElement, keySystemsConfigs)
        .pipe(shareReplay()); // Share side-effects and cache success
    /** Emit when the MediaKeys instance has been attached the HTMLMediaElement. */
    var attachedMediaKeys$ = mediaKeysInfos$.pipe(filter(function (evt) {
        return evt.type === "attached-media-keys";
    }), take(1));
    /** Parsed `encrypted` events coming from the HTMLMediaElement. */
    var mediaEncryptedEvents$ = onEncrypted$(mediaElement).pipe(tap(function (evt) {
        log.debug("EME: Encrypted event received from media element.", evt);
    }), filterMap(function (evt) {
        var _a = getInitData(evt), initData = _a.initData, initDataType = _a.initDataType;
        if (initData === null) {
            return null;
        }
        return { type: initDataType, data: initData };
    }, null), shareReplay({ refCount: true })); // multiple Observables listen to that one
    // as soon as the EMEManager is subscribed
    /** Encryption events coming from the `contentProtections$` argument. */
    var externalEvents$ = contentProtections$.pipe(tap(function (evt) { log.debug("EME: Encrypted event received from Player", evt); }));
    /** Emit events signaling that an encryption initialization data is encountered. */
    var encryptedEvents$ = observableMerge(externalEvents$, mediaEncryptedEvents$);
    /** Create MediaKeySessions and handle the corresponding events. */
    var bindSession$ = encryptedEvents$.pipe(
    // Add attached MediaKeys info once available
    mergeMap(function (encryptedEvt) { return attachedMediaKeys$.pipe(map(function (mediaKeysEvt) {
        return [encryptedEvt, mediaKeysEvt];
    })); }), 
    /* Attach server certificate and create/reuse MediaKeySession */
    mergeMap(function (_a, i) {
        var encryptedEvent = _a[0], mediaKeysEvent = _a[1];
        var mediaKeysInfos = mediaKeysEvent.value;
        var keySystemOptions = mediaKeysInfos.keySystemOptions, mediaKeys = mediaKeysInfos.mediaKeys;
        var serverCertificate = keySystemOptions.serverCertificate;
        var initDataType = encryptedEvent.type, initData = encryptedEvent.data;
        var blacklistError = blacklistedInitData.get(initData, initDataType);
        if (blacklistError !== undefined) {
            if (initDataType === undefined) {
                log.error("EME: The current session has already been blacklisted " +
                    "but the current content is not known. Throwing.");
                var sessionError = blacklistError.sessionError;
                sessionError.fatal = true;
                return throwError(sessionError);
            }
            log.warn("EME: The current session has already been blacklisted. " +
                "Blacklisting content.");
            return observableOf({ type: "blacklist-protection-data", value: { type: initDataType,
                    data: initData } });
        }
        if (!handledInitData.storeIfNone(initData, initDataType, true)) {
            log.debug("EME: Init data already received. Skipping it.");
            return observableOf({ type: "init-data-ignored", value: { type: initDataType, data: initData } });
        }
        var session$ = getSession(encryptedEvent, mediaKeysInfos, false)
            .pipe(map(function (evt) {
            if (evt.type === "cleaning-old-session") {
                handledInitData.remove(evt.value.initData, evt.value.initDataType);
            }
            return {
                type: evt.type,
                value: objectAssign({
                    keySystemOptions: mediaKeysInfos.keySystemOptions,
                    persistentSessionsStore: mediaKeysInfos.persistentSessionsStore,
                    keySystem: mediaKeysInfos.mediaKeySystemAccess.keySystem,
                    mediaKeySystemAccess: mediaKeysInfos.mediaKeySystemAccess,
                    mediaKeys: mediaKeysInfos.mediaKeys,
                    loadedSessionsStore: mediaKeysInfos.loadedSessionsStore,
                }, evt.value),
            };
        }));
        if (i === 0) { // first encrypted event for the current content
            return observableMerge(serverCertificate != null ?
                observableConcat(setServerCertificate(mediaKeys, serverCertificate), session$) :
                session$);
        }
        return session$;
    }), 
    /* Trigger license request and manage MediaKeySession events */
    mergeMap(function (sessionInfosEvt) {
        switch (sessionInfosEvt.type) {
            case "warning":
            case "blacklist-protection-data":
            case "init-data-ignored":
                return observableOf(sessionInfosEvt);
            case "cleaned-old-session":
            case "cleaning-old-session":
                return EMPTY;
            case "created-session":
            case "loaded-open-session":
            case "loaded-persistent-session":
                // Do nothing, just to check every possibility is taken
                break;
            default: // Use TypeScript to check if all possibilities have been checked
                assertUnreachable(sessionInfosEvt);
        }
        var _a = sessionInfosEvt.value, initData = _a.initData, initDataType = _a.initDataType, mediaKeySession = _a.mediaKeySession, sessionType = _a.sessionType, keySystemOptions = _a.keySystemOptions, persistentSessionsStore = _a.persistentSessionsStore, mediaKeySystemAccess = _a.mediaKeySystemAccess, mediaKeys = _a.mediaKeys, loadedSessionsStore = _a.loadedSessionsStore, keySystem = _a.keySystem;
        var generateRequest$ = sessionInfosEvt.type !== "created-session" ?
            EMPTY :
            generateKeyRequest(mediaKeySession, initData, initDataType).pipe(tap(function () {
                if (sessionType === "persistent-license" &&
                    persistentSessionsStore !== null) {
                    cleanOldStoredPersistentInfo(persistentSessionsStore, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
                    persistentSessionsStore.add(initData, initDataType, mediaKeySession);
                }
            }), catchError(function (error) {
                throw new EncryptedMediaError("KEY_GENERATE_REQUEST_ERROR", error instanceof Error ? error.toString() :
                    "Unknown error");
            }), ignoreElements());
        return observableMerge(SessionEventsListener(mediaKeySession, keySystemOptions, keySystem, { initData: initData, initDataType: initDataType })
            .pipe(catchError(function (err) {
            /* tslint:disable no-console */
            console.warn("!!!!! ERROR RECEIVED", err);
            if (!isKnownError(err) ||
                err.code !== "KEY_UPDATE_ERROR" ||
                sessionType !== "persistent-license") {
                console.warn("!!!!! ERROR Unknown, really throwing", err);
                throw err;
            }
            console.warn("!!!!! Bonne erreur, re-faire en mode temporary");
            return observableConcat(loadedSessionsStore.closeSession(initData, initDataType)
                .pipe(ignoreElements()), getSession({ type: initDataType, data: initData }, { mediaKeySystemAccess: mediaKeySystemAccess,
                mediaKeys: mediaKeys,
                loadedSessionsStore: loadedSessionsStore,
                persistentSessionsStore: persistentSessionsStore,
                keySystemOptions: keySystemOptions }, true).pipe(tap(function (evt) {
                if (evt.type === "cleaning-old-session") {
                    handledInitData.remove(evt.value.initData, evt.value.initDataType);
                }
            }), mergeMap(function (evt2) {
                switch (evt2.type) {
                    case "cleaned-old-session":
                    case "cleaning-old-session":
                        return EMPTY;
                    case "created-session":
                    case "loaded-open-session":
                    case "loaded-persistent-session":
                        // Do nothing, just to check every possibility is taken
                        break;
                    default:
                        assertUnreachable(evt2);
                }
                console.warn("!!!!!!!!!!! Behavior 4 TEST");
                console.warn("!!!!!!! Session re-créé, en mode temporary");
                var generateRequest2$ = evt2.type !== "created-session" ?
                    EMPTY :
                    generateKeyRequest(evt2.value.mediaKeySession, initData, initDataType).pipe(tap(function () {
                        if (sessionType === "persistent-license" &&
                            persistentSessionsStore !== null) {
                            cleanOldStoredPersistentInfo(persistentSessionsStore, EME_MAX_STORED_PERSISTENT_SESSION_INFORMATION - 1);
                            persistentSessionsStore.add(initData, initDataType, evt2.value.mediaKeySession);
                        }
                    }), catchError(function (error) {
                        throw new EncryptedMediaError("KEY_GENERATE_REQUEST_ERROR", error instanceof Error ? error.toString() :
                            "Unknown error");
                    }), ignoreElements());
                console.warn("!!!!!!! Generate Request & events");
                return observableMerge(SessionEventsListener(evt2.value.mediaKeySession, keySystemOptions, keySystem, { initData: initData, initDataType: initDataType }), generateRequest2$);
            })));
        })), generateRequest$)
            .pipe(catchError(function (err) {
            if (!(err instanceof BlacklistedSessionError)) {
                throw err;
            }
            blacklistedInitData.store(initData, initDataType, err);
            var sessionError = err.sessionError;
            if (initDataType === undefined) {
                log.error("EME: Current session blacklisted and content not known. " +
                    "Throwing.");
                sessionError.fatal = true;
                throw sessionError;
            }
            log.warn("EME: Current session blacklisted. Blacklisting content.");
            return observableOf({ type: "warning", value: sessionError }, { type: "blacklist-protection-data", value: { type: initDataType,
                    data: initData } });
        }));
    }));
    return observableMerge(mediaKeysInfos$, mediaEncryptedEvents$
        .pipe(map(function (evt) { return ({ type: "encrypted-event-received", value: evt }); })), bindSession$);
}

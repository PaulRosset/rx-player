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
import { catchError, map, mergeMap, } from "rxjs/operators";
import { loadSession, } from "../../compat";
import log from "../../log";
import isSessionUsable from "./utils/is_session_usable";
/**
 * Create a new Session on the given MediaKeys, corresponding to the given
 * initializationData.
 * If session creating fails, remove the oldest MediaKeySession loaded and
 * retry.
 *
 * /!\ This only creates new sessions.
 * It will fail if loadedSessionsStore already has a MediaKeySession with
 * the given initializationData.
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 * @param {Object} mediaKeysInfos
 * @returns {Observable}
 */
export default function createSession(stores, initializationData, wantedSessionType) {
    return observableDefer(function () {
        var loadedSessionsStore = stores.loadedSessionsStore, persistentSessionsStore = stores.persistentSessionsStore;
        if (wantedSessionType === "temporary") {
            return createTemporarySession(loadedSessionsStore, initializationData);
        }
        else if (persistentSessionsStore === null) {
            log.warn("EME: Cannot create persistent MediaKeySession, " +
                "PersistentSessionsStore not created.");
            return createTemporarySession(loadedSessionsStore, initializationData);
        }
        return createAndTryToRetrievePersistentSession(loadedSessionsStore, persistentSessionsStore, initializationData);
    });
}
/**
 * Create a new temporary MediaKeySession linked to the given initData and
 * initDataType.
 * @param {Object} loadedSessionsStore
 * @param {Object} initData
 * @returns {Observable}
 */
function createTemporarySession(loadedSessionsStore, initData) {
    return observableDefer(function () {
        log.info("EME: Creating a new temporary session");
        var session = loadedSessionsStore.createSession(initData, "temporary");
        return observableOf({ type: "created-session",
            value: { mediaKeySession: session, sessionType: "temporary" } });
    });
}
/**
 * Create a persistent MediaKeySession and try to load on it a previous
 * MediaKeySession linked to the same initData and initDataType.
 * @param {Object} loadedSessionsStore
 * @param {Object} persistentSessionsStore
 * @param {Object} initData
 * @returns {Observable}
 */
function createAndTryToRetrievePersistentSession(loadedSessionsStore, persistentSessionsStore, initData) {
    return observableDefer(function () {
        log.info("EME: Creating persistent MediaKeySession");
        var session = loadedSessionsStore
            .createSession(initData, "persistent-license");
        var storedEntry = persistentSessionsStore.getAndReuse(initData);
        if (storedEntry === null) {
            return observableOf({ type: "created-session",
                value: { mediaKeySession: session, sessionType: "persistent-license" } });
        }
        /**
         * Helper function to close and restart the current persistent session
         * considered, and re-create it from scratch.
         * @returns {Observable}
         */
        var recreatePersistentSession = function () {
            log.info("EME: Removing previous persistent session.");
            if (persistentSessionsStore.get(initData) !== null) {
                persistentSessionsStore.delete(initData);
            }
            return loadedSessionsStore.closeSession(initData)
                .pipe(map(function () {
                var newSession = loadedSessionsStore.createSession(initData, "persistent-license");
                return { type: "created-session", value: { mediaKeySession: newSession,
                        sessionType: "persistent-license" } };
            }));
        };
        return loadSession(session, storedEntry.sessionId).pipe(mergeMap(function (hasLoadedSession) {
            if (!hasLoadedSession) {
                log.warn("EME: No data stored for the loaded session");
                persistentSessionsStore.delete(initData);
                return observableOf({ type: "created-session", value: { mediaKeySession: session,
                        sessionType: "persistent-license" } });
            }
            if (hasLoadedSession && isSessionUsable(session)) {
                persistentSessionsStore.add(initData, session);
                log.info("EME: Succeeded to load persistent session.");
                return observableOf({ type: "loaded-persistent-session", value: { mediaKeySession: session,
                        sessionType: "persistent-license" } });
            }
            // Unusable persistent session: recreate a new session from scratch.
            log.warn("EME: Previous persistent session not usable anymore.");
            return recreatePersistentSession();
        }), catchError(function (err) {
            log.warn("EME: Unable to load persistent session: " +
                (err instanceof Error ? err.toString() :
                    "Unknown Error"));
            return recreatePersistentSession();
        }));
    });
}

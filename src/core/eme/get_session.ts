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

import {
  concat as observableConcat,
  defer as observableDefer,
  EMPTY,
  merge as observableMerge,
  Observable,
  of as observableOf,
} from "rxjs";
import {
  map,
  mapTo,
  mergeMap,
  startWith,
} from "rxjs/operators";
import { ICustomMediaKeySession } from "../../compat";
import config from "../../config";
import log from "../../log";
import createSession from "./create_session";
import { IMediaKeysInfos } from "./types";
import isSessionUsable from "./utils/is_session_usable";
import LoadedSessionsStore from "./utils/loaded_sessions_store";

const { EME_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS } = config;

/** Information about the encryption initialization data. */
export interface IInitializationDataInfo {
  /** The initialization data type. */
  type : string | undefined;
  /** Initialization data itself. */
  data : Uint8Array;
}

/** Information concerning a MediaKeySession. */
export interface IMediaKeySessionInfo {
  /** The MediaKeySession itself. */
  mediaKeySession : MediaKeySession |
                    ICustomMediaKeySession;
  /** The type of MediaKeySession (e.g. "temporary"). */
  sessionType : MediaKeySessionType;
  /** Initialization data assiociated to this MediaKeySession. */
  initData : Uint8Array;
  /** Initialization data type for the given initialization data. */
  initDataType : string |
                 undefined;
}

/** Event emitted when a new MediaKeySession has been created. */
export interface ICreatedSession {
  type : "created-session";
  value : IMediaKeySessionInfo;
}

/** Event emitted when an already-loaded MediaKeySession is used. */
export interface ILoadedOpenSession {
  type : "loaded-open-session";
  value : IMediaKeySessionInfo;
}

/** Event emitted when a persistent MediaKeySession has been loaded. */
export interface ILoadedPersistentSessionEvent {
  type : "loaded-persistent-session";
  value : IMediaKeySessionInfo;
}

/**
 * Event emitted when an old MediaKeySession has been closed to respect the
 * maximum limit of concurrent MediaKeySession active.
 */
interface ICleanedOldSessionEvent {
  type : "cleaned-old-session";
  value : IMediaKeySessionInfo;
}

/**
 * Event emitted when we are beginning to close an old MediaKeySession to
 * respect the maximum limit of concurrent MediaKeySession active.
 */
interface ICleaningOldSessionEvent {
  type : "cleaning-old-session";
  value : IMediaKeySessionInfo;
}

/** Every possible events sent by `getSession`. */
export type IGetSessionEvent = ICreatedSession |
                               ILoadedOpenSession |
                               ILoadedPersistentSessionEvent |
                               ICleaningOldSessionEvent |
                               ICleanedOldSessionEvent;

/**
 * Handle MediaEncryptedEvents sent by a HTMLMediaElement:
 * Either create a MediaKeySession, recuperate a previous MediaKeySession or
 * load a persistent session.
 *
 * Some previously created MediaKeySession can be closed in this process to
 * respect the maximum limit of concurrent MediaKeySession, as defined by the
 * `EME_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS` config property.
 *
 * You can refer to the events emitted to know about the current situation.
 * @param {Event} initializationDataInfo
 * @param {Object} handledInitData
 * @param {Object} mediaKeysInfos
 * @returns {Observable}
 */
export default function getSession(
  initializationDataInfo : IInitializationDataInfo,
  mediaKeysInfos : IMediaKeysInfos
) : Observable<IGetSessionEvent> {
  return observableDefer(() : Observable<IGetSessionEvent> => {
    const { type: initDataType, data: initData } = initializationDataInfo;

    /**
     * Store previously-loaded MediaKeySession with the same initialization data, if one.
     */
    let previousLoadedSession : MediaKeySession |
                                ICustomMediaKeySession |
                                null = null;

    const { loadedSessionsStore } = mediaKeysInfos;
    const entry = loadedSessionsStore.get(initData, initDataType);
    if (entry !== null) {
      previousLoadedSession = entry.mediaKeySession;
      if (isSessionUsable(previousLoadedSession)) {
        log.debug("EME: Reuse loaded session", previousLoadedSession.sessionId);
        return observableOf({ type: "loaded-open-session" as const,
                              value: { mediaKeySession: previousLoadedSession,
                                       sessionType: entry.sessionType,
                                       initData,
                                       initDataType } });
      } else if (mediaKeysInfos.persistentSessionsStore != null) {
        // If the session is not usable anymore, we can also remove it from the
        // PersistentSessionsStore.
        // TODO Are we sure this is always what we want?
        mediaKeysInfos.persistentSessionsStore
          .delete(new Uint8Array(initData), initDataType);
      }
    }

    return (previousLoadedSession != null ?
      loadedSessionsStore.closeSession(initData, initDataType) :
      observableOf(null)
    ).pipe(mergeMap(() => {
      return observableConcat(
        cleanOldSessions(loadedSessionsStore),
        createSession(initData, initDataType, mediaKeysInfos)
          .pipe(map((evt) => ({ type: evt.type,
                                value: {
                                  mediaKeySession: evt.value.mediaKeySession,
                                  sessionType: evt.value.sessionType,
                                  initData,
                                  initDataType, } })))
      );
    }));
  });
}

/**
 * Close sessions to respect the `EME_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS` limit.
 * Emit event when a MediaKeySession begin to be closed and another when the
 * MediaKeySession is closed.
 * @param {Object} loadedSessionsStore
 * @returns {Observable}
 */
function cleanOldSessions(
  loadedSessionsStore : LoadedSessionsStore
) : Observable<ICleaningOldSessionEvent | ICleanedOldSessionEvent> {
  const maxSessions = EME_MAX_SIMULTANEOUS_MEDIA_KEY_SESSIONS;
  const cleaningOldSessions$ : Array<Observable<ICleanedOldSessionEvent |
                                                 ICleaningOldSessionEvent>> = [];
  if (maxSessions > 0 && maxSessions <= loadedSessionsStore.getLength()) {
    const entries = loadedSessionsStore.getAll();
    for (let i = 0; i < entries.length - maxSessions; i++) {
      const entry = entries[i];
      const cleaning$ = loadedSessionsStore
        .closeSession(entry.initData, entry.initDataType)
          .pipe(mapTo({ type: "cleaned-old-session" as const,
                        value: entry }),
                startWith({ type: "cleaning-old-session" as const,
                            value: entry }));
      cleaningOldSessions$.push(cleaning$);
    }
  }
  return cleaningOldSessions$.length !== 0 ? observableMerge(...cleaningOldSessions$) :
                                             EMPTY;
}

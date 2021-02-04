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
import { Observable } from "rxjs";
import { ICustomMediaKeySession } from "../../compat";
import { ICleanedOldSessionEvent, ICleaningOldSessionEvent } from "./clean_old_loaded_sessions";
import { IInitializationDataInfo, IMediaKeySessionStores } from "./types";
/** Information concerning a MediaKeySession. */
export interface IMediaKeySessionContext {
    /** The MediaKeySession itself. */
    mediaKeySession: MediaKeySession | ICustomMediaKeySession;
    /** The type of MediaKeySession (e.g. "temporary"). */
    sessionType: MediaKeySessionType;
    /** Initialization data assiociated to this MediaKeySession. */
    initializationData: IInitializationDataInfo;
}
/** Event emitted when a new MediaKeySession has been created. */
export interface ICreatedSession {
    type: "created-session";
    value: IMediaKeySessionContext;
}
/** Event emitted when an already-loaded MediaKeySession is used. */
export interface ILoadedOpenSession {
    type: "loaded-open-session";
    value: IMediaKeySessionContext;
}
/** Event emitted when a persistent MediaKeySession has been loaded. */
export interface ILoadedPersistentSessionEvent {
    type: "loaded-persistent-session";
    value: IMediaKeySessionContext;
}
/** Every possible events sent by `getSession`. */
export declare type IGetSessionEvent = ICreatedSession | ILoadedOpenSession | ILoadedPersistentSessionEvent | ICleaningOldSessionEvent | ICleanedOldSessionEvent;
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
export default function getSession(initializationData: IInitializationDataInfo, stores: IMediaKeySessionStores, wantedSessionType: MediaKeySessionType): Observable<IGetSessionEvent>;

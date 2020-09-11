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
import { ICleanedOldSessionEvent, ICleaningOldSessionEvent } from "./clean_old_loaded_sessions";
import { IMediaKeySessionInfo, IMediaKeysInfos } from "./types";
/** Information about the encryption initialization data. */
export interface IInitializationDataInfo {
    /** The initialization data type. */
    type: string | undefined;
    /** Initialization data itself. */
    data: Uint8Array;
}
/** Event emitted when a new MediaKeySession has been created. */
export interface ICreatedSession {
    type: "created-session";
    value: IMediaKeySessionInfo;
}
/** Event emitted when an already-loaded MediaKeySession is used. */
export interface ILoadedOpenSession {
    type: "loaded-open-session";
    value: IMediaKeySessionInfo;
}
/** Event emitted when a persistent MediaKeySession has been loaded. */
export interface ILoadedPersistentSessionEvent {
    type: "loaded-persistent-session";
    value: IMediaKeySessionInfo;
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
export default function getSession(initializationDataInfo: IInitializationDataInfo, mediaKeysInfos: IMediaKeysInfos): Observable<IGetSessionEvent>;

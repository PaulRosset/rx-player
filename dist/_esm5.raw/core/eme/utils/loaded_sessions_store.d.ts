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
import { ICustomMediaKeys, ICustomMediaKeySession } from "../../../compat";
import { IInitializationDataInfo } from "../types";
/** Stored MediaKeySession data assiociated to an initialization data. */
interface IStoredSessionEntry {
    /** The initialization data linked to the MediaKeySession. */
    initializationData: IInitializationDataInfo;
    /** The MediaKeySession created. */
    mediaKeySession: MediaKeySession | ICustomMediaKeySession;
    /** The MediaKeySessionType (e.g. "temporary" or "persistent-license"). */
    sessionType: MediaKeySessionType;
}
/** MediaKeySession information. */
export interface IStoredSessionData {
    /** The MediaKeySession created. */
    mediaKeySession: MediaKeySession | ICustomMediaKeySession;
    /** The MediaKeySessionType (e.g. "temporary" or "persistent-license"). */
    sessionType: MediaKeySessionType;
}
/**
 * Create and store MediaKeySessions linked to a single MediaKeys
 * instance.
 *
 * Keep track of sessionTypes and of the initialization data each
 * MediaKeySession is created for.
 * @class LoadedSessionsStore
 */
export default class LoadedSessionsStore {
    /** MediaKeys instance on which the MediaKeySessions are created. */
    private readonly _mediaKeys;
    /** Store unique MediaKeySession information per initialization data. */
    private _storage;
    /**
     * Create a new LoadedSessionsStore, which will store information about
     * loaded MediaKeySessions on the given MediaKeys instance.
     * @param {MediaKeys} mediaKeys
     */
    constructor(mediaKeys: MediaKeys | ICustomMediaKeys);
    /**
     * Returns the stored MediaKeySession information related to the
     * given initDataType and initData if found.
     * Returns `null` if no such MediaKeySession is stored.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {Object|null}
     */
    get(initializationData: IInitializationDataInfo): IStoredSessionData | null;
    /**
     * Like `get` but also moves the corresponding MediaKeySession to the end of
     * its internal storage, as returned by the `getAll` method.
     *
     * This can be used for example to tell when a previously-stored
     * MediaKeySession is re-used to then be able to implement a caching
     * replacement algorithm based on the least-recently-used values by just
     * evicting the first values returned by `getAll`.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {Object|null}
     */
    getAndReuse(initializationData: IInitializationDataInfo): IStoredSessionData | null;
    /**
     * Create a new MediaKeySession and store it in this store.
     * @throws {EncryptedMediaError}
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @param {string} sessionType
     * @returns {MediaKeySession}
     */
    createSession(initializationData: IInitializationDataInfo, sessionType: MediaKeySessionType): MediaKeySession | ICustomMediaKeySession;
    /**
     * Close a MediaKeySession corresponding to an initialization data and remove
     * its related stored information from the LoadedSessionsStore.
     * Emit when done.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {Observable}
     */
    closeSession(initializationData: IInitializationDataInfo): Observable<unknown>;
    /**
     * Returns the number of stored MediaKeySessions in this LoadedSessionsStore.
     * @returns {number}
     */
    getLength(): number;
    /**
     * Returns information about all stored MediaKeySession, in the order in which
     * the MediaKeySession have been created.
     * @returns {Array.<Object>}
     */
    getAll(): IStoredSessionEntry[];
    /**
     * Close all sessions in this store.
     * Emit `null` when done.
     * @returns {Observable}
     */
    closeAllSessions(): Observable<null>;
}
export {};

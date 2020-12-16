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
import log from "../../../log";
import areArraysOfNumbersEqual from "../../../utils/are_arrays_of_numbers_equal";
import { assertInterface } from "../../../utils/assert";
import { base64ToBytes, bytesToBase64, } from "../../../utils/base64";
import hashBuffer from "../../../utils/hash_buffer";
import isNonEmptyString from "../../../utils/is_non_empty_string";
import isNullOrUndefined from "../../../utils/is_null_or_undefined";
/**
 * Throw if the given storage does not respect the right interface.
 * @param {Object} storage
 */
function checkStorage(storage) {
    assertInterface(storage, { save: "function", load: "function" }, "licenseStorage");
}
/** Wrap initialization data and allow linearization of it into base64. */
var InitDataContainer = /** @class */ (function () {
    /**
     * Create a new container, wrapping the initialization data given and allowing
     * linearization into base64.
     * @param {Uint8Array}
     */
    function InitDataContainer(initData) {
        this.initData = initData;
    }
    /**
     * Convert it to base64.
     * `toJSON` is specially interpreted by JavaScript engines to be able to rely
     * on it when calling `JSON.stringify` on it or any of its parent objects:
     * https://tc39.es/ecma262/#sec-serializejsonproperty
     * @returns {string}
     */
    InitDataContainer.prototype.toJSON = function () {
        return bytesToBase64(this.initData);
    };
    /**
     * Decode a base64 sequence representing an initialization data back to an
     * Uint8Array.
     * @param {string}
     * @returns {Uint8Array}
     */
    InitDataContainer.decode = function (base64) {
        return base64ToBytes(base64);
    };
    return InitDataContainer;
}());
/**
 * Set representing persisted licenses. Depends on a simple local-
 * storage implementation with a `save`/`load` synchronous interface
 * to persist information on persisted sessions.
 *
 * This set is used only for a cdm/keysystem with license persistency
 * supported.
 * @class PersistentSessionsStore
 */
var PersistentSessionsStore = /** @class */ (function () {
    /**
     * Create a new PersistentSessionsStore.
     * @param {Object} storage
     */
    function PersistentSessionsStore(storage) {
        checkStorage(storage);
        this._entries = [];
        this._storage = storage;
        try {
            this._entries = this._storage.load();
            if (!Array.isArray(this._entries)) {
                this._entries = [];
            }
        }
        catch (e) {
            log.warn("EME-PSS: Could not get entries from license storage", e);
            this.dispose();
        }
    }
    /**
     * Returns the number of stored values.
     * @returns {number}
     */
    PersistentSessionsStore.prototype.getLength = function () {
        return this._entries.length;
    };
    /**
     * Returns information about all stored MediaKeySession, in the order in which
     * the MediaKeySession have been created.
     * @returns {Array.<Object>}
     */
    PersistentSessionsStore.prototype.getAll = function () {
        return this._entries;
    };
    /**
     * Retrieve an entry based on its initialization data.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @returns {Object|null}
     */
    PersistentSessionsStore.prototype.get = function (initData, initDataType) {
        var index = this.getIndex(initData, initDataType);
        return index === -1 ? null :
            this._entries[index];
    };
    /**
     * Like `get`, but also move the corresponding value at the end of the store
     * (as returned by `getAll`) if found.
     * This can be used for example to tell when a previously-stored value is
     * re-used to then be able to implement a caching replacement algorithm based
     * on the least-recently-used values by just evicting the first values
     * returned by `getAll`.
     * @param {Uint8Array} initData
     * @param {string|undefined} initDataType
     * @returns {*}
     */
    PersistentSessionsStore.prototype.getAndReuse = function (initData, initDataType) {
        var index = this.getIndex(initData, initDataType);
        if (index === -1) {
            return null;
        }
        var item = this._entries.splice(index, 1)[0];
        this._entries.push(item);
        return item;
    };
    /**
     * Add a new entry in the PersistentSessionsStore.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @param {MediaKeySession} session
     */
    PersistentSessionsStore.prototype.add = function (initData, initDataType, session) {
        if (isNullOrUndefined(session) || !isNonEmptyString(session.sessionId)) {
            log.warn("EME-PSS: Invalid Persisten Session given.");
            return;
        }
        var sessionId = session.sessionId;
        var currentEntry = this.get(initData, initDataType);
        if (currentEntry !== null && currentEntry.sessionId === sessionId) {
            return;
        }
        else if (currentEntry !== null) { // currentEntry has a different sessionId
            this.delete(initData, initDataType);
        }
        var hash = hashBuffer(initData);
        log.info("EME-PSS: Add new session", sessionId, session);
        this._entries.push({ version: 2, sessionId: sessionId, initData: new InitDataContainer(initData),
            initDataHash: hash, initDataType: initDataType });
        this._save();
    };
    /**
     * Delete stored MediaKeySession information based on its initialization
     * data.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     */
    PersistentSessionsStore.prototype.delete = function (initData, initDataType) {
        var index = this.getIndex(initData, initDataType);
        if (index === -1) {
            log.warn("EME-PSS: initData to delete not found.");
            return;
        }
        var entry = this._entries[index];
        log.warn("EME-PSS: Delete session from store", entry);
        this._entries.splice(index, 1);
        this._save();
    };
    PersistentSessionsStore.prototype.deleteOldSessions = function (sessionsToDelete) {
        log.debug("EME-PSS: Deleting last " + sessionsToDelete + " sessions.");
        if (sessionsToDelete <= 0) {
            return;
        }
        if (sessionsToDelete <= this._entries.length) {
            this._entries.splice(0, sessionsToDelete);
        }
        else {
            log.warn("EME-PSS: Asked to remove more information that it contains", sessionsToDelete, this._entries.length);
            this._entries = [];
        }
        this._save();
    };
    /**
     * Delete all saved entries.
     */
    PersistentSessionsStore.prototype.dispose = function () {
        this._entries = [];
        this._save();
    };
    /**
     * Retrieve index of an entry.
     * Returns `-1` if not found.
     * @param {Uint8Array}  initData
     * @param {string|undefined} initDataType
     * @returns {number}
     */
    PersistentSessionsStore.prototype.getIndex = function (initData, initDataType) {
        var hash = hashBuffer(initData);
        for (var i = 0; i < this._entries.length; i++) {
            var entry = this._entries[i];
            if (entry.initDataType === initDataType) {
                if (entry.version === 2) {
                    if (entry.initDataHash === hash) {
                        try {
                            var decodedInitData = typeof entry.initData === "string" ?
                                InitDataContainer.decode(entry.initData) :
                                entry.initData.initData;
                            if (areArraysOfNumbersEqual(decodedInitData, initData)) {
                                return i;
                            }
                        }
                        catch (e) {
                            log.warn("EME-PSS: Could not decode initialization data.", e);
                        }
                    }
                }
                else if (entry.version === 1) {
                    if (entry.initDataHash === hash) {
                        if (typeof entry.initData.length === "undefined") {
                            // If length is undefined, it has been linearized. We could still
                            // convert it back to an Uint8Array but this would necessitate some
                            // ugly unreadable logic for a very very minor possibility.
                            // Just consider that it is a match based on the hash.
                            return i;
                        }
                        else if (areArraysOfNumbersEqual(entry.initData, initData)) {
                            return i;
                        }
                    }
                }
                else {
                    if (entry.initData === hash) {
                        return i;
                    }
                }
            }
        }
        return -1;
    };
    /**
     * Use the given storage to store the current entries.
     */
    PersistentSessionsStore.prototype._save = function () {
        try {
            this._storage.save(this._entries);
        }
        catch (e) {
            log.warn("EME-PSS: Could not save licenses in localStorage");
        }
    };
    return PersistentSessionsStore;
}());
export default PersistentSessionsStore;

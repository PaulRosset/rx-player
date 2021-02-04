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
import { ICustomMediaKeySession } from "./custom_media_keys";
/** Information about the encryption initialization data. */
export interface IInitializationDataInfo {
    /** The initialization data type. */
    type: string | undefined;
    /** Initialization data itself. */
    data: Uint8Array;
}
/**
 * Modify "initialization data" sent to a `generateKeyRequest` EME call to
 * improve the player's browser compatibility:
 *
 *   1. some browsers/CDM have problems when the CENC PSSH box is the first
 *      encountered PSSH box in the initialization data (for the moment just
 *      Edge was noted with this behavior).
 *      We found however that it works on every browser when the CENC pssh
 *      box(es) is/are the last box(es) encountered.
 *
 *      To that end, we move CENC pssh boxes at the end of the initialization
 *      data in this function.
 *
 *   2. Some poorly encoded/packaged contents communicate both a CENC with a
 *      pssh version of 0 and one with a version of 1. We found out that this is
 *      not always well handled on some devices/browsers (on Edge and some other
 *      embedded devices that shall remain nameless for now!).
 *
 *      Here this function will filter out CENC pssh with a version different to
 *      1 when one(s) with a version of 1 is/are already present.
 *
 * If the initData is unrecognized or if a CENC PSSH is not found, this function
 * throws.
 * @param {Uint8Array} initData - Initialization data you want to patch
 * @returns {Uint8Array} - Initialization data, patched
 */
export declare function patchInitData(initData: Uint8Array): Uint8Array;
/**
 * Generate a request from session.
 * @param {MediaKeySession} session - MediaKeySession on which the request will
 * be done.
 * @param {Uint8Array} initData - Initialization data given e.g. by the
 * "encrypted" event for the corresponding request.
 * @param {string} initDataType - Initialization data type given e.g. by the
 * "encrypted" event for the corresponding request.
 * @param {string} sessionType - Type of session you want to generate. Consult
 * EME Specification for more information on session types.
 * @returns {Observable} - Emit when done. Errors if fails.
 */
export default function generateKeyRequest(session: MediaKeySession | ICustomMediaKeySession, initializationData: IInitializationDataInfo): Observable<unknown>;

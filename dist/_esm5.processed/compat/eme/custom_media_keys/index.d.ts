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
import CustomMediaKeySystemAccess from "./../custom_key_system_access";
import { ICustomMediaKeys, ICustomMediaKeySession } from "./types";
declare let requestMediaKeySystemAccess: null | ((keyType: string, config: MediaKeySystemConfiguration[]) => Observable<MediaKeySystemAccess | CustomMediaKeySystemAccess>);
/**
 * Set the given MediaKeys on the given HTMLMediaElement.
 * Emits null when done then complete.
 * @param {HTMLMediaElement} elt
 * @param {Object} mediaKeys
 * @returns {Observable}
 */
declare function setMediaKeys(elt: HTMLMediaElement, mediaKeys: MediaKeys | ICustomMediaKeys | null): Observable<unknown>;
export { requestMediaKeySystemAccess, setMediaKeys, ICustomMediaKeys, ICustomMediaKeySession, };

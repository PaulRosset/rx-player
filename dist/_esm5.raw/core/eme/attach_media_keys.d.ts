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
import { IMediaKeysInfos } from "./types";
/**
 * Dispose the media keys on media element.
 * @param {Object} mediaElement
 * @returns {Observable}
 */
export declare function disableMediaKeys(mediaElement: HTMLMediaElement): Observable<unknown>;
/**
 * Set the MediaKeys object on the HTMLMediaElement if it is not already on the
 * element.
 *
 * /!\ Mutates heavily MediaKeysInfosStore
 * @param {Object} mediaKeysInfos
 * @param {HTMLMediaElement} mediaElement
 * @returns {Observable}
 */
export default function attachMediaKeys(mediaKeysInfos: IMediaKeysInfos, mediaElement: HTMLMediaElement): Observable<unknown>;

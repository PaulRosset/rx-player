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
import { ICustomError } from "../../errors";
import { IBlacklistKeysEvent, IInitializationDataInfo, IEMEWarningEvent, IKeySystemOption, INoUpdateEvent, ISessionMessageEvent, ISessionUpdatedEvent } from "./types";
/**
 * Error thrown when the MediaKeySession is blacklisted.
 * Such MediaKeySession should not be re-used but other MediaKeySession for the
 * same content can still be used.
 * @class BlacklistedSessionError
 * @extends Error
 */
export declare class BlacklistedSessionError extends Error {
    sessionError: ICustomError;
    constructor(sessionError: ICustomError);
}
/**
 * listen to various events from a MediaKeySession and react accordingly
 * depending on the configuration given.
 * @param {MediaKeySession} session - The MediaKeySession concerned.
 * @param {Object} keySystemOptions - The key system options.
 * @param {String} keySystem - The configuration keySystem used for deciphering
 * @param {Object} initializationData - The initialization data linked to that
 * session.
 * @returns {Observable}
 */
export default function SessionEventsListener(session: MediaKeySession | ICustomMediaKeySession, keySystemOptions: IKeySystemOption, keySystem: string, initializationData: IInitializationDataInfo): Observable<IEMEWarningEvent | ISessionMessageEvent | INoUpdateEvent | ISessionUpdatedEvent | IBlacklistKeysEvent>;

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
/// <reference types="jest" />
import { Observable, Subject } from "rxjs";
import EventEmitter from "../../../../utils/event_emitter";
/** Default MediaKeySystemAccess configuration used by the RxPlayer. */
export declare const defaultKSConfig: {
    audioCapabilities: {
        contentType: string;
        robustness: undefined;
    }[];
    distinctiveIdentifier: "optional";
    initDataTypes: readonly ["cenc"];
    persistentState: "optional";
    sessionTypes: readonly ["temporary"];
    videoCapabilities: {
        contentType: string;
        robustness: undefined;
    }[];
}[];
/** Default Widevine MediaKeySystemAccess configuration used by the RxPlayer. */
export declare const defaultWidevineConfig: ({
    audioCapabilities: {
        contentType: string;
        robustness: undefined;
    }[];
    distinctiveIdentifier: "optional";
    initDataTypes: readonly ["cenc"];
    persistentState: "optional";
    sessionTypes: readonly ["temporary"];
    videoCapabilities: {
        contentType: string;
        robustness: undefined;
    }[];
} & {
    audioCapabilities: {
        contentType: string;
        robustness: string;
    }[];
    videoCapabilities: {
        contentType: string;
        robustness: string;
    }[];
})[];
/**
 * Custom implementation of an EME-compliant MediaKeyStatusMap.
 * @class MediaKeyStatusMapImpl
 */
export declare class MediaKeyStatusMapImpl {
    get size(): number;
    private _map;
    constructor();
    get(keyId: BufferSource): MediaKeyStatus | undefined;
    has(keyId: BufferSource): boolean;
    forEach(callbackfn: (value: MediaKeyStatus, key: BufferSource, parent: MediaKeyStatusMapImpl) => void, thisArg?: any): void;
    __setKeyStatus(keyId: BufferSource, value: MediaKeyStatus | undefined): void;
}
/**
 * Custom implementation of an EME-compliant MediaKeySession.
 * @class MediaKeySessionImpl
 */
export declare class MediaKeySessionImpl extends EventEmitter<any> {
    readonly closed: Promise<void>;
    readonly expiration: number;
    readonly keyStatuses: MediaKeyStatusMapImpl;
    readonly sessionId: string;
    onkeystatuseschange: ((this: MediaKeySessionImpl, ev: Event) => any) | null;
    onmessage: ((this: MediaKeySessionImpl, ev: MediaKeyMessageEvent) => any) | null;
    private _currentKeyId;
    private _close?;
    constructor();
    close(): Promise<void>;
    generateRequest(initDataType: string, initData: BufferSource): Promise<void>;
    load(_sessionId: string): Promise<boolean>;
    remove(): Promise<void>;
    update(_response: BufferSource): Promise<void>;
}
/**
 * Custom implementation of an EME-compliant MediaKeys.
 * @class MediaKeysImpl
 */
export declare class MediaKeysImpl {
    createSession(_sessionType?: MediaKeySessionType): MediaKeySessionImpl;
    setServerCertificate(_serverCertificate: BufferSource): Promise<boolean>;
}
/**
 * Custom implementation of an EME-compliant MediaKeySystemAccess.
 * @class MediaKeySystemAccessImpl
 */
export declare class MediaKeySystemAccessImpl {
    readonly keySystem: string;
    private readonly _config;
    constructor(keySystem: string, config: MediaKeySystemConfiguration[]);
    createMediaKeys(): Promise<MediaKeysImpl>;
    getConfiguration(): MediaKeySystemConfiguration[];
}
export declare function requestMediaKeySystemAccessImpl(keySystem: string, config: MediaKeySystemConfiguration[]): Observable<MediaKeySystemAccessImpl>;
/**
 * Mock functions coming from the compat directory.
 */
export declare function mockCompat(exportedFunctions?: {}): {
    eventSpies: Record<string, jest.Mock<any, any>>;
    eventTriggers: {
        triggerEncrypted: Subject<unknown>;
        triggerKeyMessage: Subject<unknown>;
        triggerKeyError: Subject<unknown>;
        triggerKeyStatusesChange: Subject<unknown>;
    };
    requestMediaKeySystemAccessSpy: jest.Mock<Observable<MediaKeySystemAccessImpl>, [keySystem: string, config: MediaKeySystemConfiguration[]]>;
    getInitDataSpy: jest.Mock<{
        initData: Uint8Array;
        initDataType: any;
    }, [encryptedEvent: any]>;
    setMediaKeysSpy: jest.Mock<Observable<null>, []>;
    generateKeyRequestSpy: jest.Mock<Observable<void>, [mks: MediaKeySessionImpl, initData: BufferSource, initDataType: string]>;
};
/**
 * Check that the EMEManager, when called with those arguments, throws
 * directly without any event emitted.
 *
 * If that's the case, resolve with the corresponding error.
 * Else, reject.
 * @param {HTMLMediaElement} mediaElement
 * @param {Array.<Object>} keySystemsConfigs
 * @param {Observable} contentProtections$
 * @returns {Promise}
 */
export declare function testEMEManagerImmediateError(EMEManager: any, mediaElement: HTMLMediaElement, keySystemsConfigs: unknown[], contentProtections$: Observable<unknown>): Promise<unknown>;
/**
 * Check that the event received corresponds to the session-message event for a
 * license request.
 * @param {Object} evt
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 */
export declare function expectLicenseRequestMessage(evt: {
    type: string;
    value: any;
}, initData: Uint8Array, initDataType: string | undefined): void;
/**
 * @param {Object} evt
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 */
export declare function expectInitDataIgnored(evt: {
    type: string;
    value: any;
}, initData: Uint8Array, initDataType: string | undefined): void;
/**
 * @param {Object} evt
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 */
export declare function expectEncryptedEventReceived(evt: {
    type: string;
    value: any;
}, initData: Uint8Array, initDataType: string | undefined): void;
/**
 * Does the reverse operation than what `formatFakeChallengeFromInitData` does:
 * Retrieve initialization data from a fake challenge done in our tests
 * @param {Uint8Array} challenge
 * @returns {Object}
 */
export declare function extrackInfoFromFakeChallenge(challenge: Uint8Array): {
    initData: Uint8Array;
    initDataType: string;
};
/**
 * @param {BufferSource} initData
 * @param {string} initDataType
 * @returns {Uint8Array}
 */
export declare function formatFakeChallengeFromInitData(initData: BufferSource, initDataType: string): Uint8Array;

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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable no-restricted-properties */
import { defer as observableDefer, of as observableOf, Subject, } from "rxjs";
import { base64ToBytes, bytesToBase64, } from "../../../../utils/base64";
import castToObservable from "../../../../utils/cast_to_observable";
import EventEmitter, { fromEvent } from "../../../../utils/event_emitter";
import flatMap from "../../../../utils/flat_map";
import { strToUtf8, utf8ToStr, } from "../../../../utils/string_parsing";
/** Default MediaKeySystemAccess configuration used by the RxPlayer. */
export var defaultKSConfig = [{
        audioCapabilities: [{ contentType: "audio/mp4;codecs=\"mp4a.40.2\"",
                robustness: undefined },
            { contentType: "audio/webm;codecs=opus",
                robustness: undefined }],
        distinctiveIdentifier: "optional",
        initDataTypes: ["cenc"],
        persistentState: "optional",
        sessionTypes: ["temporary"],
        videoCapabilities: [{ contentType: "video/mp4;codecs=\"avc1.4d401e\"",
                robustness: undefined },
            { contentType: "video/mp4;codecs=\"avc1.42e01e\"",
                robustness: undefined },
            { contentType: "video/webm;codecs=\"vp8\"",
                robustness: undefined }],
    }];
/** Default Widevine MediaKeySystemAccess configuration used by the RxPlayer. */
export var defaultWidevineConfig = (function () {
    var ROBUSTNESSES = ["HW_SECURE_ALL",
        "HW_SECURE_DECODE",
        "HW_SECURE_CRYPTO",
        "SW_SECURE_DECODE",
        "SW_SECURE_CRYPTO"];
    var videoCapabilities = flatMap(ROBUSTNESSES, function (robustness) {
        return [{ contentType: "video/mp4;codecs=\"avc1.4d401e\"", robustness: robustness },
            { contentType: "video/mp4;codecs=\"avc1.42e01e\"", robustness: robustness },
            { contentType: "video/webm;codecs=\"vp8\"", robustness: robustness }];
    });
    var audioCapabilities = flatMap(ROBUSTNESSES, function (robustness) {
        return [{ contentType: "audio/mp4;codecs=\"mp4a.40.2\"", robustness: robustness },
            { contentType: "audio/webm;codecs=opus", robustness: robustness }];
    });
    return defaultKSConfig.map(function (conf) {
        return __assign(__assign({}, conf), { audioCapabilities: audioCapabilities, videoCapabilities: videoCapabilities });
    });
})();
/**
 * Custom implementation of an EME-compliant MediaKeyStatusMap.
 * @class MediaKeyStatusMapImpl
 */
var MediaKeyStatusMapImpl = /** @class */ (function () {
    function MediaKeyStatusMapImpl() {
        this._map = new Map();
    }
    Object.defineProperty(MediaKeyStatusMapImpl.prototype, "size", {
        get: function () {
            return this._map.size;
        },
        enumerable: false,
        configurable: true
    });
    MediaKeyStatusMapImpl.prototype.get = function (keyId) {
        var keyIdAB = keyId instanceof ArrayBuffer ? keyId :
            keyId.buffer;
        return this._map.get(keyIdAB);
    };
    MediaKeyStatusMapImpl.prototype.has = function (keyId) {
        var keyIdAB = keyId instanceof ArrayBuffer ? keyId :
            keyId.buffer;
        return this._map.has(keyIdAB);
    };
    MediaKeyStatusMapImpl.prototype.forEach = function (callbackfn, 
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    thisArg) {
        var _this = this;
        this._map.forEach(function (value, key) { return callbackfn.bind(thisArg, value, key, _this); });
    };
    MediaKeyStatusMapImpl.prototype._setKeyStatus = function (keyId, value) {
        var keyIdAB = keyId instanceof ArrayBuffer ? keyId :
            keyId.buffer;
        if (value === undefined) {
            this._map.delete(keyIdAB);
        }
        else {
            this._map.set(keyIdAB, value);
        }
    };
    return MediaKeyStatusMapImpl;
}());
export { MediaKeyStatusMapImpl };
/**
 * Custom implementation of an EME-compliant MediaKeySession.
 * @class MediaKeySessionImpl
 */
var MediaKeySessionImpl = /** @class */ (function (_super) {
    __extends(MediaKeySessionImpl, _super);
    function MediaKeySessionImpl() {
        var _this = _super.call(this) || this;
        _this._currentKeyId = 0;
        _this.expiration = Number.MAX_VALUE;
        _this.keyStatuses = new MediaKeyStatusMapImpl();
        _this.closed = new Promise(function (res) {
            _this._close = res;
        });
        _this.onkeystatuseschange = null;
        _this.onmessage = null;
        _this.sessionId = "";
        return _this;
    }
    MediaKeySessionImpl.prototype.close = function () {
        if (this._close !== undefined) {
            this._close();
        }
        return Promise.resolve();
    };
    MediaKeySessionImpl.prototype.generateRequest = function (initDataType, initData) {
        var msg = formatFakeChallengeFromInitData(initData, initDataType);
        var event = Object.assign(new CustomEvent("message"), { message: msg.buffer, messageType: "license-request" });
        this.trigger("message", event);
        if (this.onmessage !== null && this.onmessage !== undefined) {
            this.onmessage(event);
        }
        return Promise.resolve();
    };
    MediaKeySessionImpl.prototype.load = function (_sessionId) {
        throw new Error("Not implemented yet");
    };
    MediaKeySessionImpl.prototype.remove = function () {
        return Promise.resolve();
    };
    MediaKeySessionImpl.prototype.update = function (_response) {
        this.keyStatuses._setKeyStatus(new Uint8Array([0, 1, 2, this._currentKeyId++]), "usable");
        var event = new CustomEvent("keystatuseschange");
        this.trigger("keyStatusesChange", event);
        if (this.onkeystatuseschange !== null && this.onkeystatuseschange !== undefined) {
            this.onkeystatuseschange(event);
        }
        return Promise.resolve();
    };
    return MediaKeySessionImpl;
}(EventEmitter));
export { MediaKeySessionImpl };
/**
 * Custom implementation of an EME-compliant MediaKeys.
 * @class MediaKeysImpl
 */
var MediaKeysImpl = /** @class */ (function () {
    function MediaKeysImpl() {
    }
    MediaKeysImpl.prototype.createSession = function (_sessionType) {
        return new MediaKeySessionImpl();
    };
    MediaKeysImpl.prototype.setServerCertificate = function (_serverCertificate) {
        return Promise.resolve(true);
    };
    return MediaKeysImpl;
}());
export { MediaKeysImpl };
/**
 * Custom implementation of an EME-compliant MediaKeySystemAccess.
 * @class MediaKeySystemAccessImpl
 */
var MediaKeySystemAccessImpl = /** @class */ (function () {
    function MediaKeySystemAccessImpl(keySystem, config) {
        this.keySystem = keySystem;
        this._config = config;
    }
    MediaKeySystemAccessImpl.prototype.createMediaKeys = function () {
        return Promise.resolve(new MediaKeysImpl());
    };
    MediaKeySystemAccessImpl.prototype.getConfiguration = function () {
        return this._config;
    };
    return MediaKeySystemAccessImpl;
}());
export { MediaKeySystemAccessImpl };
export function requestMediaKeySystemAccessImpl(keySystem, config) {
    return observableOf(new MediaKeySystemAccessImpl(keySystem, config));
}
/**
 * Mock functions coming from the compat directory.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function mockCompat(exportedFunctions) {
    if (exportedFunctions === void 0) { exportedFunctions = {}; }
    var triggerEncrypted = new Subject();
    var triggerKeyMessage = new Subject();
    var triggerKeyError = new Subject();
    var triggerKeyStatusesChange = new Subject();
    var eventSpies = {
        onEncrypted$: jest.fn(function () { return triggerEncrypted; }),
        onKeyMessage$: jest.fn(function (mediaKeySession) {
            return fromEvent(mediaKeySession, "message");
        }),
        onKeyError$: jest.fn(function (mediaKeySession) {
            return fromEvent(mediaKeySession, "error");
        }),
        onKeyStatusesChange$: jest.fn(function (mediaKeySession) {
            return fromEvent(mediaKeySession, "keyStatusesChange");
        }),
    };
    var rmksaSpy = jest.fn(requestMediaKeySystemAccessImpl);
    var setMediaKeysSpy = jest.fn(function () { return observableOf(null); });
    var generateKeyRequestSpy = jest.fn(function (mks, initializationData) {
        return observableDefer(function () {
            return castToObservable(mks.generateRequest(initializationData.type, initializationData.data));
        });
    });
    var getInitDataSpy = jest.fn(function (encryptedEvent) {
        var initData = encryptedEvent.initData, initDataType = encryptedEvent.initDataType;
        return { initData: new Uint8Array(initData), initDataType: initDataType };
    });
    jest.mock("../../../../compat", function () { return (__assign({ events: eventSpies, requestMediaKeySystemAccess: rmksaSpy, setMediaKeys: setMediaKeysSpy, getInitData: getInitDataSpy, generateKeyRequest: generateKeyRequestSpy }, exportedFunctions)); });
    return { eventSpies: eventSpies,
        eventTriggers: { triggerEncrypted: triggerEncrypted,
            triggerKeyMessage: triggerKeyMessage,
            triggerKeyError: triggerKeyError,
            triggerKeyStatusesChange: triggerKeyStatusesChange }, requestMediaKeySystemAccessSpy: rmksaSpy, getInitDataSpy: getInitDataSpy,
        setMediaKeysSpy: setMediaKeysSpy,
        generateKeyRequestSpy: generateKeyRequestSpy };
}
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
export function testEMEManagerImmediateError(
/* eslint-disable @typescript-eslint/naming-convention */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
EMEManager, 
/* eslint-enable @typescript-eslint/naming-convention */
mediaElement, keySystemsConfigs, contentProtections$) {
    return new Promise(function (res, rej) {
        EMEManager(mediaElement, keySystemsConfigs, contentProtections$)
            .subscribe(function (evt) {
            var eventStr = JSON.stringify(evt);
            rej(new Error("Received an EMEManager event: " + eventStr));
        }, function (err) { res(err); }, function () { return rej(new Error("EMEManager completed.")); });
    });
}
/**
 * Check that the event received corresponds to the session-message event for a
 * license request.
 * @param {Object} evt
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 */
export function expectLicenseRequestMessage(evt, initData, initDataType) {
    expect(evt.type).toEqual("session-message");
    expect(evt.value.messageType).toEqual("license-request");
    expect(evt.value.initializationData.data).toEqual(initData);
    expect(evt.value.initializationData.type).toEqual(initDataType);
}
/**
 * @param {Object} evt
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 */
export function expectInitDataIgnored(evt, initData, initDataType) {
    expect(evt.type).toEqual("init-data-ignored");
    expect(evt.value.initializationData.data).toEqual(initData);
    expect(evt.value.initializationData.type).toEqual(initDataType);
}
/**
 * @param {Object} evt
 * @param {Uint8Array} initData
 * @param {string|undefined} initDataType
 */
export function expectEncryptedEventReceived(evt, initData, initDataType) {
    expect(evt.type).toEqual("encrypted-event-received");
    expect(evt.value.data).toEqual(initData);
    expect(evt.value.type).toEqual(initDataType);
}
/**
 * Does the reverse operation than what `formatFakeChallengeFromInitData` does:
 * Retrieve initialization data from a fake challenge done in our tests
 * @param {Uint8Array} challenge
 * @returns {Object}
 */
export function extrackInfoFromFakeChallenge(challenge) {
    var licenseData = JSON.stringify(utf8ToStr(challenge));
    var initData = base64ToBytes(licenseData[1]);
    return { initData: initData, initDataType: licenseData[0] };
}
/**
 * @param {BufferSource} initData
 * @param {string} initDataType
 * @returns {Uint8Array}
 */
export function formatFakeChallengeFromInitData(initData, initDataType) {
    var initDataAB = initData instanceof ArrayBuffer ? initData :
        initData.buffer;
    var objChallenge = [initDataType, bytesToBase64(new Uint8Array(initDataAB))];
    return strToUtf8(JSON.stringify(objChallenge));
}

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
import { merge as observableMerge, Subject, } from "rxjs";
import { takeUntil } from "rxjs/operators";
import EventEmitter from "../../../utils/event_emitter";
import PPromise from "../../../utils/promise";
import * as events from "../../event_listeners";
import getWebKitFairplayInitData from "../get_webkit_fairplay_initdata";
import { WebKitMediaKeysConstructor, } from "./webkit_media_keys_constructor";
/**
 * Check if keyType is for fairplay DRM
 * @param {string} keyType
 * @returns {boolean}
 */
function isFairplayKeyType(keyType) {
    return keyType === "com.apple.fps.1_0" ||
        keyType === "com.apple.fps.2_0";
}
/**
 * Set media keys on video element using native HTMLMediaElement
 * setMediaKeys from WebKit.
 * @param {HTMLMediaElement} videoElement
 * @param {Object|null} mediaKeys
 */
function setWebKitMediaKeys(videoElement, mediaKeys) {
    /* tslint:disable no-unsafe-any */
    if (videoElement.webkitSetMediaKeys === undefined) {
        throw new Error("No webKitMediaKeys API.");
    }
    return videoElement.webkitSetMediaKeys(mediaKeys);
    /* tslint:enable no-unsafe-any */
}
/**
 * On Safari browsers (>= 9), there are specific webkit prefixed APIs for cyphered
 * content playback. Standard EME APIs are therefore available since Safari 12.1, but they
 * don't allow to play fairplay cyphered content.
 *
 * This class implements a standard EME API polyfill that wraps webkit prefixed Safari
 * EME custom APIs.
 */
var WebkitMediaKeySession = /** @class */ (function (_super) {
    __extends(WebkitMediaKeySession, _super);
    /**
     * @param {HTMLMediaElement} mediaElement
     * @param {string} keyType
     * @param {Uint8Array | undefined} serverCertificate
     */
    function WebkitMediaKeySession(mediaElement, keyType, serverCertificate) {
        var _this = _super.call(this) || this;
        _this._serverCertificate = serverCertificate;
        _this._closeSession$ = new Subject();
        _this._videoElement = mediaElement;
        _this._keyType = keyType;
        _this.closed = new PPromise(function (resolve) {
            _this._closeSession$.subscribe(resolve);
        });
        _this.keyStatuses = new Map();
        _this.expiration = NaN;
        _this.update = function (license) {
            /* tslint:disable no-unsafe-any */
            return new PPromise(function (resolve, reject) {
                if (_this._nativeSession === undefined ||
                    _this._nativeSession.update === undefined ||
                    typeof _this._nativeSession.update !== "function") {
                    return reject("Unavailable WebKit key session.");
                }
                try {
                    resolve(_this._nativeSession.update(license));
                }
                catch (err) {
                    reject(err);
                }
            });
            /* tslint:enable no-unsafe-any */
        };
        return _this;
    }
    /* tslint:disable no-unsafe-any */
    WebkitMediaKeySession.prototype.listenEvent = function (session) {
        var _this = this;
        observableMerge(events.onKeyMessage$(session), events.onKeyAdded$(session), events.onKeyError$(session))
            .pipe(takeUntil(this._closeSession$))
            .subscribe(function (evt) {
            _this.trigger(evt.type, evt);
        });
    };
    /* tslint:enable no-unsafe-any */
    WebkitMediaKeySession.prototype.generateRequest = function (_initDataType, initData) {
        var _this = this;
        return new PPromise(function (resolve) {
            /* tslint:disable no-unsafe-any */
            if (_this._videoElement.webkitKeys === undefined ||
                _this._videoElement.webkitKeys.createSession === undefined) {
                throw new Error("No WebKitMediaKeys API.");
            }
            var formattedInitData;
            if (isFairplayKeyType(_this._keyType)) {
                if (_this._serverCertificate === undefined) {
                    throw new Error("A server certificate is needed for creating fairplay session.");
                }
                formattedInitData = getWebKitFairplayInitData(initData, _this._serverCertificate);
            }
            else {
                formattedInitData = initData;
            }
            var keySession = _this._videoElement.webkitKeys.createSession("video/mp4", formattedInitData);
            /* tslint:enable no-unsafe-any */
            if (keySession === undefined || keySession === null) {
                throw new Error("Impossible to get the key sessions");
            }
            _this.listenEvent(keySession);
            _this._nativeSession = keySession;
            resolve();
        });
    };
    WebkitMediaKeySession.prototype.close = function () {
        var _this = this;
        return new PPromise(function (resolve, reject) {
            _this._closeSession$.next();
            _this._closeSession$.complete();
            /* tslint:disable no-unsafe-any */
            if (_this._nativeSession === undefined) {
                reject("No session to close.");
            }
            _this._nativeSession.close();
            /* tslint:enable no-unsafe-any */
            resolve();
        });
    };
    WebkitMediaKeySession.prototype.load = function () {
        return PPromise.resolve(false);
    };
    WebkitMediaKeySession.prototype.remove = function () {
        return PPromise.resolve();
    };
    Object.defineProperty(WebkitMediaKeySession.prototype, "sessionId", {
        get: function () {
            var _a, _b;
            /* tslint:disable */
            return (_b = (_a = this._nativeSession) === null || _a === void 0 ? void 0 : _a.sessionId) !== null && _b !== void 0 ? _b : "";
            /* tslint:enable */
        },
        enumerable: false,
        configurable: true
    });
    return WebkitMediaKeySession;
}(EventEmitter));
var WebKitCustomMediaKeys = /** @class */ (function () {
    function WebKitCustomMediaKeys(keyType) {
        if (WebKitMediaKeysConstructor === undefined) {
            throw new Error("No WebKitMediaKeys API.");
        }
        this._keyType = keyType;
        this._mediaKeys = new WebKitMediaKeysConstructor(keyType);
    }
    WebKitCustomMediaKeys.prototype._setVideo = function (videoElement) {
        this._videoElement = videoElement;
        if (this._videoElement === undefined) {
            throw new Error("Video not attached to the MediaKeys");
        }
        return setWebKitMediaKeys(this._videoElement, this._mediaKeys);
    };
    WebKitCustomMediaKeys.prototype.createSession = function ( /* sessionType */) {
        if (this._videoElement === undefined ||
            this._mediaKeys === undefined) {
            throw new Error("Video not attached to the MediaKeys");
        }
        return new WebkitMediaKeySession(this._videoElement, this._keyType, this._serverCertificate);
    };
    WebKitCustomMediaKeys.prototype.setServerCertificate = function (serverCertificate) {
        this._serverCertificate = serverCertificate;
        return PPromise.resolve();
    };
    return WebKitCustomMediaKeys;
}());
export default function getWebKitMediaKeysCallbacks() {
    if (WebKitMediaKeysConstructor === undefined) {
        throw new Error("No WebKitMediaKeys API.");
    }
    var isTypeSupported = WebKitMediaKeysConstructor.isTypeSupported;
    var createCustomMediaKeys = function (keyType) {
        return new WebKitCustomMediaKeys(keyType);
    };
    var setMediaKeys = function (elt, mediaKeys) {
        if (mediaKeys === null) {
            return setWebKitMediaKeys(elt, mediaKeys);
        }
        if (!(mediaKeys instanceof WebKitCustomMediaKeys)) {
            throw new Error("Custom setMediaKeys is supposed to be called " +
                "with webkit custom MediaKeys.");
        }
        return mediaKeys._setVideo(elt);
    };
    return {
        isTypeSupported: isTypeSupported,
        createCustomMediaKeys: createCustomMediaKeys,
        setMediaKeys: setMediaKeys,
    };
}

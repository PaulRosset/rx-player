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
import { MSMediaKeysConstructor } from "./ms_media_keys_constructor";
var IE11MediaKeySession = /** @class */ (function (_super) {
    __extends(IE11MediaKeySession, _super);
    function IE11MediaKeySession(mk) {
        var _this = _super.call(this) || this;
        _this.expiration = NaN;
        _this.keyStatuses = new Map();
        _this._mk = mk;
        _this._closeSession$ = new Subject();
        _this.closed = new PPromise(function (resolve) {
            _this._closeSession$.subscribe(resolve);
        });
        _this.update = function (license) {
            return new PPromise(function (resolve, reject) {
                if (_this._ss === undefined) {
                    return reject("MediaKeySession not set.");
                }
                try {
                    /* eslint-disable @typescript-eslint/no-unsafe-call */
                    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                    resolve(_this._ss.update(license, /* sessionId */ ""));
                    /* eslint-enable @typescript-eslint/no-unsafe-call */
                    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
                }
                catch (err) {
                    reject(err);
                }
            });
        };
        return _this;
    }
    IE11MediaKeySession.prototype.generateRequest = function (_initDataType, initData) {
        var _this = this;
        return new PPromise(function (resolve) {
            /* eslint-disable @typescript-eslint/no-unsafe-call */
            /* eslint-disable @typescript-eslint/no-unsafe-member-access */
            _this._ss = _this._mk.createSession("video/mp4", initData);
            /* eslint-enable @typescript-eslint/no-unsafe-call */
            /* eslint-enable @typescript-eslint/no-unsafe-member-access */
            observableMerge(events.onKeyMessage$(_this._ss), events.onKeyAdded$(_this._ss), events.onKeyError$(_this._ss)).pipe(takeUntil(_this._closeSession$))
                .subscribe(function (evt) { return _this.trigger(evt.type, evt); });
            resolve();
        });
    };
    IE11MediaKeySession.prototype.close = function () {
        var _this = this;
        return new PPromise(function (resolve) {
            if (_this._ss != null) {
                /* eslint-disable @typescript-eslint/no-floating-promises */
                _this._ss.close();
                /* eslint-enable @typescript-eslint/no-floating-promises */
                _this._ss = undefined;
            }
            _this._closeSession$.next();
            _this._closeSession$.complete();
            resolve();
        });
    };
    IE11MediaKeySession.prototype.load = function () {
        return PPromise.resolve(false);
    };
    IE11MediaKeySession.prototype.remove = function () {
        return PPromise.resolve();
    };
    Object.defineProperty(IE11MediaKeySession.prototype, "sessionId", {
        get: function () {
            var _a, _b;
            return (_b = (_a = this._ss) === null || _a === void 0 ? void 0 : _a.sessionId) !== null && _b !== void 0 ? _b : "";
        },
        enumerable: false,
        configurable: true
    });
    return IE11MediaKeySession;
}(EventEmitter));
var IE11CustomMediaKeys = /** @class */ (function () {
    function IE11CustomMediaKeys(keyType) {
        if (MSMediaKeysConstructor === undefined) {
            throw new Error("No MSMediaKeys API.");
        }
        this._mediaKeys = new MSMediaKeysConstructor(keyType);
    }
    IE11CustomMediaKeys.prototype._setVideo = function (videoElement) {
        this._videoElement = videoElement;
        /* eslint-disable @typescript-eslint/no-unsafe-member-access */
        /* eslint-disable @typescript-eslint/no-unsafe-call */
        if (this._videoElement.msSetMediaKeys !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return this._videoElement.msSetMediaKeys(this._mediaKeys);
        }
        /* eslint-enable @typescript-eslint/no-unsafe-member-access */
        /* eslint-enable @typescript-eslint/no-unsafe-call */
    };
    IE11CustomMediaKeys.prototype.createSession = function ( /* sessionType */) {
        if (this._videoElement === undefined || this._mediaKeys === undefined) {
            throw new Error("Video not attached to the MediaKeys");
        }
        return new IE11MediaKeySession(this._mediaKeys);
    };
    IE11CustomMediaKeys.prototype.setServerCertificate = function () {
        throw new Error("Server certificate is not implemented in your browser");
    };
    return IE11CustomMediaKeys;
}());
export default function getIE11MediaKeysCallbacks() {
    var isTypeSupported = function (keySystem, type) {
        if (MSMediaKeysConstructor === undefined) {
            throw new Error("No MSMediaKeys API.");
        }
        if (type !== undefined) {
            return MSMediaKeysConstructor.isTypeSupported(keySystem, type);
        }
        return MSMediaKeysConstructor.isTypeSupported(keySystem);
    };
    var createCustomMediaKeys = function (keyType) {
        return new IE11CustomMediaKeys(keyType);
    };
    var setMediaKeys = function (elt, mediaKeys) {
        if (mediaKeys === null) {
            // msSetMediaKeys only accepts native MSMediaKeys as argument.
            // Calling it with null or undefined will raise an exception.
            // There is no way to unset the mediakeys in that case, so return here.
            return;
        }
        if (!(mediaKeys instanceof IE11CustomMediaKeys)) {
            throw new Error("Custom setMediaKeys is supposed to be called " +
                "with IE11 custom MediaKeys.");
        }
        return mediaKeys._setVideo(elt);
    };
    return {
        isTypeSupported: isTypeSupported,
        createCustomMediaKeys: createCustomMediaKeys,
        setMediaKeys: setMediaKeys,
    };
}
export { MSMediaKeysConstructor };

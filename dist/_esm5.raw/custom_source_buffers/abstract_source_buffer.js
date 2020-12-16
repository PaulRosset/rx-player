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
import nextTick from "next-tick";
import { of as observableOf, } from "rxjs";
import EventEmitter from "../utils/event_emitter";
import tryCatch from "../utils/rx-try_catch";
import ManualTimeRanges from "./time_ranges";
/**
 * Abstract class for a custom SourceBuffer implementation.
 * @class AbstractSourceBuffer
 * @extends EventEmitter
 */
var AbstractSourceBuffer = /** @class */ (function (_super) {
    __extends(AbstractSourceBuffer, _super);
    function AbstractSourceBuffer() {
        var _this = _super.call(this) || this;
        _this.updating = false;
        _this.readyState = "opened";
        _this.buffered = new ManualTimeRanges();
        _this.timestampOffset = 0;
        _this.appendWindowStart = 0;
        _this.appendWindowEnd = Infinity;
        return _this;
    }
    /**
     * Mimic the SourceBuffer _appendBuffer_ method: Append a segment to the
     * buffer.
     * @param {*} data
     */
    AbstractSourceBuffer.prototype.appendBuffer = function (data) {
        var _this = this;
        this._lock(function () { return _this._append(data); });
    };
    /**
     * Mimic the SourceBuffer _remove_ method: remove buffered segments.
     * @param {Number} from
     * @param {Number} to
     */
    AbstractSourceBuffer.prototype.remove = function (from, to) {
        var _this = this;
        this._lock(function () { return _this._remove(from, to); });
    };
    /**
     * Call `appendBuffer` synchronously (do not wait for nextTick).
     * @param {*} data
     */
    AbstractSourceBuffer.prototype.appendBufferSync = function (data) {
        var _this = this;
        this._lockSync(function () { return _this._append(data); });
    };
    /**
     * Call `remove` synchronously (do not wait for nextTick).
     * @param {Number} from
     * @param {Number} to
     */
    AbstractSourceBuffer.prototype.removeSync = function (from, to) {
        var _this = this;
        this._lockSync(function () { return _this._remove(from, to); });
    };
    /**
     * Mimic the SourceBuffer _abort_ method.
     */
    AbstractSourceBuffer.prototype.abort = function () {
        this.updating = false;
        this.readyState = "closed";
        this._abort();
    };
    /**
     * Active a lock, execute the given function, unlock when finished (on
     * nextTick).
     * Throws if multiple lock are active at the same time.
     * Also triggers the right events on start, error and end
     * @param {Function} func
     */
    AbstractSourceBuffer.prototype._lock = function (func) {
        var _this = this;
        if (this.updating) {
            throw new Error("SourceBuffer: SourceBuffer already updating.");
        }
        this.updating = true;
        this.trigger("updatestart", undefined);
        var result = tryCatch(function () {
            func();
            return observableOf(undefined);
        }, undefined);
        result.subscribe(function () { return nextTick(function () {
            _this.updating = false;
            _this.trigger("update", undefined);
            _this.trigger("updateend", undefined);
        }); }, function (e) { return nextTick(function () {
            _this.updating = false;
            _this.trigger("error", e);
            _this.trigger("updateend", undefined);
        }); });
    };
    /**
     * Call SourceBuffer function but throw errors and emit events synchronously.
     * Throws if another function is already active.
     * Also triggers the right events on start, error and end
     * @param {Function} func
     * @param {*} data
     */
    AbstractSourceBuffer.prototype._lockSync = function (func) {
        if (this.updating) {
            throw new Error("SourceBuffer: SourceBuffer already updating.");
        }
        this.updating = true;
        this.trigger("updatestart", undefined);
        try {
            func();
        }
        catch (e) {
            this.updating = false;
            this.trigger("error", e);
            this.trigger("updateend", undefined);
            throw e;
        }
        this.updating = false;
        this.trigger("update", undefined);
        this.trigger("updateend", undefined);
    };
    return AbstractSourceBuffer;
}(EventEmitter));
export default AbstractSourceBuffer;

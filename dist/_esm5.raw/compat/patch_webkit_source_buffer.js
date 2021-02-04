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
import nextTick from "next-tick";
import EventEmitter from "../utils/event_emitter";
import isNode from "./is_node";
// TODO This is the last ugly side-effect here.
// Either remove it or find the best way to implement that
export default function patchWebkitSourceBuffer() {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    /* eslint-disable @typescript-eslint/no-unsafe-call */
    // old WebKit SourceBuffer implementation,
    // where a synchronous append is used instead of appendBuffer
    if (!isNode && window.WebKitSourceBuffer != null &&
        window.WebKitSourceBuffer.prototype.addEventListener === undefined) {
        /* eslint-disable @typescript-eslint/no-unsafe-assignment */
        var sourceBufferWebkitRef = window.WebKitSourceBuffer;
        var sourceBufferWebkitProto = sourceBufferWebkitRef.prototype;
        for (var fnName in EventEmitter.prototype) {
            if (EventEmitter.prototype.hasOwnProperty(fnName)) {
                sourceBufferWebkitProto[fnName] = EventEmitter.prototype[fnName];
            }
        }
        /* eslint-enable @typescript-eslint/no-unsafe-assignment */
        sourceBufferWebkitProto._listeners = [];
        sourceBufferWebkitProto._emitUpdate =
            function (eventName, val) {
                var _this = this;
                nextTick(function () {
                    /* eslint-disable no-invalid-this */
                    _this.trigger(eventName, val);
                    _this.updating = false;
                    _this.trigger("updateend");
                    /* eslint-enable no-invalid-this */
                });
            };
        sourceBufferWebkitProto.appendBuffer =
            function (data) {
                /* eslint-disable no-invalid-this */
                // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
                if (this.updating) {
                    throw new Error("updating");
                }
                this.trigger("updatestart");
                this.updating = true;
                try {
                    this.append(data);
                }
                catch (error) {
                    this._emitUpdate("error", error);
                    return;
                }
                this._emitUpdate("update");
                /* eslint-enable no-invalid-this */
            };
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
    /* eslint-enable @typescript-eslint/no-unsafe-call */
}

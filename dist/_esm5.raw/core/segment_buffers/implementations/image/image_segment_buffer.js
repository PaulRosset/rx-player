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
import { defer as observableDefer, of as observableOf, } from "rxjs";
import log from "../../../../log";
import { SegmentBuffer, } from "../types";
import ManualTimeRanges from "../utils/manual_time_ranges";
/**
 * Image SegmentBuffer implementation.
 * @class ImageSegmentBuffer
 */
var ImageSegmentBuffer = /** @class */ (function (_super) {
    __extends(ImageSegmentBuffer, _super);
    function ImageSegmentBuffer() {
        var _this = this;
        log.debug("ISB: Creating ImageSegmentBuffer");
        _this = _super.call(this) || this;
        _this.bufferType = "image";
        _this._buffered = new ManualTimeRanges();
        return _this;
    }
    /**
     * @param {Object} data
     */
    ImageSegmentBuffer.prototype.pushChunk = function (infos) {
        var _this = this;
        return observableDefer(function () {
            var _a, _b;
            log.debug("ISB: appending new data.");
            if (infos.data.chunk === null) {
                return observableOf(undefined);
            }
            var _c = infos.data, appendWindow = _c.appendWindow, chunk = _c.chunk;
            var start = chunk.start, end = chunk.end, timescale = chunk.timescale;
            var appendWindowStart = (_a = appendWindow[0]) !== null && _a !== void 0 ? _a : 0;
            var appendWindowEnd = (_b = appendWindow[1]) !== null && _b !== void 0 ? _b : Infinity;
            var timescaledStart = start / timescale;
            var timescaledEnd = end / timescale;
            var startTime = Math.max(appendWindowStart, timescaledStart);
            var endTime = Math.min(appendWindowEnd, timescaledEnd);
            _this._buffered.insert(startTime, endTime);
            if (infos.inventoryInfos !== null) {
                _this._segmentInventory.insertChunk(infos.inventoryInfos);
            }
            return observableOf(undefined);
        });
    };
    /**
     * @param {Number} from
     * @param {Number} to
     */
    ImageSegmentBuffer.prototype.removeBuffer = function (start, end) {
        return observableDefer(function () {
            log.info("ISB: ignored image data remove order", start, end);
            // Logic removed as it caused more problems than it resolved:
            // Image thumbnails are always downloaded as a single BIF file, meaning that
            // any removing might necessitate to re-load the whole file in the future
            // which seems pointless.
            // In any case, image handling through the regular RxPlayer APIs has been
            // completely deprecated now for several reasons, and should disappear in
            // the next major version.
            return observableOf(undefined);
        });
    };
    /**
     * Indicate that every chunks from a Segment has been given to pushChunk so
     * far.
     * This will update our internal Segment inventory accordingly.
     * The returned Observable will emit and complete successively once the whole
     * segment has been pushed and this indication is acknowledged.
     * @param {Object} infos
     * @returns {Observable}
     */
    ImageSegmentBuffer.prototype.endOfSegment = function (_infos) {
        var _this = this;
        return observableDefer(function () {
            _this._segmentInventory.completeSegment(_infos);
            return observableOf(undefined);
        });
    };
    /**
     * Returns the currently buffered data, in a TimeRanges object.
     * @returns {TimeRanges}
     */
    ImageSegmentBuffer.prototype.getBufferedRanges = function () {
        return this._buffered;
    };
    ImageSegmentBuffer.prototype.dispose = function () {
        log.debug("ISB: disposing image SegmentBuffer");
        this._buffered.remove(0, Infinity);
    };
    return ImageSegmentBuffer;
}(SegmentBuffer));
export default ImageSegmentBuffer;

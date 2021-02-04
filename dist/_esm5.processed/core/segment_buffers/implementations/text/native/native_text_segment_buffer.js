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
import { addTextTrack, } from "../../../../../compat";
import removeCue from "../../../../../compat/remove_cue";
import log from "../../../../../log";
import { SegmentBuffer, } from "../../types";
import ManualTimeRanges from "../../utils/manual_time_ranges";
import parseTextTrackToCues from "./parsers";
/**
 * Implementation of an SegmentBuffer for "native" text tracks.
 * "Native" text tracks rely on a `<track>` HTMLElement and its associated
 * expected behavior to display subtitles synchronized to the video.
 * @class NativeTextSegmentBuffer
 */
var NativeTextSegmentBuffer = /** @class */ (function (_super) {
    __extends(NativeTextSegmentBuffer, _super);
    /**
     * @param {HTMLMediaElement} videoElement
     * @param {Boolean} hideNativeSubtitle
     */
    function NativeTextSegmentBuffer(videoElement, hideNativeSubtitle) {
        var _this = this;
        log.debug("NTSB: Creating NativeTextSegmentBuffer");
        _this = _super.call(this) || this;
        var _a = addTextTrack(videoElement, hideNativeSubtitle), track = _a.track, trackElement = _a.trackElement;
        _this.bufferType = "text";
        _this._buffered = new ManualTimeRanges();
        _this._videoElement = videoElement;
        _this._track = track;
        _this._trackElement = trackElement;
        return _this;
    }
    /**
     * @param {Object} infos
     * @returns {Observable}
     */
    NativeTextSegmentBuffer.prototype.pushChunk = function (infos) {
        var _this = this;
        return observableDefer(function () {
            var _a, _b;
            log.debug("NTSB: Appending new native text tracks");
            if (infos.data.chunk === null) {
                return observableOf(undefined);
            }
            var _c = infos.data, timestampOffset = _c.timestampOffset, appendWindow = _c.appendWindow, chunk = _c.chunk;
            var startTime = chunk.start, endTime = chunk.end, dataString = chunk.data, type = chunk.type, language = chunk.language;
            var appendWindowStart = (_a = appendWindow[0]) !== null && _a !== void 0 ? _a : 0;
            var appendWindowEnd = (_b = appendWindow[1]) !== null && _b !== void 0 ? _b : Infinity;
            var cues = parseTextTrackToCues(type, dataString, timestampOffset, language);
            if (appendWindowStart !== 0 && appendWindowEnd !== Infinity) {
                // Removing before window start
                var i = 0;
                while (i < cues.length && cues[i].endTime <= appendWindowStart) {
                    i++;
                }
                cues.splice(0, i);
                i = 0;
                while (i < cues.length && cues[i].startTime < appendWindowStart) {
                    cues[i].startTime = appendWindowStart;
                    i++;
                }
                // Removing after window end
                i = cues.length - 1;
                while (i >= 0 && cues[i].startTime >= appendWindowEnd) {
                    i--;
                }
                cues.splice(i, cues.length);
                i = cues.length - 1;
                while (i >= 0 && cues[i].endTime > appendWindowEnd) {
                    cues[i].endTime = appendWindowEnd;
                    i--;
                }
            }
            var start;
            if (startTime !== undefined) {
                start = Math.max(appendWindowStart, startTime);
            }
            else {
                if (cues.length <= 0) {
                    log.warn("NTSB: Current text tracks have no cues nor start time. Aborting");
                    return observableOf(undefined);
                }
                log.warn("NTSB: No start time given. Guessing from cues.");
                start = cues[0].startTime;
            }
            var end;
            if (endTime !== undefined) {
                end = Math.min(appendWindowEnd, endTime);
            }
            else {
                if (cues.length <= 0) {
                    log.warn("NTSB: Current text tracks have no cues nor end time. Aborting");
                    return observableOf(undefined);
                }
                log.warn("NTSB: No end time given. Guessing from cues.");
                end = cues[cues.length - 1].endTime;
            }
            if (end <= start) {
                log.warn("NTSB: Invalid text track appended: ", "the start time is inferior or equal to the end time.");
                return observableOf(undefined);
            }
            if (cues.length > 0) {
                var firstCue = cues[0];
                // NOTE(compat): cleanup all current cues if the newly added
                // ones are in the past. this is supposed to fix an issue on
                // IE/Edge.
                // TODO Move to compat
                var currentCues = _this._track.cues;
                if (currentCues !== null && currentCues.length > 0) {
                    if (firstCue.startTime < currentCues[currentCues.length - 1].startTime) {
                        _this._removeData(firstCue.startTime, +Infinity);
                    }
                }
                for (var i = 0; i < cues.length; i++) {
                    _this._track.addCue(cues[i]);
                }
            }
            _this._buffered.insert(start, end);
            if (infos.inventoryInfos !== null) {
                _this._segmentInventory.insertChunk(infos.inventoryInfos);
            }
            return observableOf(undefined);
        });
    };
    /**
     * Remove buffered data.
     * @param {number} start - start position, in seconds
     * @param {number} end - end position, in seconds
     * @returns {Observable}
     */
    NativeTextSegmentBuffer.prototype.removeBuffer = function (start, end) {
        var _this = this;
        return observableDefer(function () {
            _this._removeData(start, end);
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
    NativeTextSegmentBuffer.prototype.endOfSegment = function (_infos) {
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
    NativeTextSegmentBuffer.prototype.getBufferedRanges = function () {
        return this._buffered;
    };
    NativeTextSegmentBuffer.prototype.dispose = function () {
        log.debug("NTSB: Aborting NativeTextSegmentBuffer");
        this._removeData(0, Infinity);
        var _a = this, _trackElement = _a._trackElement, _videoElement = _a._videoElement;
        if (_trackElement !== undefined && _videoElement.hasChildNodes()) {
            try {
                _videoElement.removeChild(_trackElement);
            }
            catch (e) {
                log.warn("NTSB: Can't remove track element from the video");
            }
        }
        this._track.mode = "disabled";
        if (this._trackElement !== undefined) {
            this._trackElement.innerHTML = "";
        }
    };
    NativeTextSegmentBuffer.prototype._removeData = function (start, end) {
        log.debug("NTSB: Removing native text track data", start, end);
        var track = this._track;
        var cues = track.cues;
        if (cues !== null) {
            for (var i = cues.length - 1; i >= 0; i--) {
                var cue = cues[i];
                var startTime = cue.startTime, endTime = cue.endTime;
                if (startTime >= start && startTime <= end && endTime <= end) {
                    removeCue(track, cue);
                }
            }
        }
        this._buffered.remove(start, end);
    };
    return NativeTextSegmentBuffer;
}(SegmentBuffer));
export default NativeTextSegmentBuffer;

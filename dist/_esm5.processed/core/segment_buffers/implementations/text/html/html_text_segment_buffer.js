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
import { concat as observableConcat, defer as observableDefer, interval as observableInterval, merge as observableMerge, of as observableOf, Subject, } from "rxjs";
import { mapTo, startWith, switchMapTo, takeUntil, } from "rxjs/operators";
import { events, onHeightWidthChange, } from "../../../../../compat";
import config from "../../../../../config";
import log from "../../../../../log";
import { SegmentBuffer, } from "../../types";
import ManualTimeRanges from "../../utils/manual_time_ranges";
import parseTextTrackToElements from "./parsers";
import TextTrackCuesStore from "./text_track_cues_store";
import updateProportionalElements from "./update_proportional_elements";
var onEnded$ = events.onEnded$, onSeeked$ = events.onSeeked$, onSeeking$ = events.onSeeking$;
var MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL = config.MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL, TEXT_TRACK_SIZE_CHECKS_INTERVAL = config.TEXT_TRACK_SIZE_CHECKS_INTERVAL;
/**
 * Generate the clock at which TextTrack HTML Cues should be refreshed.
 * @param {HTMLMediaElement} videoElement
 * @returns {Observable}
 */
function generateClock(videoElement) {
    var seeking$ = onSeeking$(videoElement);
    var seeked$ = onSeeked$(videoElement);
    var ended$ = onEnded$(videoElement);
    var manualRefresh$ = observableMerge(seeked$, ended$);
    var autoRefresh$ = observableInterval(MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL)
        .pipe(startWith(null));
    return manualRefresh$.pipe(startWith(null), switchMapTo(observableConcat(autoRefresh$
        .pipe(mapTo(true), takeUntil(seeking$)), observableOf(false))));
}
/**
 * @param {Element} element
 * @param {Element} child
 */
function safelyRemoveChild(element, child) {
    try {
        element.removeChild(child);
    }
    catch (_error) {
        log.warn("HTSB: Can't remove text track: not in the element.");
    }
}
/**
 * @param {HTMLElement} element
 * @returns {Object|null}
 */
function getElementResolution(element) {
    var strRows = element.getAttribute("data-resolution-rows");
    var strColumns = element.getAttribute("data-resolution-columns");
    if (strRows === null || strColumns === null) {
        return null;
    }
    var rows = parseInt(strRows, 10);
    var columns = parseInt(strColumns, 10);
    if (rows === null || columns === null) {
        return null;
    }
    return { rows: rows, columns: columns };
}
/**
 * SegmentBuffer implementation which display buffered TextTracks in the given
 * HTML element.
 * @class HTMLTextSegmentBuffer
 */
var HTMLTextSegmentBuffer = /** @class */ (function (_super) {
    __extends(HTMLTextSegmentBuffer, _super);
    /**
     * @param {HTMLMediaElement} videoElement
     * @param {HTMLElement} textTrackElement
     */
    function HTMLTextSegmentBuffer(videoElement, textTrackElement) {
        var _this = this;
        log.debug("HTSB: Creating HTMLTextSegmentBuffer");
        _this = _super.call(this) || this;
        _this.bufferType = "text";
        _this._buffered = new ManualTimeRanges();
        _this._videoElement = videoElement;
        _this._textTrackElement = textTrackElement;
        _this._clearSizeUpdates$ = new Subject();
        _this._destroy$ = new Subject();
        _this._buffer = new TextTrackCuesStore();
        _this._currentCues = [];
        // update text tracks
        generateClock(_this._videoElement)
            .pipe(takeUntil(_this._destroy$))
            .subscribe(function (shouldDisplay) {
            if (!shouldDisplay) {
                _this._disableCurrentCues();
                return;
            }
            // to spread the time error, we divide the regular chosen interval.
            var time = Math.max(_this._videoElement.currentTime +
                (MAXIMUM_HTML_TEXT_TRACK_UPDATE_INTERVAL / 1000) / 2, 0);
            var cues = _this._buffer.get(time);
            if (cues.length === 0) {
                _this._disableCurrentCues();
            }
            else {
                _this._displayCues(cues);
            }
        });
        return _this;
    }
    /**
     * Push segment on Subscription.
     * @param {Object} infos
     * @returns {Observable}
     */
    HTMLTextSegmentBuffer.prototype.pushChunk = function (infos) {
        var _this = this;
        return observableDefer(function () {
            _this.pushChunkSync(infos);
            return observableOf(undefined);
        });
    };
    /**
     * Remove buffered data.
     * @param {number} start - start position, in seconds
     * @param {number} end - end position, in seconds
     * @returns {Observable}
     */
    HTMLTextSegmentBuffer.prototype.removeBuffer = function (start, end) {
        var _this = this;
        return observableDefer(function () {
            _this.removeBufferSync(start, end);
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
    HTMLTextSegmentBuffer.prototype.endOfSegment = function (_infos) {
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
    HTMLTextSegmentBuffer.prototype.getBufferedRanges = function () {
        return this._buffered;
    };
    HTMLTextSegmentBuffer.prototype.dispose = function () {
        log.debug("HTSB: Disposing HTMLTextSegmentBuffer");
        this._disableCurrentCues();
        this._buffer.remove(0, Infinity);
        this._buffered.remove(0, Infinity);
        this._destroy$.next();
        this._destroy$.complete();
    };
    /**
     * Push the text track contained in `data` to the HTMLTextSegmentBuffer
     * synchronously.
     * Returns a boolean:
     *   - `true` if text tracks have been added the the HTMLTextSegmentBuffer's
     *     buffer after that segment has been added.
     *   - `false` if no text tracks have been added the the
     *     HTMLTextSegmentBuffer's buffer (e.g. empty text-track, incoherent times
     *     etc.)
     *
     * /!\ This method won't add any data to the linked inventory.
     * Please use the `pushChunk` method for most use-cases.
     * @param {Object} data
     * @returns {boolean}
     */
    HTMLTextSegmentBuffer.prototype.pushChunkSync = function (infos) {
        var _a, _b;
        log.debug("HTSB: Appending new html text tracks");
        var _c = infos.data, timestampOffset = _c.timestampOffset, appendWindow = _c.appendWindow, chunk = _c.chunk;
        if (chunk === null) {
            return;
        }
        var timescale = chunk.timescale, timescaledStart = chunk.start, timescaledEnd = chunk.end, dataString = chunk.data, type = chunk.type, language = chunk.language;
        var appendWindowStart = (_a = appendWindow[0]) !== null && _a !== void 0 ? _a : 0;
        var appendWindowEnd = (_b = appendWindow[1]) !== null && _b !== void 0 ? _b : Infinity;
        var startTime = timescaledStart !== undefined ? timescaledStart / timescale :
            undefined;
        var endTime = timescaledEnd !== undefined ? timescaledEnd / timescale :
            undefined;
        var cues = parseTextTrackToElements(type, dataString, timestampOffset, language);
        if (appendWindowStart !== 0 && appendWindowEnd !== Infinity) {
            // Removing before window start
            var i = 0;
            while (i < cues.length && cues[i].end <= appendWindowStart) {
                i++;
            }
            cues.splice(0, i);
            i = 0;
            while (i < cues.length && cues[i].start < appendWindowStart) {
                cues[i].start = appendWindowStart;
                i++;
            }
            // Removing after window end
            i = cues.length - 1;
            while (i >= 0 && cues[i].start >= appendWindowEnd) {
                i--;
            }
            cues.splice(i, cues.length);
            i = cues.length - 1;
            while (i >= 0 && cues[i].end > appendWindowEnd) {
                cues[i].end = appendWindowEnd;
                i--;
            }
        }
        var start;
        if (startTime !== undefined) {
            start = Math.max(appendWindowStart, startTime);
        }
        else {
            if (cues.length <= 0) {
                log.warn("HTSB: Current text tracks have no cues nor start time. Aborting");
                return;
            }
            log.warn("HTSB: No start time given. Guessing from cues.");
            start = cues[0].start;
        }
        var end;
        if (endTime !== undefined) {
            end = Math.min(appendWindowEnd, endTime);
        }
        else {
            if (cues.length <= 0) {
                log.warn("HTSB: Current text tracks have no cues nor end time. Aborting");
                return;
            }
            log.warn("HTSB: No end time given. Guessing from cues.");
            end = cues[cues.length - 1].end;
        }
        if (end <= start) {
            log.warn("HTSB: Invalid text track appended: ", "the start time is inferior or equal to the end time.");
            return;
        }
        if (infos.inventoryInfos !== null) {
            this._segmentInventory.insertChunk(infos.inventoryInfos);
        }
        this._buffer.insert(cues, start, end);
        this._buffered.insert(start, end);
    };
    /**
     * Remove buffer data between the given start and end, synchronously.
     * @param {number} start
     * @param {number} end
     */
    HTMLTextSegmentBuffer.prototype.removeBufferSync = function (start, end) {
        log.debug("HTSB: Removing html text track data", start, end);
        this._buffer.remove(start, end);
        this._buffered.remove(start, end);
    };
    /**
     * Remove the current cue from being displayed.
     */
    HTMLTextSegmentBuffer.prototype._disableCurrentCues = function () {
        this._clearSizeUpdates$.next();
        if (this._currentCues.length > 0) {
            for (var i = 0; i < this._currentCues.length; i++) {
                safelyRemoveChild(this._textTrackElement, this._currentCues[i].element);
            }
            this._currentCues = [];
        }
    };
    /**
     * Display a new Cue. If one was already present, it will be replaced.
     * @param {HTMLElement} element
     */
    HTMLTextSegmentBuffer.prototype._displayCues = function (elements) {
        var nothingChanged = this._currentCues.length === elements.length &&
            this._currentCues.every(function (current, index) { return current.element === elements[index]; });
        if (nothingChanged) {
            return;
        }
        // Remove and re-display everything
        // TODO More intelligent handling
        this._clearSizeUpdates$.next();
        for (var i = 0; i < this._currentCues.length; i++) {
            safelyRemoveChild(this._textTrackElement, this._currentCues[i].element);
        }
        this._currentCues = [];
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var resolution = getElementResolution(element);
            this._currentCues.push({ element: element, resolution: resolution });
            this._textTrackElement.appendChild(element);
        }
        var proportionalCues = this._currentCues
            .filter(function (cue) { return cue.resolution !== null; });
        if (proportionalCues.length > 0) {
            // update propertionally-sized elements periodically
            onHeightWidthChange(this._textTrackElement, TEXT_TRACK_SIZE_CHECKS_INTERVAL)
                .pipe(takeUntil(this._clearSizeUpdates$), takeUntil(this._destroy$))
                .subscribe(function (_a) {
                var height = _a.height, width = _a.width;
                for (var i = 0; i < proportionalCues.length; i++) {
                    var _b = proportionalCues[i], resolution = _b.resolution, element = _b.element;
                    updateProportionalElements(height, width, resolution, element);
                }
            });
        }
    };
    return HTMLTextSegmentBuffer;
}(SegmentBuffer));
export default HTMLTextSegmentBuffer;

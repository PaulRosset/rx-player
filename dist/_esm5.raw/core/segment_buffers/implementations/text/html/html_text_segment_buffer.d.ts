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
import { ITextTrackSegmentData } from "../../../../../transports";
import { IEndOfSegmentInfos, IPushChunkInfos, SegmentBuffer } from "../../types";
import ManualTimeRanges from "../../utils/manual_time_ranges";
/**
 * SegmentBuffer implementation which display buffered TextTracks in the given
 * HTML element.
 * @class HTMLTextSegmentBuffer
 */
export default class HTMLTextSegmentBuffer extends SegmentBuffer<ITextTrackSegmentData> {
    readonly bufferType: "text";
    /**
     * The video element the cues refer to.
     * Used to know when the user is seeking, for example.
     */
    private readonly _videoElement;
    /**
     * When "nexting" that subject, every Observable declared here will be
     * unsubscribed.
     * Used for clean-up
     */
    private readonly _destroy$;
    /** HTMLElement which will contain the cues */
    private readonly _textTrackElement;
    /** Buffer containing the data */
    private readonly _buffer;
    /**
     * We could need us to automatically update styling depending on
     * `_textTrackElement`'s size. This Subject allows to stop that
     * regular check.
     */
    private _clearSizeUpdates$;
    /** Information on cues currently displayed. */
    private _currentCues;
    private _buffered;
    /**
     * @param {HTMLMediaElement} videoElement
     * @param {HTMLElement} textTrackElement
     */
    constructor(videoElement: HTMLMediaElement, textTrackElement: HTMLElement);
    /**
     * Push segment on Subscription.
     * @param {Object} infos
     * @returns {Observable}
     */
    pushChunk(infos: IPushChunkInfos<ITextTrackSegmentData>): Observable<void>;
    /**
     * Remove buffered data.
     * @param {number} start - start position, in seconds
     * @param {number} end - end position, in seconds
     * @returns {Observable}
     */
    removeBuffer(start: number, end: number): Observable<void>;
    /**
     * Indicate that every chunks from a Segment has been given to pushChunk so
     * far.
     * This will update our internal Segment inventory accordingly.
     * The returned Observable will emit and complete successively once the whole
     * segment has been pushed and this indication is acknowledged.
     * @param {Object} infos
     * @returns {Observable}
     */
    endOfSegment(_infos: IEndOfSegmentInfos): Observable<void>;
    /**
     * Returns the currently buffered data, in a TimeRanges object.
     * @returns {TimeRanges}
     */
    getBufferedRanges(): ManualTimeRanges;
    dispose(): void;
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
    pushChunkSync(infos: IPushChunkInfos<ITextTrackSegmentData>): void;
    /**
     * Remove buffer data between the given start and end, synchronously.
     * @param {number} start
     * @param {number} end
     */
    removeBufferSync(start: number, end: number): void;
    /**
     * Remove the current cue from being displayed.
     */
    private _disableCurrentCues;
    /**
     * Display a new Cue. If one was already present, it will be replaced.
     * @param {HTMLElement} element
     */
    private _displayCues;
}

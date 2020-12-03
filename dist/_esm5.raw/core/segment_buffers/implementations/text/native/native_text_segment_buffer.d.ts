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
import { IEndOfSegmentInfos, IPushChunkInfos, SegmentBuffer } from "../../types";
import ManualTimeRanges from "../../utils/manual_time_ranges";
/** Format of the data pushed to the `NativeTextSegmentBuffer`. */
export interface INativeTextTrackData {
    /** The text track content. Should be a string in the format indicated by `type`. */
    data: string;
    /** The format the text track is in (e.g. "ttml" or "vtt") */
    type: string;
    /** Timescale for the start and end attributes */
    timescale: number;
    /** Exact beginning time to which the track applies. */
    start?: number;
    /** Exact end time to which the track applies. */
    end?: number;
    /**
     * Language the texttrack is in. This is sometimes needed to properly parse
     * the text track. For example for tracks in the "sami" format.
     */
    language?: string;
}
/**
 * Implementation of an SegmentBuffer for "native" text tracks.
 * "Native" text tracks rely on a `<track>` HTMLElement and its associated
 * expected behavior to display subtitles synchronized to the video.
 * @class NativeTextSegmentBuffer
 */
export default class NativeTextSegmentBuffer extends SegmentBuffer<INativeTextTrackData> {
    readonly bufferType: "text";
    private readonly _videoElement;
    private readonly _track;
    private readonly _trackElement?;
    private _buffered;
    /**
     * @param {HTMLMediaElement} videoElement
     * @param {Boolean} hideNativeSubtitle
     */
    constructor(videoElement: HTMLMediaElement, hideNativeSubtitle: boolean);
    /**
     * @param {Object} infos
     * @returns {Observable}
     */
    pushChunk(infos: IPushChunkInfos<INativeTextTrackData>): Observable<void>;
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
    private _removeData;
}

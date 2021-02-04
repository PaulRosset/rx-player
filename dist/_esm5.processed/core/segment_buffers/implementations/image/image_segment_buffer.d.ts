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
import { IBifThumbnail } from "../../../../parsers/images/bif";
import { IEndOfSegmentInfos, IPushChunkInfos, SegmentBuffer } from "../types";
import ManualTimeRanges from "../utils/manual_time_ranges";
/** Format of the data pushed to the `ImageSegmentBuffer`. */
export interface IImageTrackSegmentData {
    /** Image track data, in the given type */
    data: IBifThumbnail[];
    /** The type of the data (example: "bif") */
    type: string;
    /** End time until which the segment apply */
    end: number;
    /** Start time from which the segment apply */
    start: number;
    /** Timescale to convert the start and end into seconds */
    timescale: number;
}
/**
 * Image SegmentBuffer implementation.
 * @class ImageSegmentBuffer
 */
export default class ImageSegmentBuffer extends SegmentBuffer<IImageTrackSegmentData> {
    readonly bufferType: "image";
    private _buffered;
    constructor();
    /**
     * @param {Object} data
     */
    pushChunk(infos: IPushChunkInfos<IImageTrackSegmentData>): Observable<void>;
    /**
     * @param {Number} from
     * @param {Number} to
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
}

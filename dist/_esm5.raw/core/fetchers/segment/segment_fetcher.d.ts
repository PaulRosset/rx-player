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
import { Observable, Subject } from "rxjs";
import { ISegmentParserResponse, ITransportPipelines } from "../../../transports";
import { IABRMetricsEvent, IABRRequestBeginEvent, IABRRequestEndEvent, IABRRequestProgressEvent } from "../../abr";
import { IBufferType } from "../../source_buffers";
import { IBackoffOptions } from "../utils/try_urls_with_backoff";
import { ISegmentLoaderContent, ISegmentLoaderWarning } from "./create_segment_loader";
/**
 * Event sent when the segment request needs to be renewed (e.g. due to an HTTP
 * error).
 */
export declare type ISegmentFetcherWarning = ISegmentLoaderWarning;
/**
 * Event sent when a new "chunk" of the segment is available.
 * A segment can contain n chunk(s) for n >= 0.
 */
export interface ISegmentFetcherChunkEvent<T> {
    type: "chunk";
    /** Parse the downloaded chunk. */
    parse: (initTimescale?: number) => Observable<ISegmentParserResponse<T>>;
}
/**
 * Event sent when all "chunk" of the segments have been communicated through
 * `ISegmentFetcherChunkEvent` events.
 */
export interface ISegmentFetcherChunkCompleteEvent {
    type: "chunk-complete";
}
/** Event sent by the SegmentFetcher when fetching a segment. */
export declare type ISegmentFetcherEvent<T> = ISegmentFetcherChunkCompleteEvent | ISegmentFetcherChunkEvent<T> | ISegmentFetcherWarning;
export declare type ISegmentFetcher<T> = (content: ISegmentLoaderContent) => Observable<ISegmentFetcherEvent<T>>;
/**
 * Create a function which will fetch and parse segments.
 * @param {string} bufferType
 * @param {Object} transport
 * @param {Subject} requests$
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentFetcher<T>(bufferType: IBufferType, transport: ITransportPipelines, requests$: Subject<IABRMetricsEvent | IABRRequestBeginEvent | IABRRequestProgressEvent | IABRRequestEndEvent>, options: IBackoffOptions): ISegmentFetcher<T>;

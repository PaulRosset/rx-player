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
import { ICustomError } from "../../../errors";
import Manifest, { Adaptation, ISegment, Period, Representation } from "../../../manifest";
import { ILoaderDataLoadedValue, ILoaderProgressEvent, ISegmentLoaderArguments, ISegmentLoaderEvent as ITransportSegmentLoaderEvent } from "../../../transports";
import { IABRMetricsEvent } from "../../abr";
import { IBackoffOptions } from "../utils/try_urls_with_backoff";
/** An Error happened while loading (usually a request error). */
export interface ISegmentLoaderWarning {
    type: "warning";
    value: ICustomError;
}
/** The request begins to be done. */
export interface ISegmentLoaderRequest {
    type: "request";
    value: ISegmentLoaderArguments;
}
/** The whole segment's data (not only a chunk) is available. */
export interface ISegmentLoaderData<T> {
    type: "data";
    value: {
        responseData: T;
    };
}
/**
 * A chunk of the data is available.
 * You will receive every chunk through such events until a
 * ISegmentLoaderChunkComplete event is received.
 */
export interface ISegmentLoaderChunk {
    type: "chunk";
    value: {
        responseData: null | ArrayBuffer | Uint8Array;
    };
}
/** The data has been entirely sent through "chunk" events. */
export interface ISegmentLoaderChunkComplete {
    type: "chunk-complete";
    value: null;
}
/**
 * Every events the segment loader emits.
 * Type parameters: T: Argument given to the loader
 *                  U: ResponseType of the request
 */
export declare type ISegmentLoaderEvent<T> = ISegmentLoaderData<T> | ISegmentLoaderRequest | ILoaderProgressEvent | ISegmentLoaderWarning | ISegmentLoaderChunk | ISegmentLoaderChunkComplete | IABRMetricsEvent;
/** Cache implementation to avoid re-requesting segment */
export interface ISegmentLoaderCache<T> {
    /** Add a segment to the cache. */
    add: (obj: ISegmentLoaderContent, arg: ILoaderDataLoadedValue<T>) => void;
    /** Retrieve a segment from the cache */
    get: (obj: ISegmentLoaderContent) => ILoaderDataLoadedValue<T> | null;
}
/** Abstraction to load a segment in the current transport protocol. */
export declare type ISegmentPipelineLoader<T> = (x: ISegmentLoaderArguments) => Observable<ITransportSegmentLoaderEvent<T>>;
/** Content used by the segment loader as a context to load a new segment. */
export interface ISegmentLoaderContent {
    manifest: Manifest;
    period: Period;
    adaptation: Adaptation;
    representation: Representation;
    segment: ISegment;
}
/**
 * Returns a function allowing to load any wanted segment.
 *
 * The function returned takes in argument information about the wanted segment
 * and returns an Observable which will emit various events related to the
 * segment request (see ISegmentLoaderEvent).
 *
 * This observable will throw if, following the options given, the request and
 * possible retry all failed.
 *
 * This observable will complete after emitting all the segment's data.
 *
 * Type parameters:
 *   - T: type of the data emitted
 *
 * @param {Function} loader
 * @param {Object | undefined} cache
 * @param {Object} options
 * @returns {Function}
 */
export default function createSegmentLoader<T>(loader: ISegmentPipelineLoader<T>, cache: ISegmentLoaderCache<T> | undefined, backoffOptions: IBackoffOptions): (x: ISegmentLoaderContent) => Observable<ISegmentLoaderEvent<T>>;

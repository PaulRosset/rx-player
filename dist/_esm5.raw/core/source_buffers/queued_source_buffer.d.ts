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
import { ICustomSourceBuffer } from "../../compat";
import { ManualTimeRanges } from "../../custom_source_buffers";
import { Adaptation, ISegment, Period, Representation } from "../../manifest";
import { IBufferedChunk } from "./segment_inventory";
/** Every QueuedSourceBuffer types. */
export declare type IBufferType = "audio" | "video" | "text" | "image";
/**
 * Content of the `data` property when pushing a new chunk
 * This will contain all necessary information to decode the media data.
 * Type parameter `T` is the format of the chunk's data.
 */
export interface IPushedChunkData<T> {
    /**
     * The whole initialization segment's data related to the chunk you want to
     * push.
     * `null` if none.
     */
    initSegment: T | null;
    /**
     * Chunk you want to push.
     * This can be the whole decodable segment's data or just a decodable sub-part
     * of it.
     * `null` if you just want to push the initialization segment.
     */
    chunk: T | null;
    /**
     * String corresponding to the mime-type + codec to set the underlying
     * SourceBuffer to.
     * This is then used in "native" SourceBuffers to infer the right codec to use.
     */
    codec: string;
    /**
     * Time offset in seconds to apply to this segment.
     * A `timestampOffset` set to `5` will mean that the segment will be decoded
     * 5 seconds after its decode time which was found from the segment data
     * itself.
     */
    timestampOffset: number;
    /**
     * Append windows for the segment. This is a tuple of two elements.
     *
     * The first indicates the "start append window". The media data of that
     * segment that should have been decoded BEFORE that time (after taking the
     * `timestampOffset` property in consideration) will be ignored.
     * This can be set to `0` or `undefined` to not apply any start append window
     * to that chunk.
     *
     * The second indicates the "end append window". The media data of that
     * segment that should have been decoded AFTER that time (after taking the
     * `timestampOffset` property in consideration) will be ignored.
     * This can be set to `0` or `undefined` to not apply any end append window
     * to that chunk.
     */
    appendWindow: [number | undefined, number | undefined];
}
/**
 * Content of the `inventoryInfos` property when pushing a new chunk
 * This data will only be needed for inventory purposes in the QueuedSourceBuffer.
 */
export interface IPushedChunkInventoryInfos {
    /** Adaptation object linked to the chunk. */
    adaptation: Adaptation;
    /** Period object linked to the chunk. */
    period: Period;
    /** Representation object linked to the chunk. */
    representation: Representation;
    /** The segment object linked to the pushed chunk. */
    segment: ISegment;
    /**
     * Estimated precize start time, in seconds, the chunk starts at when decoded
     * (this should include any possible `timestampOffset` value.
     */
    estimatedStart?: number;
    /**
     * Estimated precize difference, in seconds, between the last decodable
     * and the first decodable position in the chunk.
     * (this should include any possible `timestampOffset` value.
     */
    estimatedDuration?: number;
}
/**
 * Information to give when pushing a new chunk via the `pushChunk` method.
 * Type parameter `T` is the format of the chunk's data.
 */
export interface IPushChunkInfos<T> {
    data: IPushedChunkData<T>;
    inventoryInfos: IPushedChunkInventoryInfos;
}
/**
 * Information to give when indicating a whole segment has been pushed via the
 * `endOfSegment` method.
 */
export interface IEndOfSegmentInfos {
    /** Adaptation object linked to the chunk. */
    adaptation: Adaptation;
    /** Period object linked to the chunk. */
    period: Period;
    /** Representation object linked to the chunk. */
    representation: Representation;
    /** The segment object linked to the pushed chunk. */
    segment: ISegment;
}
/**
 * Allows to push and remove new Segments to a SourceBuffer in a FIFO queue (not
 * doing so can lead to browser Errors) while keeping an inventory of what has
 * been pushed.
 *
 * To work correctly, only a single QueuedSourceBuffer per SourceBuffer should
 * be created.
 *
 * @class QueuedSourceBuffer
 */
export default class QueuedSourceBuffer<T> {
    /** "Type" of the buffer (e.g. "audio", "video", "text", "image"). */
    readonly bufferType: IBufferType;
    /** SourceBuffer implementation. */
    private readonly _sourceBuffer;
    /** Inventory of buffered segments. */
    private readonly _segmentInventory;
    /**
     * Subject triggered when this QueuedSourceBuffer is disposed.
     * Helps to clean-up Observables created at its creation.
     */
    private _destroy$;
    /**
     * Queue of awaited buffer "actions".
     * The first element in this array will be the first performed.
     */
    private _queue;
    /**
     * Information about the current action processed by the QueuedSourceBuffer.
     * If equal to null, it means that no action from the queue is currently
     * being processed.
     */
    private _pendingTask;
    /** Keep track of the latest init segment pushed in the linked SourceBuffer. */
    private _lastInitSegment;
    /**
     * Current `type` of the underlying SourceBuffer.
     * Might be changed for codec-switching purposes.
     */
    private _currentCodec;
    /**
     * Public access to the SourceBuffer's current codec.
     * @returns {string}
     */
    get codec(): string;
    /**
     * @constructor
     * @param {string} bufferType
     * @param {string} codec
     * @param {SourceBuffer} sourceBuffer
     */
    constructor(bufferType: IBufferType, codec: string, sourceBuffer: ICustomSourceBuffer<T>);
    /**
     * Push a chunk of the media segment given to the attached SourceBuffer, in a
     * FIFO queue.
     *
     * Once all chunks of a single Segment have been given to `pushChunk`, you
     * should call `endOfSegment` to indicate that the whole Segment has been
     * pushed.
     *
     * Depending on the type of data appended, this might need an associated
     * initialization segment.
     *
     * Such initialization segment will be pushed in the SourceBuffer if the
     * last segment pushed was associated to another initialization segment.
     * This detection is entirely reference-based so make sure that the same
     * initSegment argument given share the same reference.
     *
     * You can disable the usage of initialization segment by setting the
     * `infos.data.initSegment` argument to null.
     *
     * You can also only push an initialization segment by setting the
     * `infos.data.chunk` argument to null.
     *
     * @param {Object} infos
     * @returns {Observable}
     */
    pushChunk(infos: IPushChunkInfos<T>): Observable<void>;
    /**
     * Remove buffered data (added to the same FIFO queue than `pushChunk`).
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
    endOfSegment(infos: IEndOfSegmentInfos): Observable<void>;
    /**
     * The maintained inventory can fall out of sync from garbage collection or
     * other events.
     *
     * This methods allow to manually trigger a synchronization. It should be
     * called before retrieving Segment information from it (e.g. with
     * `getInventory`).
     */
    synchronizeInventory(): void;
    /**
     * Returns the currently buffered data, in a TimeRanges object.
     * @returns {TimeRanges}
     */
    getBufferedRanges(): TimeRanges | ManualTimeRanges;
    /**
     * Returns the currently buffered data for which the content is known with
     * the corresponding content information.
     * /!\ This data can fall out of sync with the real buffered ranges. Please
     * call `synchronizeInventory` before to make sure it is correctly
     * synchronized.
     * @returns {Array.<Object>}
     */
    getInventory(): IBufferedChunk[];
    /**
     * Dispose of the resources used by this QueuedSourceBuffer.
     *
     * /!\ You won't be able to use the QueuedSourceBuffer after calling this
     * function.
     * @private
     */
    dispose(): void;
    /**
     * Abort the linked SourceBuffer.
     * You should call this only if the linked MediaSource is still "open".
     *
     * /!\ You won't be able to use the QueuedSourceBuffer after calling this
     * function.
     * @private
     */
    abort(): void;
    /**
     * @private
     * @param {Event} error
     */
    private _onError;
    /**
     * When the returned observable is subscribed:
     *   1. Add your action to the queue.
     *   2. Begin the queue if not pending.
     *
     * Cancel queued action on unsubscription.
     * @private
     * @param {Object} action
     * @returns {Observable}
     */
    private _addToQueue;
    /**
     * Perform next task if one.
     * @private
     */
    private _flush;
    /**
     * Push given data to the underlying SourceBuffer.
     * /!\ Heavily mutates the private state.
     * @param {Object} task
     */
    private _pushSegmentData;
}
export { IBufferedChunk };

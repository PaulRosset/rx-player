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
import { IEndOfSegmentInfos, IPushChunkInfos, ISBOperation, SegmentBuffer } from "../types";
/**
 * Allows to push and remove new segments to a SourceBuffer in a FIFO queue (not
 * doing so can lead to browser Errors) while keeping an inventory of what has
 * been pushed and what is being pushed.
 *
 * To work correctly, only a single AudioVideoSegmentBuffer per SourceBuffer
 * should be created.
 *
 * @class AudioVideoSegmentBuffer
 */
export default class AudioVideoSegmentBuffer extends SegmentBuffer<BufferSource> {
    /** "Type" of the buffer concerned. */
    readonly bufferType: "audio" | "video";
    /** SourceBuffer implementation. */
    private readonly _sourceBuffer;
    /**
     * Subject triggered when this AudioVideoSegmentBuffer is disposed.
     * Helps to clean-up Observables created at its creation.
     */
    private _destroy$;
    /**
     * Queue of awaited buffer "operations".
     * The first element in this array will be the first performed.
     */
    private _queue;
    /** MediaSource on which the SourceBuffer object is attached. */
    private readonly _mediaSource;
    /**
     * Information about the current operation processed by the
     * AudioVideoSegmentBuffer.
     * If equal to null, it means that no operation from the queue is currently
     * being processed.
     */
    private _pendingTask;
    /**
     * Keep track of the of the latest init segment pushed in the linked
     * SourceBuffer.
     *
     * This allows to be sure the right initialization segment is pushed before
     * any chunk is.
     *
     * `null` if no initialization segment have been pushed to the
     * `AudioVideoSegmentBuffer` yet.
     */
    private _lastInitSegment;
    /**
     * @constructor
     * @param {string} bufferType
     * @param {string} codec
     * @param {SourceBuffer} sourceBuffer
     */
    constructor(bufferType: "audio" | "video", codec: string, mediaSource: MediaSource);
    /**
     * Push a chunk of the media segment given to the attached SourceBuffer, in a
     * FIFO queue.
     *
     * Once all chunks of a single Segment have been given to `pushChunk`, you
     * should call `endOfSegment` to indicate that the whole Segment has been
     * pushed.
     *
     * Depending on the type of data appended, the pushed chunk might rely on an
     * initialization segment, given through the `data.initSegment` property.
     *
     * Such initialization segment will be first pushed to the SourceBuffer if the
     * last pushed segment was associated to another initialization segment.
     * This detection rely on the initialization segment's reference so you need
     * to avoid mutating in-place a initialization segment given to that function
     * (to avoid having two different values which have the same reference).
     *
     * If you don't need any initialization segment to push the wanted chunk, you
     * can just set `data.initSegment` to `null`.
     *
     * You can also only push an initialization segment by setting the
     * `data.chunk` argument to null.
     *
     * @param {Object} infos
     * @returns {Observable}
     */
    pushChunk(infos: IPushChunkInfos<BufferSource>): Observable<void>;
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
     * Returns the currently buffered data, in a TimeRanges object.
     * @returns {TimeRanges}
     */
    getBufferedRanges(): TimeRanges;
    /**
     * Returns the list of every operations that the `AudioVideoSegmentBuffer` is
     * still processing. From the one with the highest priority (like the one
     * being processed)
     * @returns {Array.<Object>}
     */
    getPendingOperations(): Array<ISBOperation<BufferSource>>;
    /**
     * Dispose of the resources used by this AudioVideoSegmentBuffer.
     *
     * /!\ You won't be able to use the AudioVideoSegmentBuffer after calling this
     * function.
     * @private
     */
    dispose(): void;
    /**
     * Called when an error arised that made the current task fail.
     * @param {Event} error
     */
    private _onPendingTaskError;
    /**
     * When the returned observable is subscribed:
     *   1. Add your operation to the queue.
     *   2. Begin the queue if not pending.
     *
     * Cancel queued operation on unsubscription.
     * @private
     * @param {Object} operation
     * @returns {Observable}
     */
    private _addToQueue;
    /**
     * Perform next task if one.
     * @private
     */
    private _flush;
    /**
     * A push Operation might necessitate to mutate some `SourceBuffer` and/or
     * `AudioVideoSegmentBuffer` properties and also might need to be divided into
     * multiple segments to push (exemple: when first pushing the initialization
     * data before the segment data).
     *
     * This method allows to "prepare" that push operation so that all is left is
     * to push the returned segment data one after the other (from first to last).
     * @param {Object} item
     * @returns {Object}
     */
    private _preparePushOperation;
    /**
     * Return `true` if the given `segmentData` is the same segment than the last
     * initialization segment pushed to the `AudioVideoSegmentBuffer`.
     * @param {BufferSource} segmentData
     * @returns {boolean}
     */
    private _isLastInitSegment;
}

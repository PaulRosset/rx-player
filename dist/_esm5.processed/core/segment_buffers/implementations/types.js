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
import SegmentInventory from "../segment_inventory";
/**
 * Class allowing to push segments and remove data to a buffer to be able
 * to decode them in the future as well as retrieving information about which
 * segments have already been pushed.
 *
 * A `SegmentBuffer` can rely on a browser's SourceBuffer as well as being
 * entirely defined in the code.
 *
 * A SegmentBuffer is associated to a given "bufferType" (e.g. "audio",
 * "video", "text") and allows to push segments as well as removing part of
 * already-pushed segments for that type.
 *
 * Because a segment can be divided into multiple chunks, one should call the
 * `endOfSegment` method once all chunks of a given segment have been pushed
 * (through the `pushChunk` method) to validate that a segment has been
 * completely pushed.
 * It is expected to push chunks from only one segment at a time before calling
 * the `endOfSegment` function for that segment. Pushing chunks from multiple
 * segments in parallel could have unexpected result depending on the underlying
 * implementation.
 * TODO reflect that in the API?
 *
 * A SegmentBuffer also maintains an "inventory", which is the current
 * list of segments contained in the underlying buffer.
 * This inventory has to be manually "synchronized" (through the
 * `synchronizeInventory` method) before being retrieved (through the
 * `getInventory` method).
 *
 * Also depending on the underlying implementation, the various operations
 * performed on a `SegmentBuffer` (push/remove/endOfSegment) can happen
 * synchronously or asynchronously.
 * In the latter case, such operations are put in a FIFO Queue.
 * You can retrieve the current queue of operations by calling the
 * `getPendingOperations` method.
 * If operations happens synchronously, this method will just return an empty
 * array.
 */
var SegmentBuffer = /** @class */ (function () {
    function SegmentBuffer() {
        // Use SegmentInventory by default for inventory purposes
        this._segmentInventory = new SegmentInventory();
    }
    /**
     * The maintained inventory can fall out of sync from garbage collection or
     * other events.
     *
     * This methods allow to manually trigger a synchronization. It should be
     * called before retrieving Segment information from it (e.g. with
     * `getInventory`).
     */
    SegmentBuffer.prototype.synchronizeInventory = function () {
        // The default implementation just use the SegmentInventory
        this._segmentInventory.synchronizeBuffered(this.getBufferedRanges());
    };
    /**
     * Returns the currently buffered data for which the content is known with
     * the corresponding content information.
     * /!\ This data can fall out of sync with the real buffered ranges. Please
     * call `synchronizeInventory` before to make sure it is correctly
     * synchronized.
     * @returns {Array.<Object>}
     */
    SegmentBuffer.prototype.getInventory = function () {
        // The default implementation just use the SegmentInventory
        return this._segmentInventory.getInventory();
    };
    /**
     * Returns the list of every operations that the `SegmentBuffer` is still
     * processing. From the one with the highest priority (like the one being
     * processed)
     * @returns {Array.<Object>}
     */
    SegmentBuffer.prototype.getPendingOperations = function () {
        // Return no pending operation by default (for synchronous SegmentBuffers)
        return [];
    };
    return SegmentBuffer;
}());
export { SegmentBuffer };
/**
 * Enum used by a SegmentBuffer as a discriminant in its queue of
 * "operations".
 */
export var SegmentBufferOperation;
(function (SegmentBufferOperation) {
    SegmentBufferOperation[SegmentBufferOperation["Push"] = 0] = "Push";
    SegmentBufferOperation[SegmentBufferOperation["Remove"] = 1] = "Remove";
    SegmentBufferOperation[SegmentBufferOperation["EndOfSegment"] = 2] = "EndOfSegment";
})(SegmentBufferOperation || (SegmentBufferOperation = {}));

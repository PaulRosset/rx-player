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
import { Adaptation, ISegment, Period, Representation } from "../../manifest";
/** Content information for a single buffered chunk */
interface IBufferedChunkInfos {
    /** Adaptation this chunk is related to. */
    adaptation: Adaptation;
    /** Period this chunk is related to. */
    period: Period;
    /** Representation this chunk is related to. */
    representation: Representation;
    /** Segment this chunk is related to. */
    segment: ISegment;
}
/** Information stored on a single chunk by the SegmentInventory. */
export interface IBufferedChunk {
    /**
     * Last inferred end in the media buffer this chunk ends at, in seconds.
     *
     * Depending on if contiguous chunks were around it during the first
     * synchronization for that chunk this value could be more or less precize.
     */
    bufferedEnd: number | undefined;
    /**
     * Last inferred start in the media buffer this chunk starts at, in seconds.
     *
     * Depending on if contiguous chunks were around it during the first
     * synchronization for that chunk this value could be more or less precize.
     */
    bufferedStart: number | undefined;
    /**
     * Supposed end, in seconds, the chunk is expected to end at.
     *
     * It can correspond either to the end of the chunk or to the end of the whole
     * segment the chunk is linked to. This should not matter as chunks linked to
     * the same segment will all be merged once all chunks have been pushed and
     * the `completeSegment` API call is done. Until then, this property should
     * not be relied on.
     *
     * You can know whether the `completeSegment` API has been called by checking
     * the `partiallyPushed` property.
     */
    end: number;
    /**
     * If `true` the `end` property is an estimate the `SegmentInventory` has
     * a high confidence in.
     * In that situation, `bufferedEnd` can easily be compared to it to check if
     * that segment has been partially, or fully, garbage collected.
     *
     * If `false`, it is just a guess based on segment information.
     */
    precizeEnd: boolean;
    /**
     * If `true` the `start` property is an estimate the `SegmentInventory` has
     * a high confidence in.
     * In that situation, `bufferedStart` can easily be compared to it to check if
     * that segment has been partially, or fully, garbage collected.
     *
     * If `false`, it is just a guess based on segment information.
     */
    precizeStart: boolean;
    /** Information on what that chunk actually contains. */
    infos: IBufferedChunkInfos;
    /**
     * If `true`, this chunk is only a partial chunk of a whole segment.
     * In this condition, `start` and `end` may be ignored, as they may either
     * refer to the chunk or to the whole segment.
     *
     * Inversely, if `false`, this chunk is a whole segment whose inner chunks
     * have all been fully pushed.
     * In that condition, the `start` and `end` properties refer to that fully
     * pushed segment.
     */
    partiallyPushed: boolean;
    /**
     * Supposed start, in seconds, the chunk is expected to start at.
     *
     * It can correspond either to the start of the chunk or to the start of the
     * whole segment the chunk is linked to. This should not matter as chunks
     * linked to the same segment will all be merged once all chunks have been
     * pushed and the `completeSegment` API call is done. Until then, this
     * property should not be relied on.
     *
     * You can know whether the `completeSegment` API has been called by checking
     * the `partiallyPushed` property.
     */
    start: number;
}
/** information to provide when "inserting" a new chunk into the SegmentInventory. */
export interface IInsertedChunkInfos {
    /** The Adaptation that chunk is linked to */
    adaptation: Adaptation;
    /** The Period that chunk is linked to */
    period: Period;
    /** The Representation that chunk is linked to. */
    representation: Representation;
    /** The Segment that chunk is linked to. */
    segment: ISegment;
    /**
     * Start time, in seconds, this chunk most probably begins from after being
     * pushed.
     * In doubt, you can set it at the start of the whole segment (after
     * considering the possible offsets and append windows).
     */
    start: number;
    /**
     * End time, in seconds, this chunk most probably ends at after being
     * pushed.
     *
     * In doubt, you can set it at the end of the whole segment (after
     * considering the possible offsets and append windows).
     */
    end: number;
}
/**
 * Keep track of every chunk downloaded and currently in the linked media
 * buffer.
 *
 * The main point of this class is to know which chunks are already pushed to
 * the corresponding media buffer, at which bitrate, and which have been garbage-collected
 * since by the browser (and thus may need to be re-loaded).
 * @class SegmentInventory
 */
export default class SegmentInventory {
    /**
     * Keeps track of all the segments which should be currently in the browser's
     * memory.
     * This array contains objects, each being related to a single downloaded
     * chunk or segment which is at least partially added in the media buffer.
     */
    private _inventory;
    constructor();
    /**
     * Reset the whole inventory.
     */
    reset(): void;
    /**
     * Infer each segment's bufferedStart and bufferedEnd from the TimeRanges
     * given.
     *
     * The TimeRanges object given should come from the media buffer linked to
     * that SegmentInventory.
     *
     * /!\ A SegmentInventory should not be associated to multiple media buffers
     * at a time, so each `synchronizeBuffered` call should be given a TimeRanges
     * coming from the same buffer.
     * @param {TimeRanges}
     */
    synchronizeBuffered(buffered: TimeRanges): void;
    /**
     * Add a new chunk in the inventory.
     *
     * Chunks are decodable sub-parts of a whole segment. Once all chunks in a
     * segment have been inserted, you should call the `completeSegment` method.
     * @param {Object} chunkInformation
     */
    insertChunk({ period, adaptation, representation, segment, start, end }: IInsertedChunkInfos): void;
    /**
     * Indicate that inserted chunks can now be considered as a complete segment.
     * Take in argument the same content than what was given to `insertChunk` for
     * the corresponding chunks.
     * @param {Object} content
     */
    completeSegment(content: {
        period: Period;
        adaptation: Adaptation;
        representation: Representation;
        segment: ISegment;
    }): void;
    /**
     * Returns the whole inventory.
     *
     * To get a list synchronized with what a media buffer actually has buffered
     * you might want to call `synchronizeBuffered` before calling this method.
     * @returns {Array.<Object>}
     */
    getInventory(): IBufferedChunk[];
}
export {};

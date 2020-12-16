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
import Manifest, { Adaptation, Period, Representation } from "../../../manifest";
import { IStalledStatus } from "../../api";
import { IPrioritizedSegmentFetcher } from "../../fetchers";
import { QueuedSourceBuffer } from "../../source_buffers";
import { IRepresentationStreamEvent } from "../types";
/** Object emitted by the Stream's clock$ at each tick. */
export interface IRepresentationStreamClockTick {
    /** The current position, in seconds the media element is in, in seconds. */
    currentTime: number;
    /**
     * Gap between the current position and the edge of a live content.
     * Not set for non-live contents.
     */
    liveGap?: number;
    /** If set, the player is currently stalled (blocked). */
    stalled: IStalledStatus | null;
    /**
     * Offset in seconds to add to `currentTime` to obtain the position we
     * actually want to download from.
     * This is mostly useful when starting to play a content, where `currentTime`
     * might still be equal to `0` but you actually want to download from a
     * starting position different from `0`.
     */
    wantedTimeOffset: number;
}
/** Item emitted by the `terminate$` Observable given to a RepresentationStream. */
export interface ITerminationOrder {
    urgent: boolean;
}
/** Arguments to give to the RepresentationStream. */
export interface IRepresentationStreamArguments<T> {
    /** Periodically emits the current playback conditions. */
    clock$: Observable<IRepresentationStreamClockTick>;
    /** The context of the Representation you want to load. */
    content: {
        adaptation: Adaptation;
        manifest: Manifest;
        period: Period;
        representation: Representation;
    };
    /** The `QueuedSourceBuffer` on which segments will be pushed. */
    queuedSourceBuffer: QueuedSourceBuffer<T>;
    /** Interface used to load new segments. */
    segmentFetcher: IPrioritizedSegmentFetcher<T>;
    /**
     * Observable emitting when the RepresentationStream should "terminate".
     *
     * When this Observable emits, the RepresentationStream will begin a
     * "termination process": it will, depending on the type of termination
     * wanted, either stop immediately pending segment requests or wait until they
     * are finished before fully terminating (sending the
     * `IStreamTerminatingEvent` and then completing the `RepresentationStream`
     * Observable once the corresponding segments have been pushed).
     */
    terminate$: Observable<ITerminationOrder>;
    /**
     * The buffer size we have to reach in seconds (compared to the current
     * position. When that size is reached, no segments will be loaded until it
     * goes below that size again.
     */
    bufferGoal$: Observable<number>;
    /**
     * The last Representation's bitrate that was known to be "maintainable".
     * That is, that can be loaded faster that it can be played with the current
     * playback conditions (i.e. playback rate etc.).
     * This value will be used to decide when "fast-switching" (replacing
     * already-loaded segments by segments or higher quality) should be enforced
     * or not.
     */
    knownStableBitrate$: Observable<undefined | number>;
}
/**
 * Build up buffer for a single Representation.
 *
 * Download and push segments linked to the given Representation according
 * to what is already in the SourceBuffer and where the playback currently is.
 *
 * Multiple RepresentationStream observables can run on the same SourceBuffer.
 * This allows for example smooth transitions between multiple periods.
 *
 * @param {Object} args
 * @returns {Observable}
 */
export default function RepresentationStream<T>({ bufferGoal$, clock$, content, knownStableBitrate$, queuedSourceBuffer, segmentFetcher, terminate$, }: IRepresentationStreamArguments<T>): Observable<IRepresentationStreamEvent<T>>;

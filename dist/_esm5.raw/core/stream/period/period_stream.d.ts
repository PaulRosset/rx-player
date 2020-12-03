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
import { BehaviorSubject, Observable } from "rxjs";
import Manifest, { Period } from "../../../manifest";
import WeakMapMemory from "../../../utils/weak_map_memory";
import ABRManager from "../../abr";
import { IStalledStatus } from "../../api";
import { SegmentFetcherCreator } from "../../fetchers";
import SegmentBuffersStore, { IBufferType, ITextTrackSegmentBufferOptions, SegmentBuffer } from "../../segment_buffers";
import { IAdaptationStreamOptions } from "../adaptation";
import { IPeriodStreamEvent } from "../types";
export interface IPeriodStreamClockTick {
    position: number;
    getCurrentTime: () => number;
    duration: number;
    isPaused: boolean;
    liveGap?: number;
    readyState: number;
    speed: number;
    stalled: IStalledStatus | null;
    wantedTimeOffset: number;
}
export interface IPeriodStreamArguments {
    abrManager: ABRManager;
    bufferType: IBufferType;
    clock$: Observable<IPeriodStreamClockTick>;
    content: {
        manifest: Manifest;
        period: Period;
    };
    garbageCollectors: WeakMapMemory<SegmentBuffer<unknown>, Observable<never>>;
    segmentFetcherCreator: SegmentFetcherCreator<any>;
    segmentBuffersStore: SegmentBuffersStore;
    options: IPeriodStreamOptions;
    wantedBufferAhead$: BehaviorSubject<number>;
}
/** Options tweaking the behavior of the PeriodStream. */
export declare type IPeriodStreamOptions = IAdaptationStreamOptions & {
    textTrackOptions?: ITextTrackSegmentBufferOptions;
};
/**
 * Create single PeriodStream Observable:
 *   - Lazily create (or reuse) a SegmentBuffer for the given type.
 *   - Create a Stream linked to an Adaptation each time it changes, to
 *     download and append the corresponding segments to the SegmentBuffer.
 *   - Announce when the Stream is full or is awaiting new Segments through
 *     events
 * @param {Object} args
 * @returns {Observable}
 */
export default function PeriodStream({ abrManager, bufferType, clock$, content, garbageCollectors, segmentFetcherCreator, segmentBuffersStore, options, wantedBufferAhead$, }: IPeriodStreamArguments): Observable<IPeriodStreamEvent>;

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
import { Subject } from "rxjs";
import { ICustomError } from "../../errors";
import { Adaptation, ISegment, Period, Representation } from "../../manifest";
import { IBufferType } from "../source_buffers";
import { IActivePeriodChangedEvent, IAdaptationChangeEvent, IBitrateEstimationChangeEvent, ICompletedStreamEvent, IEndOfStreamEvent, INeedsDecipherabilityFlush, INeedsMediaSourceReload, IPeriodStreamClearedEvent, IPeriodStreamReadyEvent, IProtectedSegmentEvent, IRepresentationChangeEvent, IResumeStreamEvent, IStreamEventAddedSegment, IStreamManifestMightBeOutOfSync, IStreamNeedsDiscontinuitySeek, IStreamNeedsManifestRefresh, IStreamStateActive, IStreamStateFull, IStreamTerminatingEvent, IStreamWarningEvent } from "./types";
declare const EVENTS: {
    activeStream(bufferType: IBufferType): IStreamStateActive;
    activePeriodChanged(period: Period): IActivePeriodChangedEvent;
    adaptationChange(bufferType: IBufferType, adaptation: Adaptation | null, period: Period): IAdaptationChangeEvent;
    addedSegment<T>(content: {
        adaptation: Adaptation;
        period: Period;
        representation: Representation;
    }, segment: ISegment, buffered: TimeRanges, segmentData: T): IStreamEventAddedSegment<T>;
    bitrateEstimationChange(type: IBufferType, bitrate: number | undefined): IBitrateEstimationChangeEvent;
    streamComplete(bufferType: IBufferType): ICompletedStreamEvent;
    discontinuityEncountered(gap: [number, number], bufferType: IBufferType): IStreamNeedsDiscontinuitySeek;
    endOfStream(): IEndOfStreamEvent;
    fullStream(bufferType: IBufferType): IStreamStateFull;
    needsManifestRefresh(): IStreamNeedsManifestRefresh;
    manifestMightBeOufOfSync(): IStreamManifestMightBeOutOfSync;
    needsMediaSourceReload(period: Period, { currentTime, isPaused }: {
        currentTime: number;
        isPaused: boolean;
    }): INeedsMediaSourceReload;
    needsDecipherabilityFlush({ currentTime, isPaused, duration }: {
        currentTime: number;
        isPaused: boolean;
        duration: number;
    }): INeedsDecipherabilityFlush;
    periodStreamReady(type: IBufferType, period: Period, adaptation$: Subject<Adaptation | null>): IPeriodStreamReadyEvent;
    periodStreamCleared(type: IBufferType, period: Period): IPeriodStreamClearedEvent;
    protectedSegment(initDataInfo: {
        type: string;
        data: Uint8Array;
    }): IProtectedSegmentEvent;
    representationChange(type: IBufferType, period: Period, representation: Representation): IRepresentationChangeEvent;
    streamTerminating(): IStreamTerminatingEvent;
    resumeStream(): IResumeStreamEvent;
    warning(value: ICustomError): IStreamWarningEvent;
};
export default EVENTS;

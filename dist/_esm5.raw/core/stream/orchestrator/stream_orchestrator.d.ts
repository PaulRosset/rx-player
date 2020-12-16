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
import ABRManager from "../../abr";
import { SegmentFetcherCreator } from "../../fetchers";
import SourceBuffersStore from "../../source_buffers";
import { IPeriodStreamClockTick } from "../period";
import { IPeriodStreamOptions } from "../period/period_stream";
import { IStreamOrchestratorEvent } from "../types";
export declare type IStreamOrchestratorClockTick = IPeriodStreamClockTick;
/**
 * Create and manage the various Stream Observables needed for the content to
 * play:
 *
 *   - Create or dispose SourceBuffers depending on the chosen Adaptations.
 *
 *   - Push the right segments to those SourceBuffers depending on the user's
 *     preferences, the current position, the bandwidth, the decryption
 *     conditions...
 *
 *   - Concatenate Streams for adaptation from separate Periods at the right
 *     time, to allow smooth transitions between periods.
 *
 *   - Emit various events to notify of its health and issues
 *
 * Here multiple Streams can be created at the same time to allow smooth
 * transitions between periods.
 * To do this, we dynamically create or destroy Streams as they are needed.
 * @param {Object} content
 * @param {Observable} clock$ - Emit position information
 * @param {Object} abrManager - Emit bitrate estimates and best Representation
 * to play.
 * @param {Object} sourceBuffersStore - Will be used to lazily create
 * SourceBuffer instances associated with the current content.
 * @param {Object} segmentFetcherCreator - Allow to download segments.
 * @param {Object} options
 * @returns {Observable}
 */
export default function StreamOrchestrator(content: {
    manifest: Manifest;
    initialPeriod: Period;
}, clock$: Observable<IStreamOrchestratorClockTick>, abrManager: ABRManager, sourceBuffersStore: SourceBuffersStore, segmentFetcherCreator: SegmentFetcherCreator<any>, options: {
    wantedBufferAhead$: BehaviorSubject<number>;
    maxBufferAhead$: Observable<number>;
    maxBufferBehind$: Observable<number>;
} & IPeriodStreamOptions): Observable<IStreamOrchestratorEvent>;

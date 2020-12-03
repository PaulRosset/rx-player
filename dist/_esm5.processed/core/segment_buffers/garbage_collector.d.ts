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
import { SegmentBuffer } from "./implementations";
export interface IGarbageCollectorArgument {
    /** SegmentBuffer implementation */
    segmentBuffer: SegmentBuffer<unknown>;
    /** Emit current position in seconds regularly */
    clock$: Observable<number>;
    /** Maximum time to keep behind current time position, in seconds */
    maxBufferBehind$: Observable<number>;
    /** Minimum time to keep behind current time position, in seconds */
    maxBufferAhead$: Observable<number>;
}
/**
 * Perform cleaning of the buffer according to the values set by the user
 * at each clock tick and each times the maxBufferBehind/maxBufferAhead values
 * change.
 *
 * @param {Object} opt
 * @returns {Observable}
 */
export default function BufferGarbageCollector({ segmentBuffer, clock$, maxBufferBehind$, maxBufferAhead$, }: IGarbageCollectorArgument): Observable<never>;

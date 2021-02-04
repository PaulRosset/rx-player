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
import { combineLatest as observableCombineLatest, of as observableOf, } from "rxjs";
import { mergeMap } from "rxjs/operators";
import log from "../../../log";
/**
 * Create empty AdaptationStream Observable, linked to a Period.
 *
 * This observable will never download any segment and just emit a "full"
 * event when reaching the end.
 * @param {Observable} streamClock$
 * @param {Observable} wantedBufferAhead$
 * @param {string} bufferType
 * @param {Object} content
 * @returns {Observable}
 */
export default function createEmptyAdaptationStream(streamClock$, wantedBufferAhead$, bufferType, content) {
    var period = content.period;
    var hasFinishedLoading = false;
    return observableCombineLatest([streamClock$, wantedBufferAhead$]).pipe(mergeMap(function (_a) {
        var clockTick = _a[0], wantedBufferAhead = _a[1];
        var position = clockTick.position;
        if (period.end !== undefined && position + wantedBufferAhead >= period.end) {
            log.debug("Stream: full \"empty\" AdaptationStream", bufferType);
            hasFinishedLoading = true;
        }
        return observableOf({ type: "stream-status",
            value: { period: period,
                bufferType: bufferType, position: clockTick.position,
                imminentDiscontinuity: null, hasFinishedLoading: hasFinishedLoading, neededSegments: [],
                shouldRefreshManifest: false } });
    }));
}

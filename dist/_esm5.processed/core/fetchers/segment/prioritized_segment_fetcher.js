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
import { map } from "rxjs/operators";
import log from "../../../log";
/**
 * This function basically put in relation:
 *   - a SegmentFetcher, which will be used to perform the segment request
 *   - a prioritizer, which will handle the priority of a segment request
 *
 * and returns functions to fetch segments with a given priority.
 * @param {Object} prioritizer
 * @param {Object} fetcher
 * @returns {Object}
 */
export default function applyPrioritizerToSegmentFetcher(prioritizer, fetcher) {
    /**
     * The Observables returned by `createRequest` are not exactly the same than
     * the one created by the `ObservablePrioritizer`. Because we still have to
     * keep a handle on that value.
     */
    var taskHandlers = new WeakMap();
    return {
        /**
         * Create a Segment request with a given priority.
         * @param {Object} content - content to request
         * @param {Number} priority - priority at which the content should be requested.
         * Lower number == higher priority.
         * @returns {Observable}
         */
        createRequest: function (content, priority) {
            if (priority === void 0) { priority = 0; }
            var task = prioritizer.create(fetcher(content), priority);
            var flattenTask = task.pipe(map(function (evt) {
                return evt.type === "data" ? evt.value :
                    evt;
            }));
            taskHandlers.set(flattenTask, task);
            return flattenTask;
        },
        /**
         * Update the priority of a pending request, created through
         * `createRequest`.
         * @param {Observable} observable - The Observable returned by `createRequest`.
         * @param {Number} priority - The new priority value.
         */
        updatePriority: function (observable, priority) {
            var correspondingTask = taskHandlers.get(observable);
            if (correspondingTask === undefined) {
                log.warn("Fetchers: Cannot update the priority of a request: task not found.");
                return;
            }
            prioritizer.updatePriority(correspondingTask, priority);
        },
    };
}

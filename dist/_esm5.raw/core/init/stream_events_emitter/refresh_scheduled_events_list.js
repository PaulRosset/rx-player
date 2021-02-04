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
import areSameStreamEvents from "./are_same_stream_events";
/**
 * Refresh local scheduled events list
 * @param {Array.<Object>} oldScheduledEvents
 * @param {Object} manifest
 * @returns {Array.<Object>}
 */
function refreshScheduledEventsList(oldScheduledEvents, manifest) {
    var scheduledEvents = [];
    var periods = manifest.periods;
    for (var i = 0; i < periods.length; i++) {
        var period = periods[i];
        var streamEvents = period.streamEvents;
        streamEvents.forEach(function (_a) {
            var start = _a.start, end = _a.end, id = _a.id, data = _a.data;
            for (var j = 0; j < oldScheduledEvents.length; j++) {
                var currentScheduledEvent = oldScheduledEvents[j];
                if (areSameStreamEvents(currentScheduledEvent, { id: id, start: start, end: end })) {
                    scheduledEvents.push(currentScheduledEvent);
                    return;
                }
            }
            if (end === undefined) {
                var newScheduledEvent = { start: start,
                    id: id,
                    data: data,
                    publicEvent: { start: start,
                        data: data } };
                scheduledEvents.push(newScheduledEvent);
            }
            else {
                var newScheduledEvent = { start: start,
                    end: end,
                    id: id,
                    data: data,
                    publicEvent: { start: start,
                        end: end,
                        data: data } };
                scheduledEvents.push(newScheduledEvent);
            }
        });
    }
    return scheduledEvents;
}
export default refreshScheduledEventsList;

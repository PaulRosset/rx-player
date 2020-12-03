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
import { IMultiplePeriodStreamsEvent } from "../types";
/**
 * Returns an Observable which emits ``true`` when all PeriodStreams given are
 * _complete_.
 * Returns false otherwise.
 *
 * A PeriodStream for a given type is considered _complete_ when both of these
 * conditions are true:
 *   - it is the last PeriodStream in the content for the given type
 *   - it has finished downloading segments (it is _full_)
 *
 * Simply put a _complete_ PeriodStream for a given type means that every
 * segments needed for this Stream have been downloaded.
 *
 * When the Observable returned here emits, every Stream are finished.
 * @param {...Observable} streams
 * @returns {Observable}
 */
export default function areStreamsComplete(...streams: Array<Observable<IMultiplePeriodStreamsEvent>>): Observable<boolean>;

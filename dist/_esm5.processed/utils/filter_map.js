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
import { defer as observableDefer, } from "rxjs";
import { filter, map, } from "rxjs/operators";
/**
 * Special kind of map which will ignore the result when the value emitted
 * corresponds to a given token.
 *
 * This can also be performed through a `mergeMap` (by returning the `EMPTY`
 * Observable when we want to ignore events) but using `filterMap` is both more
 * straightforward and more performant.
 * @param {function} callback
 * @param {*} filteringToken
 * @returns {function}
 */
export default function filterMap(callback, filteringToken) {
    return function (source) { return observableDefer(function () {
        return source.pipe(map(callback), filter(function (x) { return x !== filteringToken; }));
    }); };
}

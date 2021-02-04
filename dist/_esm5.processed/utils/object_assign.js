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
function objectAssign(target) {
    var sources = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        sources[_i - 1] = arguments[_i];
    }
    if (target === null || target === undefined) {
        throw new TypeError("Cannot convert undefined or null to object");
    }
    // eslint-disable-next-line  @typescript-eslint/no-unsafe-assignment
    var to = Object(target);
    for (var i = 0; i < sources.length; i++) {
        var source = sources[i];
        for (var key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                /* eslint-disable @typescript-eslint/no-unsafe-member-access */
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                to[key] = source[key];
                /* eslint-enable @typescript-eslint/no-unsafe-member-access */
            }
        }
    }
    return to;
}
// eslint-disable-next-line @typescript-eslint/unbound-method, no-restricted-properties
export default typeof Object.assign === "function" ?
    // eslint-disable-next-line no-restricted-properties
    Object.assign :
    // eslint-disable-next-line  @typescript-eslint/unbound-method
    objectAssign;

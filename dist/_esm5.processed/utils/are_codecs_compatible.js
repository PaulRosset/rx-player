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
import arrayFind from "./array_find";
import startsWith from "./starts_with";
/**
 * This function is a shortcut that helps differentiate two codecs
 * of the form "audio/mp4;codecs=\"av1.40.2\"".
 *
 * @param codecA
 * @param codecB
 * @returns A boolean that tell whether or not those two codecs provided are even.
 */
function areCodecsCompatible(a, b) {
    var _a = a.split(";"), mimeTypeA = _a[0], propsA = _a.slice(1);
    var _b = b.split(";"), mimeTypeB = _b[0], propsB = _b.slice(1);
    if (mimeTypeA !== mimeTypeB) {
        return false;
    }
    var codecsA = arrayFind(propsA, function (prop) { return startsWith(prop, "codecs="); });
    var codecsB = arrayFind(propsB, function (prop) { return startsWith(prop, "codecs="); });
    if (codecsA === undefined || codecsB === undefined) {
        return false;
    }
    var codecA = codecsA.substring(7);
    var codecB = codecsB.substring(7);
    if (codecA.split(".")[0] !== codecB.split(".")[0]) {
        return false;
    }
    return true;
}
export default areCodecsCompatible;

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
import parseTtml from "../parse_ttml";
import parseCue from "./parse_cue";
/**
 * @param str
 * @param timeOffset
 */
export default function parseTtmlToNative(str, timeOffset) {
    var parsedCues = parseTtml(str, timeOffset);
    var cues = [];
    for (var i = 0; i < parsedCues.length; i++) {
        var parsedCue = parsedCues[i];
        var cue = parseCue(parsedCue);
        if (cue !== null) {
            cues.push(cue);
        }
    }
    return cues;
}

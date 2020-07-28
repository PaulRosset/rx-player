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
/**
 * /!\ This file is feature-switchable.
 * It always should be imported through the `features` object.
 */
import { bytesToStr, le2toi, le4toi, } from "../../utils/byte_parsing";
/**
 * @param {UInt8Array} buf
 * @returns {Object}
 */
function parseBif(buf) {
    var pos = 0;
    var length = buf.length;
    var fileFormat = bytesToStr(buf.subarray(pos, pos + 8));
    pos += 8;
    if (fileFormat !== "\u0089BIF\r\n\u001a\n") {
        throw new Error("Invalid BIF file");
    }
    var minorVersion = buf[pos];
    pos += 1;
    var majorVersion = buf[pos];
    pos += 1;
    var patchVersion = buf[pos];
    pos += 1;
    var increVersion = buf[pos];
    pos += 1;
    var version = [minorVersion, majorVersion, patchVersion, increVersion].join(".");
    if (majorVersion > 0) {
        throw new Error("Unhandled version: " + majorVersion);
    }
    var imageCount = le4toi(buf, pos);
    pos += 4;
    var framewiseSeparation = le4toi(buf, pos);
    pos += 4;
    var format = bytesToStr(buf.subarray(pos, pos + 4));
    pos += 4;
    var width = le2toi(buf, pos);
    pos += 2;
    var height = le2toi(buf, pos);
    pos += 2;
    var aspectRatio = [buf[pos], buf[pos + 1]].join(":");
    pos += 2;
    var isVod = buf[pos] === 1;
    pos += 1;
    // bytes 0x1F to 0x40 is unused data for now
    pos = 0x40;
    var thumbs = [];
    if (imageCount === 0) {
        throw new Error("bif: no images to parse");
    }
    var index = 0;
    var previousImageInfo = null;
    while (pos < length) {
        var currentImageTimestamp = le4toi(buf, pos);
        pos += 4;
        var currentImageOffset = le4toi(buf, pos);
        pos += 4;
        if (previousImageInfo !== null) {
            // calculate for index-1
            var ts = previousImageInfo.timestamp * framewiseSeparation;
            var duration = framewiseSeparation;
            var data = buf.slice(previousImageInfo.offset, currentImageOffset);
            thumbs.push({ index: index, duration: duration, ts: ts, data: data });
            index++;
        }
        if (currentImageTimestamp === 0xFFFFFFFF) {
            break;
        }
        previousImageInfo = { timestamp: currentImageTimestamp,
            offset: currentImageOffset };
    }
    return { fileFormat: "BIF", version: version,
        imageCount: imageCount, timescale: 1000, format: format,
        width: width,
        height: height,
        aspectRatio: aspectRatio,
        isVod: isVod,
        thumbs: thumbs };
}
export default parseBif;

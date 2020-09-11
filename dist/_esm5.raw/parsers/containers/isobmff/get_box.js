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
import log from "../../../log";
import { be4toi, be8toi, } from "../../../utils/byte_parsing";
/**
 * Returns the content of a box based on its name.
 * `null` if not found.
 * /!\ does not work with UUID boxes
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box (e.g. 'sidx' or
 * 'moov'), hexa encoded
 * @returns {UInt8Array|null}
 */
function getBoxContent(buf, boxName) {
    var offsets = getBoxOffsets(buf, boxName);
    return offsets !== null ? buf.subarray(offsets[0] + 8, offsets[1]) :
        null;
}
/**
 * Returns an ISOBMFF box based on its name.
 * `null` if not found.
 * /!\ does not work with UUID boxes
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box (e.g. 'sidx' or
 * 'moov'), hexa encoded
 * @returns {UInt8Array|null}
 */
function getBox(buf, boxName) {
    var offsets = getBoxOffsets(buf, boxName);
    return offsets !== null ? buf.subarray(offsets[0], offsets[1]) :
        null;
}
/**
 * Returns start and end offset for a given box.
 * `null` if not found.
 * /!\ does not work with UUID boxes
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box (e.g. 'sidx' or
 * 'moov'), hexa encoded
 * @returns {Array.<number>|null}
 */
function getBoxOffsets(buf, boxName) {
    var l = buf.length;
    var i = 0;
    var name;
    var size = 0;
    while (i + 8 < l) {
        size = be4toi(buf, i);
        name = be4toi(buf, i + 4);
        if (size <= 0) {
            throw new Error("ISOBMFF: Size out of range");
        }
        if (name === boxName) {
            break;
        }
        else {
            i += size;
        }
    }
    if (i < l) {
        return [i, i + size];
    }
    else {
        return null;
    }
}
/**
 * Gives the content of a specific UUID with its attached ID
 * @param {Uint8Array} buf
 * @param {Number} id1
 * @param {Number} id2
 * @param {Number} id3
 * @param {Number} id4
 * @returns {Uint8Array|undefined}
 */
function getUuidContent(buf, id1, id2, id3, id4) {
    var len;
    var l = buf.length;
    for (var i = 0; i < l; i += len) {
        len = be4toi(buf, i);
        if (be4toi(buf, i + 4) === 0x75756964 /* === "uuid" */ &&
            be4toi(buf, i + 8) === id1 &&
            be4toi(buf, i + 12) === id2 &&
            be4toi(buf, i + 16) === id3 &&
            be4toi(buf, i + 20) === id4) {
            return buf.subarray(i + 24, i + len);
        }
    }
}
/**
 * For the next encountered box, return byte offsets corresponding to:
 *   1. the starting byte offset for the next box (should always be equal to
 *       `0`).
 *   2. The beginning of the box content - meaning the first byte after the
 *      size and the name of the box.
 *   3. The first byte after the end of the box, might be equal to `buf`'s
 *      length if we're considering the last box.
 *
 * `null` if no box is found.
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box as a 4 bit integer
 * generated from encoding the corresponding ASCII in big endian.
 */
function getNextBoxOffsets(buf) {
    var len = buf.length;
    if (len < 8) {
        log.warn("ISOBMFF: box inferior to 8 bytes, cannot find offsets");
        return null;
    }
    var lastOffset = 0;
    var boxSize = be4toi(buf, lastOffset);
    lastOffset += 4;
    var name = be4toi(buf, lastOffset);
    lastOffset += 4;
    if (boxSize === 0) {
        boxSize = len;
    }
    else if (boxSize === 1) {
        if (lastOffset + 8 > len) {
            log.warn("ISOBMFF: box too short, cannot find offsets");
            return null;
        }
        boxSize = be8toi(buf, lastOffset);
        lastOffset += 8;
    }
    if (boxSize < 0) {
        throw new Error("ISOBMFF: Size out of range");
    }
    if (name === 0x75756964 /* === "uuid" */) {
        lastOffset += 16; // Skip uuid name
    }
    return [0, lastOffset, boxSize];
}
export { getBox, getBoxContent, getBoxOffsets, getNextBoxOffsets, getUuidContent, };

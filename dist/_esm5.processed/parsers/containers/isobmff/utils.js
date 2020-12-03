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
import assert from "../../../utils/assert";
import { be2toi, be3toi, be4toi, be8toi, concat, itobe4, itobe8, } from "../../../utils/byte_parsing";
import { hexToBytes } from "../../../utils/string_parsing";
import { MAX_32_BIT_INT } from "./constants";
import { createBox } from "./create_box";
import { getPlayReadyKIDFromPrivateData } from "./drm";
import { getBoxContent, getBoxOffsets, } from "./get_box";
import { getMDIA, getTRAF, } from "./read";
/**
 * Parse the sidx part (segment index) of an ISOBMFF buffer and construct a
 * corresponding Array of available segments.
 *
 * Returns `null` if not found.
 * @param {Uint8Array} buf
 * @param {Number} sidxOffsetInWholeSegment
 * @returns {Object|null} {Array.<Object>} - Information about each subsegment.
 */
function getSegmentsFromSidx(buf, sidxOffsetInWholeSegment) {
    var sidxOffsets = getBoxOffsets(buf, 0x73696478 /* "sidx" */);
    if (sidxOffsets === null) {
        return null;
    }
    var offset = sidxOffsetInWholeSegment;
    var boxSize = sidxOffsets[2] - sidxOffsets[0];
    var cursor = sidxOffsets[1];
    /* version(8) */
    /* flags(24) */
    /* reference_ID(32); */
    /* timescale(32); */
    var version = buf[cursor];
    cursor += 4 + 4;
    var timescale = be4toi(buf, cursor);
    cursor += 4;
    /* earliest_presentation_time(32 / 64) */
    /* first_offset(32 / 64) */
    var time;
    if (version === 0) {
        time = be4toi(buf, cursor);
        cursor += 4;
        offset += be4toi(buf, cursor) + boxSize;
        cursor += 4;
    }
    else if (version === 1) {
        time = be8toi(buf, cursor);
        cursor += 8;
        offset += be8toi(buf, cursor) + boxSize;
        cursor += 8;
    }
    else {
        return null;
    }
    var segments = [];
    /* reserved(16) */
    /* reference_count(16) */
    cursor += 2;
    var count = be2toi(buf, cursor);
    cursor += 2;
    while (--count >= 0) {
        /* reference_type(1) */
        /* reference_size(31) */
        /* segment_duration(32) */
        /* sap..(32) */
        var refChunk = be4toi(buf, cursor);
        cursor += 4;
        var refType = (refChunk & 0x80000000) >>> 31;
        var refSize = (refChunk & 0x7FFFFFFF);
        // when set to 1 indicates that the reference is to a sidx, else to media
        if (refType === 1) {
            throw new Error("sidx with reference_type `1` not yet implemented");
        }
        var duration = be4toi(buf, cursor);
        cursor += 4;
        // let sapChunk = be4toi(buf, cursor + 8);
        cursor += 4;
        // TODO(pierre): handle sap
        // let startsWithSap = (sapChunk & 0x80000000) >>> 31;
        // let sapType = (sapChunk & 0x70000000) >>> 28;
        // let sapDelta = sapChunk & 0x0FFFFFFF;
        segments.push({ time: time,
            duration: duration, count: 0, timescale: timescale, range: [offset, offset + refSize - 1] });
        time += duration;
        offset += refSize;
    }
    return segments;
}
/**
 * Parse track Fragment Decode Time to get a precize initial time for this
 * segment (in the media timescale).
 *
 * Stops at the first tfdt encountered from the beginning of the file.
 * Returns this time.
 * `undefined` if not found.
 * @param {Uint8Array} buffer
 * @returns {Number | undefined}
 */
function getTrackFragmentDecodeTime(buffer) {
    var traf = getTRAF(buffer);
    if (traf === null) {
        return undefined;
    }
    var tfdt = getBoxContent(traf, 0x74666474 /* tfdt */);
    if (tfdt === null) {
        return undefined;
    }
    var version = tfdt[0];
    return version === 1 ? be8toi(tfdt, 4) :
        version === 0 ? be4toi(tfdt, 4) :
            undefined;
}
/**
 * Returns the "default sample duration" which is the default value for duration
 * of samples found in a "traf" ISOBMFF box.
 *
 * Returns `undefined` if no "default sample duration" has been found.
 * @param {Uint8Array} traf
 * @returns {number|undefined}
 */
function getDefaultDurationFromTFHDInTRAF(traf) {
    var tfhd = getBoxContent(traf, 0x74666864 /* tfhd */);
    if (tfhd === null) {
        return undefined;
    }
    var cursor = /* version */ 1;
    var flags = be3toi(tfhd, cursor);
    cursor += 3;
    var hasBaseDataOffset = (flags & 0x000001) > 0;
    var hasSampleDescriptionIndex = (flags & 0x000002) > 0;
    var hasDefaultSampleDuration = (flags & 0x000008) > 0;
    if (!hasDefaultSampleDuration) {
        return undefined;
    }
    cursor += 4;
    if (hasBaseDataOffset) {
        cursor += 8;
    }
    if (hasSampleDescriptionIndex) {
        cursor += 4;
    }
    var defaultDuration = be4toi(tfhd, cursor);
    return defaultDuration;
}
/**
 * Calculate segment duration approximation by additioning the duration from
 * every samples in a trun ISOBMFF box.
 *
 * Returns `undefined` if we could not parse the duration.
 * @param {Uint8Array} buffer
 * @returns {number | undefined}
 */
function getDurationFromTrun(buffer) {
    var traf = getTRAF(buffer);
    if (traf === null) {
        return undefined;
    }
    var trun = getBoxContent(traf, 0x7472756E /* trun */);
    if (trun === null) {
        return undefined;
    }
    var cursor = 0;
    var version = trun[cursor];
    cursor += 1;
    if (version > 1) {
        return undefined;
    }
    var flags = be3toi(trun, cursor);
    cursor += 3;
    var hasSampleDuration = (flags & 0x000100) > 0;
    var defaultDuration = 0;
    if (!hasSampleDuration) {
        defaultDuration = getDefaultDurationFromTFHDInTRAF(traf);
        if (defaultDuration === undefined) {
            return undefined;
        }
    }
    var hasDataOffset = (flags & 0x000001) > 0;
    var hasFirstSampleFlags = (flags & 0x000004) > 0;
    var hasSampleSize = (flags & 0x000200) > 0;
    var hasSampleFlags = (flags & 0x000400) > 0;
    var hasSampleCompositionOffset = (flags & 0x000800) > 0;
    var sampleCounts = be4toi(trun, cursor);
    cursor += 4;
    if (hasDataOffset) {
        cursor += 4;
    }
    if (hasFirstSampleFlags) {
        cursor += 4;
    }
    var i = sampleCounts;
    var duration = 0;
    while (i-- > 0) {
        if (hasSampleDuration) {
            duration += be4toi(trun, cursor);
            cursor += 4;
        }
        else {
            duration += defaultDuration;
        }
        if (hasSampleSize) {
            cursor += 4;
        }
        if (hasSampleFlags) {
            cursor += 4;
        }
        if (hasSampleCompositionOffset) {
            cursor += 4;
        }
    }
    return duration;
}
/**
 * Get timescale information from a movie header box. Found in init segments.
 * `undefined` if not found or not parsed.
 *
 * This timescale is the default timescale used for segments.
 * @param {Uint8Array} buffer
 * @returns {Number | undefined}
 */
function getMDHDTimescale(buffer) {
    var mdia = getMDIA(buffer);
    if (mdia === null) {
        return undefined;
    }
    var mdhd = getBoxContent(mdia, 0x6D646864 /* "mdhd" */);
    if (mdhd === null) {
        return undefined;
    }
    var cursor = 0;
    var version = mdhd[cursor];
    cursor += 4;
    return version === 1 ? be4toi(mdhd, cursor + 16) :
        version === 0 ? be4toi(mdhd, cursor + 8) :
            undefined;
}
/**
 * Creates a PSSH box with the given systemId and data.
 * @param {Array.<Object>} psshInfo
 * @returns {Uint8Array}
 */
function createPssh(_a) {
    var systemId = _a.systemId, privateData = _a.privateData;
    var _systemId = systemId.replace(/-/g, "");
    assert(_systemId.length === 32);
    return createBox("pssh", concat(4, // 4 initial zeroed bytes
    hexToBytes(_systemId), itobe4(privateData.length), privateData));
}
/**
 * Update ISOBMFF given to add a "pssh" box in the "moov" box for every content
 * protection in the psshList array given.
 * @param {Uint8Array} buf - the ISOBMFF file
 * @param {Array.<Object>} psshList
 * @returns {Uint8Array} - The new ISOBMFF generated.
 */
function patchPssh(buf, psshList) {
    if (psshList == null || psshList.length === 0) {
        return buf;
    }
    var moovOffsets = getBoxOffsets(buf, 0x6D6F6F76 /* = "moov" */);
    if (moovOffsets === null) {
        return buf;
    }
    var moov = buf.subarray(moovOffsets[0], moovOffsets[2]);
    var moovArr = [moov];
    for (var i = 0; i < psshList.length; i++) {
        moovArr.push(createPssh(psshList[i]));
    }
    var newmoov = updateBoxLength(concat.apply(void 0, moovArr));
    return concat(buf.subarray(0, moovOffsets[0]), newmoov, buf.subarray(moovOffsets[2]));
}
/**
 * Returns a new version of the given box with the size updated
 * so it reflects its actual size.
 *
 * You can use this function after modifying a ISOBMFF box so its size is
 * updated.
 *
 * /!\ Please consider that this function might mutate the given Uint8Array
 * in place or might create a new one, depending on the current conditions.
 * @param {Uint8Array} buf - The ISOBMFF box
 * @returns {Uint8Array}
 */
function updateBoxLength(buf) {
    var newLen = buf.length;
    if (newLen < 4) {
        throw new Error("Cannot update box length: box too short");
    }
    var oldSize = be4toi(buf, 0);
    if (oldSize === 0) {
        if (newLen > MAX_32_BIT_INT) {
            var newBox = new Uint8Array(newLen + 8);
            newBox.set(itobe4(1), 0);
            newBox.set(buf.subarray(4, 8), 4);
            newBox.set(itobe8(newLen + 8), 8);
            newBox.set(buf.subarray(8, newLen), 16);
            return newBox;
        }
        else {
            buf.set(itobe4(newLen), 0);
            return buf;
        }
    }
    else if (oldSize === 1) {
        if (newLen < 16) {
            throw new Error("Cannot update box length: box too short");
        }
        buf.set(itobe8(newLen), 8);
        return buf;
    }
    else if (newLen <= MAX_32_BIT_INT) {
        buf.set(itobe4(newLen), 0);
        return buf;
    }
    else {
        var newBox = new Uint8Array(newLen + 8);
        newBox.set(itobe4(1), 0);
        newBox.set(buf.subarray(4, 8), 4);
        newBox.set(itobe8(newLen + 8), 8);
        newBox.set(buf.subarray(8, newLen), 16);
        return newBox;
    }
}
export { getMDHDTimescale, getPlayReadyKIDFromPrivateData, getTrackFragmentDecodeTime, getDurationFromTrun, getSegmentsFromSidx, patchPssh, updateBoxLength, };

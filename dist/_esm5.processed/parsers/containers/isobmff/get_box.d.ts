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
 * Returns the content of a box based on its name.
 * `null` if not found.
 * /!\ does not work with UUID boxes
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box (e.g. 'sidx' or
 * 'moov'), hexa encoded
 * @returns {UInt8Array|null}
 */
declare function getBoxContent(buf: Uint8Array, boxName: number): Uint8Array | null;
/**
 * Returns an ISOBMFF box based on its name.
 * `null` if not found.
 * /!\ does not work with UUID boxes
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box (e.g. 'sidx' or
 * 'moov'), hexa encoded
 * @returns {UInt8Array|null}
 */
declare function getBox(buf: Uint8Array, boxName: number): Uint8Array | null;
/**
 * Returns start and end offset for a given box.
 * `null` if not found.
 * /!\ does not work with UUID boxes
 * @param {Uint8Array} buf - the isobmff structure
 * @param {Number} boxName - the 4-letter 'name' of the box (e.g. 'sidx' or
 * 'moov'), hexa encoded
 * @returns {Array.<number>|null}
 */
declare function getBoxOffsets(buf: Uint8Array, boxName: number): [number, number] | null;
/**
 * Gives the content of a specific UUID with its attached ID
 * @param {Uint8Array} buf
 * @param {Number} id1
 * @param {Number} id2
 * @param {Number} id3
 * @param {Number} id4
 * @returns {Uint8Array|undefined}
 */
declare function getUuidContent(buf: Uint8Array, id1: number, id2: number, id3: number, id4: number): Uint8Array | undefined;
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
declare function getNextBoxOffsets(buf: Uint8Array): [0, number, number] | null;
export { getBox, getBoxContent, getBoxOffsets, getNextBoxOffsets, getUuidContent, };

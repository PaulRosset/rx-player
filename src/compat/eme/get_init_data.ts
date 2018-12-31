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

import { EncryptedMediaError } from "../../errors";
import log from "../../log";
import {
  be4toi,
  concat,
  strToBytes,
} from "../../utils/byte_parsing";
import hashBuffer from "../../utils/hash_buffer";
import SimpleSet from "../../utils/simple_set";

// The way "pssh" will be written in those encrypted events
const PSSH_TO_INTEGER = be4toi(strToBytes("pssh"), 0);

/**
 * Some browsers have problems when the CENC PSSH box is the first managed PSSH
 * encountered (for the moment just Edge was noted with this behavior).
 *
 * This function tries to remove the CENC PSSH box in the given init data.
 *
 * If the initData is unrecognized or if a CENC PSSH is not found, this function
 * throws.
 * @param {Uint8Array} initData
 * @returns {Uint8Array}
 */
export function patchInitData(initData : Uint8Array) : Uint8Array {
  const initialLength = initData.byteLength;
  log.info("Compat: Trying to remove CENC PSSH from init data.");
  let resInitData = new Uint8Array();

  let offset = 0;
  while (offset < initData.length) {
    if (
      initData.length < offset + 8 ||
      be4toi(initData, offset + 4) !== PSSH_TO_INTEGER
    ) {
      log.warn("Compat: unrecognized initialization data. Cannot patch it.");
      throw new Error("Compat: unrecognized initialization data. Cannot patch it.");
    }

    const len = be4toi(new Uint8Array(initData), offset);
    if (offset + len > initData.length) {
      log.warn("Compat: unrecognized initialization data. Cannot patch it.");
      throw new Error("Compat: unrecognized initialization data. Cannot patch it.");
    }
    if (
      initData[offset + 12] === 0x10 &&
      initData[offset + 13] === 0x77 &&
      initData[offset + 14] === 0xef &&
      initData[offset + 15] === 0xec &&
      initData[offset + 16] === 0xc0 &&
      initData[offset + 17] === 0xb2 &&
      initData[offset + 18] === 0x4d &&
      initData[offset + 19] === 0x02 &&
      initData[offset + 20] === 0xac &&
      initData[offset + 21] === 0xe3 &&
      initData[offset + 22] === 0x3c &&
      initData[offset + 23] === 0x1e &&
      initData[offset + 24] === 0x52 &&
      initData[offset + 25] === 0xe2 &&
      initData[offset + 26] === 0xfb &&
      initData[offset + 27] === 0x4b
    ) {
      log.info("Compat: CENC PSSH found. Removing it.");
    } else {
      const currentPSSH = initData.subarray(offset, offset + len);
      resInitData = concat(resInitData, currentPSSH);
    }
    offset += len;
  }

  if (offset !== initData.length) {
    log.warn("Compat: unrecognized initialization data. Cannot patch it.");
    throw new Error("Compat: unrecognized initialization data. Cannot patch it.");
  }

  if (resInitData.byteLength === initialLength) {
    log.warn("Compat: CENC PSSH not found. Cannot patch it");
    throw new Error("Compat: unrecognized initialization data. Cannot patch it.");
  }
  return resInitData;
}

/**
 * As we observed on some browsers (IE and Edge), the initialization data on
 * some segments have sometimes duplicated PSSH when sent through an encrypted
 * event (but not when pushed to the SourceBuffer).
 *
 * This function tries to guess if the initialization data contains only PSSHs
 * concatenated (as it is usually the case).
 * If that's the case, it will filter duplicated PSSHs from it.
 *
 * @param {Uint8Array} initData
 * @returns {Uint8Array}
 */
function cleanEncryptedEvent(initData : Uint8Array) : Uint8Array {
  let resInitData = new Uint8Array();
  const currentHashes = new SimpleSet();

  let offset = 0;
  while (offset < initData.length) {
    if (
      initData.length < offset + 8 ||
      be4toi(initData, offset + 4) !== PSSH_TO_INTEGER
    ) {
      log.warn("unrecognized initialization data. Use as is.");
      return initData;
    }

    const len = be4toi(new Uint8Array(initData), offset);
    if (offset + len > initData.length) {
      log.warn("unrecognized initialization data. Use as is.");
      return initData;
    }
    const currentPSSH = initData.subarray(offset, offset + len);
    const currentPSSHHash = hashBuffer(currentPSSH);
    if (!currentHashes.test(currentPSSHHash)) {
      currentHashes.add(currentPSSHHash);
      resInitData = concat(resInitData, currentPSSH);
    } else {
      log.warn("Duplicated PSSH found in initialization data, removing it.");
    }
    offset += len;
  }

  if (offset !== initData.length) {
    log.warn("unrecognized initialization data. Use as is.");
    return initData;
  }
  return resInitData;
}

/**
 * Take out the two things we need on an encryptedEvent:
 *   - the initialization Data
 *   - the initialization Data type
 *
 * @param {MediaEncryptedEvent} encryptedEvent
 * @returns {Object}
 * @throws {EncryptedMediaError} - Throws if no initialization data is
 * encountered in the given event.
 */
export default function getInitData(
  encryptedEvent : MediaEncryptedEvent
) : {
  initData : Uint8Array;
  initDataType : string|undefined;
} {
  const initData = encryptedEvent.initData;
  if (initData == null) {
    const error = new Error("no init data found on media encrypted event.");
    throw new EncryptedMediaError("INVALID_ENCRYPTED_EVENT", error, true);
  }
  const initDataBytes = new Uint8Array(initData);
  return {
    initData: cleanEncryptedEvent(initDataBytes),
    initDataType: encryptedEvent.initDataType,
  };
}

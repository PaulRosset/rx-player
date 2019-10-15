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

import { of as observableOf } from "rxjs";
import { getMDHDTimescale } from "../../parsers/containers/isobmff";
import { getTimeCodeScale } from "../../parsers/containers/matroska";
import { ISegmentParserArguments } from "../types";
import getISOBMFFTimingInfos from "../utils/get_isobmff_timing_infos";
import isWEBMEmbeddedTrack from "../utils/is_webm_embedded_track";

export default function segmentParser({
  content,
  response,
  init,
} : ISegmentParserArguments<ArrayBuffer | null>) {
  const { period, segment, representation } = content;
  const { data } = response;
  const appendWindow : [ number | undefined,
                         number | undefined ] = [period.start, period.end ];
  if (data == null) {
    return observableOf({ chunkData: null,
                          chunkInfos: null,
                          chunkOffset: 0,
                          appendWindow });
  }

  const chunkData = new Uint8Array(data);
  const isWEBM = isWEBMEmbeddedTrack(representation);
  if (segment.isInit) {
    const timescale = isWEBM ? getTimeCodeScale(chunkData, 0) :
                               getMDHDTimescale(chunkData);

    const initChunkInfos = timescale != null && timescale > 0 ? { time: 0,
                                                                  duration: 0,
                                                                  timescale } :
                                                                null;
    return observableOf({ chunkData,
                          chunkInfos: initChunkInfos,
                          chunkOffset: segment.timestampOffset || 0,
                          appendWindow });
  }

  const chunkInfos = isWEBM ? null : // TODO extract from webm
                              getISOBMFFTimingInfos(chunkData,
                                                    false,
                                                    segment,
                                                    init);
  const chunkOffset = segment.timestampOffset || 0;
  return observableOf({ chunkData,
                        chunkInfos,
                        chunkOffset,
                        appendWindow });
}

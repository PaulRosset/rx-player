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
import { IRepresentationIndex, Representation } from "../../../manifest";
import ManifestBoundsCalculator from "./manifest_bounds_calculator";
import { IAdaptationSetIntermediateRepresentation } from "./node_parsers/AdaptationSet";
import { IRepresentationIntermediateRepresentation } from "./node_parsers/Representation";
import { IParsedSegmentTemplate } from "./node_parsers/SegmentTemplate";
/** Supplementary context needed to parse a RepresentationIndex. */
export interface IRepresentationInfos {
    /** Parsed AdaptationSet which contains the Representation. */
    adaptation: IAdaptationSetIntermediateRepresentation;
    /** Whether we should request new segments even if they are not yet finished. */
    aggressiveMode: boolean;
    /** availability time offset of the concerned Adaptation. */
    availabilityTimeOffset: number;
    /** Eventual URLs from which every relative URL will be based on. */
    baseURLs: string[];
    /** Allows to obtain the first/last available position of a dynamic content. */
    manifestBoundsCalculator: ManifestBoundsCalculator;
    /** End time of the current period, in seconds. */
    end?: number;
    /** Whether the Manifest can evolve with time. */
    isDynamic: boolean;
    /**
     * Parent parsed SegmentTemplate elements.
     * Sorted by provenance from higher level (e.g. Period) to lower-lever (e.g.
     * AdaptationSet).
     */
    parentSegmentTemplates: IParsedSegmentTemplate[];
    /**
     * Time (in terms of `performance.now`) at which the XML file containing this
     * Representation was received.
     */
    receivedTime?: number;
    /** Start time of the current period, in seconds. */
    start: number;
    /** Depth of the buffer for the whole content, in seconds. */
    timeShiftBufferDepth?: number;
    /**
     * The parser should take this Representation - which is the same as this one
     * parsed at an earlier time - as a base to speed-up the parsing process.
     * /!\ If unexpected differences exist between both, there is a risk of
     * de-synchronization with what is actually on the server.
     */
    unsafelyBaseOnPreviousRepresentation: Representation | null;
}
/**
 * Parse the specific segment indexing information found in a representation
 * into a IRepresentationIndex implementation.
 * @param {Array.<Object>} representation
 * @param {Object} representationInfos
 * @returns {Array.<Object>}
 */
export default function parseRepresentationIndex(representation: IRepresentationIntermediateRepresentation, representationInfos: IRepresentationInfos): IRepresentationIndex;

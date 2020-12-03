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
import { IBaseURL } from "./BaseURL";
import { IParsedContentComponent } from "./ContentComponent";
import { IParsedContentProtection } from "./ContentProtection";
import { IRepresentationIntermediateRepresentation } from "./Representation";
import { IParsedSegmentBase } from "./SegmentBase";
import { IParsedSegmentList } from "./SegmentList";
import { IParsedSegmentTemplate } from "./SegmentTemplate";
import { IScheme } from "./utils";
/** AdaptationSet once parsed into its intermediate representation. */
export interface IAdaptationSetIntermediateRepresentation {
    children: IAdaptationSetChildren;
    attributes: IAdaptationSetAttributes;
}
export interface IAdaptationSetChildren {
    baseURLs: IBaseURL[];
    representations: IRepresentationIntermediateRepresentation[];
    accessibility?: IScheme;
    contentComponent?: IParsedContentComponent;
    contentProtections?: IParsedContentProtection[];
    essentialProperties?: IScheme[];
    roles?: IScheme[];
    supplementalProperties?: IScheme[];
    segmentBase?: IParsedSegmentBase;
    segmentList?: IParsedSegmentList;
    segmentTemplate?: IParsedSegmentTemplate;
}
export interface IAdaptationSetAttributes {
    audioSamplingRate?: string;
    bitstreamSwitching?: boolean;
    codecs?: string;
    codingDependency?: boolean;
    contentType?: string;
    frameRate?: string;
    group?: number;
    height?: number;
    id?: string;
    language?: string;
    maxBitrate?: number;
    maxFrameRate?: string;
    maxHeight?: number;
    maxPlayoutRate?: number;
    maxWidth?: number;
    maximumSAPPeriod?: number;
    mimeType?: string;
    minBitrate?: number;
    minFrameRate?: string;
    minHeight?: number;
    minWidth?: number;
    par?: string;
    profiles?: string;
    selectionPriority?: number;
    segmentAlignment?: number | boolean;
    segmentProfiles?: string;
    subsegmentAlignment?: number | boolean;
    width?: number;
}
/**
 * Parse an AdaptationSet element into an AdaptationSet intermediate
 * representation.
 * @param {Element} adaptationSetElement - The AdaptationSet root element.
 * @returns {Array.<Object>}
 */
export declare function createAdaptationSetIntermediateRepresentation(adaptationSetElement: Element): [IAdaptationSetIntermediateRepresentation, Error[]];

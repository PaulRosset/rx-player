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
import { Representation } from "../../manifest";
import BandwidthEstimator from "./bandwidth_estimator";
import { IRequestInfo } from "./pending_requests_store";
/** Object describing the current playback conditions. */
interface IPlaybackConditionsInfo {
    /**
     * For the concerned media buffer, difference in seconds between the next
     * position where no segment data is available and the current position.
     */
    bufferGap: number;
    /** Current playback position on the concerned media element, in seconds. */
    position: number;
    /**
     * Last "playback rate" set by the user. This is the ideal "playback rate" at
     * which the media should play.
     */
    speed: number;
    /** `duration` property of the HTMLMediaElement on which the content plays. */
    duration: number;
}
/**
 * Analyze the current network conditions and give a bandwidth estimate as well
 * as a maximum bitrate a Representation should be.
 * @class NetworkAnalyzer
 */
export default class NetworkAnalyzer {
    private _inStarvationMode;
    private _initialBitrate;
    private _config;
    constructor(initialBitrate: number, lowLatencyMode: boolean);
    /**
     * Gives an estimate of the current bandwidth and of the bitrate that should
     * be considered for chosing a `representation`.
     * This estimate is only based on network metrics.
     * @param {Object} playbackInfo - Gives current information about playback
     * @param {Object} bandwidthEstimator
     * @param {Object|null} currentRepresentation
     * @param {Array.<Object>} currentRequests
     * @param {number|undefined} lastEstimatedBitrate
     * @returns {Object}
     */
    getBandwidthEstimate(playbackInfo: IPlaybackConditionsInfo, bandwidthEstimator: BandwidthEstimator, currentRepresentation: Representation | null, currentRequests: IRequestInfo[], lastEstimatedBitrate: number | undefined): {
        bandwidthEstimate?: number;
        bitrateChosen: number;
    };
    /**
     * For a given wanted bitrate, tells if should switch urgently.
     * @param {number} bitrate
     * @param {Object} playbackInfo
     * @returns {boolean}
     */
    isUrgent(bitrate: number, currentRepresentation: Representation | null, currentRequests: IRequestInfo[], playbackInfo: IPlaybackConditionsInfo): boolean;
}
export {};

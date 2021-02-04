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
var EVENTS = {
    activePeriodChanged: function (period) {
        return { type: "activePeriodChanged", value: { period: period } };
    },
    adaptationChange: function (bufferType, adaptation, period) {
        return { type: "adaptationChange", value: { type: bufferType, adaptation: adaptation,
                period: period } };
    },
    addedSegment: function (content, segment, buffered, segmentData) {
        return { type: "added-segment", value: { content: content,
                segment: segment,
                segmentData: segmentData,
                buffered: buffered } };
    },
    bitrateEstimationChange: function (type, bitrate) {
        return { type: "bitrateEstimationChange", value: { type: type, bitrate: bitrate } };
    },
    streamComplete: function (bufferType) {
        return { type: "complete-stream",
            value: { type: bufferType } };
    },
    endOfStream: function () {
        return { type: "end-of-stream",
            value: undefined };
    },
    needsManifestRefresh: function () {
        return { type: "needs-manifest-refresh",
            value: undefined };
    },
    manifestMightBeOufOfSync: function () {
        return { type: "manifest-might-be-out-of-sync",
            value: undefined };
    },
    /**
     * @param {Object} period - The Period to which the stream logic asking for a
     * media source reload is linked.
     * @param {number} reloadAt - Position at which we should reload
     * @param {boolean} reloadOnPause - If `false`, stay on pause after reloading.
     * if `true`, automatically play once reloaded.
     * @returns {Object}
     */
    needsMediaSourceReload: function (period, reloadAt, reloadOnPause) {
        return { type: "needs-media-source-reload", value: { position: reloadAt,
                autoPlay: reloadOnPause, period: period } };
    },
    needsDecipherabilityFlush: function (position, autoPlay, duration) {
        return { type: "needs-decipherability-flush", value: { position: position, autoPlay: autoPlay, duration: duration } };
    },
    periodStreamReady: function (type, period, adaptation$) {
        return { type: "periodStreamReady", value: { type: type, period: period, adaptation$: adaptation$ } };
    },
    periodStreamCleared: function (type, period) {
        return { type: "periodStreamCleared", value: { type: type, period: period } };
    },
    protectedSegment: function (initDataInfo) {
        return { type: "protected-segment",
            value: initDataInfo };
    },
    representationChange: function (type, period, representation) {
        return { type: "representationChange", value: { type: type, period: period, representation: representation } };
    },
    streamTerminating: function () {
        return { type: "stream-terminating",
            value: undefined };
    },
    resumeStream: function () {
        return { type: "resume-stream",
            value: undefined };
    },
    warning: function (value) {
        return { type: "warning", value: value };
    },
};
export default EVENTS;

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
import idGenerator from "../../../utils/id_generator";
import LocalRepresentationIndex from "./representation_index";
/**
 * @param {Object} localManifest
 * @returns {Object}
 */
export default function parseLocalManifest(localManifest) {
    if (localManifest.type !== "local") {
        throw new Error("Invalid local manifest given. It misses the `type` property.");
    }
    if (localManifest.version !== "0.2") {
        throw new Error("The current Local Manifest version (" + localManifest.version + ")" +
            " is not compatible with the current version of the RxPlayer");
    }
    var periodIdGenerator = idGenerator();
    var minimumPosition = localManifest.minimumPosition, maximumPosition = localManifest.maximumPosition, isFinished = localManifest.isFinished;
    var parsedPeriods = localManifest.periods
        .map(function (period) { return parsePeriod(period, { periodIdGenerator: periodIdGenerator,
        isFinished: isFinished }); });
    return { availabilityStartTime: 0,
        expired: localManifest.expired,
        transportType: "local",
        isDynamic: !localManifest.isFinished,
        isLive: false,
        uris: [], timeBounds: { absoluteMinimumTime: minimumPosition !== null && minimumPosition !== void 0 ? minimumPosition : 0, timeshiftDepth: null,
            maximumTimeData: { isLinear: false,
                value: maximumPosition,
                time: performance.now() }, }, periods: parsedPeriods };
}
/**
 * @param {Object} period
 * @param {Object} ctxt
 * @returns {Object}
 */
function parsePeriod(period, ctxt) {
    var isFinished = ctxt.isFinished;
    var adaptationIdGenerator = idGenerator();
    return {
        id: "period-" + ctxt.periodIdGenerator(),
        start: period.start,
        end: period.end,
        duration: period.end - period.start,
        adaptations: period.adaptations
            .reduce(function (acc, ada) {
            var type = ada.type;
            var adaps = acc[type];
            if (adaps === undefined) {
                adaps = [];
                acc[type] = adaps;
            }
            adaps.push(parseAdaptation(ada, { adaptationIdGenerator: adaptationIdGenerator,
                isFinished: isFinished }));
            return acc;
        }, {}),
    };
}
/**
 * @param {Object} adaptation
 * @param {Object} ctxt
 * @returns {Object}
 */
function parseAdaptation(adaptation, ctxt) {
    var isFinished = ctxt.isFinished;
    var representationIdGenerator = idGenerator();
    return {
        id: "adaptation-" + ctxt.adaptationIdGenerator(),
        type: adaptation.type,
        audioDescription: adaptation.audioDescription,
        closedCaption: adaptation.closedCaption,
        language: adaptation.language,
        representations: adaptation.representations.map(function (representation) {
            return parseRepresentation(representation, { representationIdGenerator: representationIdGenerator,
                isFinished: isFinished });
        }),
    };
}
/**
 * @param {Object} representation
 * @returns {Object}
 */
function parseRepresentation(representation, ctxt) {
    var isFinished = ctxt.isFinished;
    var id = "representation-" + ctxt.representationIdGenerator();
    return { id: id, bitrate: representation.bitrate,
        height: representation.height,
        width: representation.width,
        codecs: representation.codecs,
        mimeType: representation.mimeType,
        index: new LocalRepresentationIndex(representation.index, id, isFinished),
        contentProtections: representation.contentProtections };
}

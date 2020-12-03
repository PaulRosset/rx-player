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
import arrayFind from "../../../utils/array_find";
import arrayIncludes from "../../../utils/array_includes";
import isNonEmptyString from "../../../utils/is_non_empty_string";
import extractMinimumAvailabilityTimeOffset from "./extract_minimum_availability_time_offset";
import inferAdaptationType from "./infer_adaptation_type";
import parseRepresentations from "./parse_representations";
import resolveBaseURLs from "./resolve_base_urls";
/**
 * Detect if the accessibility given defines an adaptation for the visually
 * impaired.
 * Based on DVB Document A168 (DVB-DASH).
 * @param {Object} accessibility
 * @returns {Boolean}
 */
function isVisuallyImpaired(accessibility) {
    if (accessibility == null) {
        return false;
    }
    return (accessibility.schemeIdUri === "urn:tva:metadata:cs:AudioPurposeCS:2007" &&
        accessibility.value === "1");
}
/**
 * Detect if the accessibility given defines an adaptation for the hard of
 * hearing.
 * Based on DVB Document A168 (DVB-DASH).
 * @param {Object} accessibility
 * @returns {Boolean}
 */
function isHardOfHearing(accessibility) {
    if (accessibility == null) {
        return false;
    }
    return (accessibility.schemeIdUri === "urn:tva:metadata:cs:AudioPurposeCS:2007" &&
        accessibility.value === "2");
}
/**
 * Detect if the accessibility given defines an AdaptationSet containing a sign
 * language interpretation.
 * Based on DASH-IF 4.3.
 * @param {Object} accessibility
 * @returns {Boolean}
 */
function hasSignLanguageInterpretation(accessibility) {
    if (accessibility == null) {
        return false;
    }
    return (accessibility.schemeIdUri === "urn:mpeg:dash:role:2011" &&
        accessibility.value === "sign");
}
/**
 * Contruct Adaptation ID from the information we have.
 * @param {Object} adaptation
 * @param {Array.<Object>} representations
 * @param {Object} infos
 * @returns {string}
 */
function getAdaptationID(adaptation, infos) {
    if (isNonEmptyString(adaptation.attributes.id)) {
        return adaptation.attributes.id;
    }
    var idString = infos.type;
    if (isNonEmptyString(adaptation.attributes.language)) {
        idString += "-" + adaptation.attributes.language;
    }
    if (infos.isClosedCaption === true) {
        idString += "-cc";
    }
    if (infos.isAudioDescription === true) {
        idString += "-ad";
    }
    if (infos.isSignInterpreted === true) {
        idString += "-si";
    }
    if (isNonEmptyString(adaptation.attributes.contentType)) {
        idString += "-" + adaptation.attributes.contentType;
    }
    if (isNonEmptyString(adaptation.attributes.codecs)) {
        idString += "-" + adaptation.attributes.codecs;
    }
    if (isNonEmptyString(adaptation.attributes.mimeType)) {
        idString += "-" + adaptation.attributes.mimeType;
    }
    if (isNonEmptyString(adaptation.attributes.frameRate)) {
        idString += "-" + adaptation.attributes.frameRate;
    }
    return idString;
}
/**
 * Returns a list of ID this adaptation can be seamlessly switched to
 * @param {Object} adaptation
 * @returns {Array.<string>}
 */
function getAdaptationSetSwitchingIDs(adaptation) {
    if (adaptation.children.supplementalProperties != null) {
        var supplementalProperties = adaptation.children.supplementalProperties;
        for (var j = 0; j < supplementalProperties.length; j++) {
            var supplementalProperty = supplementalProperties[j];
            if (supplementalProperty.schemeIdUri ===
                "urn:mpeg:dash:adaptation-set-switching:2016" &&
                supplementalProperty.value != null) {
                return supplementalProperty.value.split(",")
                    .map(function (id) { return id.trim(); })
                    .filter(function (id) { return id; });
            }
        }
    }
    return [];
}
/**
 * Process AdaptationSets intermediate representations to return under its final
 * form.
 * Note that the AdaptationSets returned are sorted by priority (from the most
 * priority to the least one).
 * @param {Array.<Object>} adaptationsIR
 * @param {Object} periodInfos
 * @returns {Array.<Object>}
 */
export default function parseAdaptationSets(adaptationsIR, periodInfos) {
    var _a;
    var _b, _c, _d, _e;
    var parsedAdaptations = {};
    var adaptationSwitchingInfos = {};
    var parsedAdaptationsIDs = [];
    /**
     * Index of the last parsed AdaptationSet with a Role set as "main" in
     * `parsedAdaptations` for a given type.
     * Not defined for a type with no main Adaptation inside.
     * This is used to put main AdaptationSet first in the resulting array of
     * Adaptation while still preserving the MPD order among them.
     */
    var lastMainAdaptationIndex = {};
    // first sort AdaptationSets by absolute priority.
    adaptationsIR.sort(function (a, b) {
        var _a, _b;
        /* As of DASH-IF 4.3, `1` is the default value. */
        var priority1 = (_a = a.attributes.selectionPriority) !== null && _a !== void 0 ? _a : 1;
        var priority2 = (_b = b.attributes.selectionPriority) !== null && _b !== void 0 ? _b : 1;
        return priority2 - priority1;
    });
    for (var i = 0; i < adaptationsIR.length; i++) {
        var adaptation = adaptationsIR[i];
        var adaptationChildren = adaptation.children;
        var essentialProperties = adaptationChildren.essentialProperties, roles = adaptationChildren.roles;
        var isExclusivelyTrickModeTrack = (Array.isArray(essentialProperties) &&
            essentialProperties.some(function (ep) {
                return ep.schemeIdUri === "http://dashif.org/guidelines/trickmode";
            }));
        if (isExclusivelyTrickModeTrack) {
            // We do not for the moment parse trickmode tracks
            continue;
        }
        var isMainAdaptation = Array.isArray(roles) &&
            roles.some(function (role) { return role.value === "main"; }) &&
            roles.some(function (role) { return role.schemeIdUri === "urn:mpeg:dash:role:2011"; });
        var representationsIR = adaptation.children.representations;
        var availabilityTimeOffset = extractMinimumAvailabilityTimeOffset(adaptation.children.baseURLs) +
            periodInfos.availabilityTimeOffset;
        var adaptationMimeType = adaptation.attributes.mimeType;
        var adaptationCodecs = adaptation.attributes.codecs;
        var type = inferAdaptationType(representationsIR, isNonEmptyString(adaptationMimeType) ?
            adaptationMimeType :
            null, isNonEmptyString(adaptationCodecs) ?
            adaptationCodecs :
            null, adaptationChildren.roles != null ?
            adaptationChildren.roles :
            null);
        if (type === undefined) {
            continue;
        }
        var originalID = adaptation.attributes.id;
        var newID = void 0;
        var adaptationSetSwitchingIDs = getAdaptationSetSwitchingIDs(adaptation);
        var parentSegmentTemplates = [];
        if (periodInfos.segmentTemplate !== undefined) {
            parentSegmentTemplates.push(periodInfos.segmentTemplate);
        }
        if (adaptation.children.segmentTemplate !== undefined) {
            parentSegmentTemplates.push(adaptation.children.segmentTemplate);
        }
        var adaptationInfos = {
            aggressiveMode: periodInfos.aggressiveMode,
            availabilityTimeOffset: availabilityTimeOffset,
            baseURLs: resolveBaseURLs(periodInfos.baseURLs, adaptationChildren.baseURLs),
            manifestBoundsCalculator: periodInfos.manifestBoundsCalculator,
            end: periodInfos.end,
            isDynamic: periodInfos.isDynamic,
            parentSegmentTemplates: parentSegmentTemplates,
            receivedTime: periodInfos.receivedTime,
            start: periodInfos.start,
            timeShiftBufferDepth: periodInfos.timeShiftBufferDepth,
            unsafelyBaseOnPreviousAdaptation: null,
        };
        if (type === "video" &&
            isMainAdaptation &&
            parsedAdaptations.video !== undefined &&
            parsedAdaptations.video.length > 0 &&
            lastMainAdaptationIndex.video !== undefined) {
            // Add to the already existing main video adaptation
            // TODO remove that ugly custom logic?
            var videoMainAdaptation = parsedAdaptations.video[lastMainAdaptationIndex.video];
            adaptationInfos.unsafelyBaseOnPreviousAdaptation = (_c = (_b = periodInfos
                .unsafelyBaseOnPreviousPeriod) === null || _b === void 0 ? void 0 : _b.getAdaptation(videoMainAdaptation.id)) !== null && _c !== void 0 ? _c : null;
            var representations = parseRepresentations(representationsIR, adaptation, adaptationInfos);
            (_a = videoMainAdaptation.representations).push.apply(_a, representations);
            newID = videoMainAdaptation.id;
        }
        else {
            var accessibility = adaptationChildren.accessibility;
            var isDub = void 0;
            if (roles !== undefined &&
                roles.some(function (role) { return role.value === "dub"; })) {
                isDub = true;
            }
            var isClosedCaption = type === "text" &&
                accessibility != null &&
                isHardOfHearing(accessibility) ? true :
                undefined;
            var isAudioDescription = type === "audio" &&
                accessibility != null &&
                isVisuallyImpaired(accessibility) ? true :
                undefined;
            var isSignInterpreted = type === "video" &&
                accessibility != null &&
                hasSignLanguageInterpretation(accessibility) ? true :
                undefined;
            var adaptationID = getAdaptationID(adaptation, { isAudioDescription: isAudioDescription,
                isClosedCaption: isClosedCaption,
                isSignInterpreted: isSignInterpreted,
                type: type });
            // Avoid duplicate IDs
            while (arrayIncludes(parsedAdaptationsIDs, adaptationID)) {
                adaptationID += "-dup";
            }
            newID = adaptationID;
            parsedAdaptationsIDs.push(adaptationID);
            adaptationInfos.unsafelyBaseOnPreviousAdaptation = (_e = (_d = periodInfos
                .unsafelyBaseOnPreviousPeriod) === null || _d === void 0 ? void 0 : _d.getAdaptation(adaptationID)) !== null && _e !== void 0 ? _e : null;
            var representations = parseRepresentations(representationsIR, adaptation, adaptationInfos);
            var parsedAdaptationSet = { id: adaptationID, representations: representations,
                type: type };
            if (adaptation.attributes.language != null) {
                parsedAdaptationSet.language = adaptation.attributes.language;
            }
            if (isClosedCaption != null) {
                parsedAdaptationSet.closedCaption = isClosedCaption;
            }
            if (isAudioDescription != null) {
                parsedAdaptationSet.audioDescription = isAudioDescription;
            }
            if (isDub === true) {
                parsedAdaptationSet.isDub = true;
            }
            if (isSignInterpreted === true) {
                parsedAdaptationSet.isSignInterpreted = true;
            }
            var adaptationsOfTheSameType = parsedAdaptations[type];
            if (adaptationsOfTheSameType === undefined) {
                parsedAdaptations[type] = [parsedAdaptationSet];
                if (isMainAdaptation) {
                    lastMainAdaptationIndex[type] = 0;
                }
            }
            else {
                var mergedInto = null;
                var _loop_1 = function (k) {
                    var _a;
                    var id = adaptationSetSwitchingIDs[k];
                    var switchingInfos = adaptationSwitchingInfos[id];
                    if (switchingInfos != null &&
                        switchingInfos.newID !== newID &&
                        arrayIncludes(switchingInfos.adaptationSetSwitchingIDs, originalID)) {
                        var adaptationToMergeInto = arrayFind(adaptationsOfTheSameType, function (a) { return a.id === id; });
                        if (adaptationToMergeInto != null &&
                            adaptationToMergeInto.audioDescription ===
                                parsedAdaptationSet.audioDescription &&
                            adaptationToMergeInto.closedCaption ===
                                parsedAdaptationSet.closedCaption &&
                            adaptationToMergeInto.language === parsedAdaptationSet.language) {
                            log.info("DASH Parser: merging \"switchable\" AdaptationSets", originalID, id);
                            (_a = adaptationToMergeInto.representations)
                                .push.apply(_a, parsedAdaptationSet.representations);
                            mergedInto = adaptationToMergeInto;
                        }
                    }
                };
                // look if we have to merge this into another Adaptation
                for (var k = 0; k < adaptationSetSwitchingIDs.length; k++) {
                    _loop_1(k);
                }
                if (isMainAdaptation) {
                    var oldLastMainIdx = lastMainAdaptationIndex[type];
                    var newLastMainIdx = oldLastMainIdx === undefined ? 0 :
                        oldLastMainIdx + 1;
                    if (mergedInto === null) {
                        // put "main" Adaptation after all other Main Adaptations
                        adaptationsOfTheSameType.splice(newLastMainIdx, 0, parsedAdaptationSet);
                        lastMainAdaptationIndex[type] = newLastMainIdx;
                    }
                    else {
                        var indexOf = adaptationsOfTheSameType.indexOf(mergedInto);
                        if (indexOf < 0) { // Weird, not found
                            adaptationsOfTheSameType.splice(newLastMainIdx, 0, parsedAdaptationSet);
                            lastMainAdaptationIndex[type] = newLastMainIdx;
                        }
                        else if (oldLastMainIdx === undefined || indexOf > oldLastMainIdx) {
                            // Found but was not main
                            adaptationsOfTheSameType.splice(indexOf, 1);
                            adaptationsOfTheSameType.splice(newLastMainIdx, 0, mergedInto);
                            lastMainAdaptationIndex[type] = newLastMainIdx;
                        }
                    }
                }
                else if (mergedInto === null) {
                    adaptationsOfTheSameType.push(parsedAdaptationSet);
                }
            }
        }
        if (originalID != null && adaptationSwitchingInfos[originalID] == null) {
            adaptationSwitchingInfos[originalID] = { newID: newID,
                adaptationSetSwitchingIDs: adaptationSetSwitchingIDs };
        }
    }
    return parsedAdaptations;
}

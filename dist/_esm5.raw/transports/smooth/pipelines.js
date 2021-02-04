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
import { of as observableOf, } from "rxjs";
import { map, tap, } from "rxjs/operators";
import features from "../../features";
import log from "../../log";
import Manifest from "../../manifest";
import { getMDAT, takePSSHOut, } from "../../parsers/containers/isobmff";
import createSmoothManifestParser, { SmoothRepresentationIndex, } from "../../parsers/manifest/smooth";
import request from "../../utils/request";
import { strToUtf8, utf8ToStr, } from "../../utils/string_parsing";
import warnOnce from "../../utils/warn_once";
import checkISOBMFFIntegrity from "../utils/check_isobmff_integrity";
import returnParsedManifest from "../utils/return_parsed_manifest";
import generateManifestLoader from "../utils/text_manifest_loader";
import extractTimingsInfos from "./extract_timings_infos";
import { patchSegment } from "./isobmff";
import generateSegmentLoader from "./segment_loader";
import { extractISML, extractToken, replaceToken, resolveManifest, } from "./utils";
var WSX_REG = /\.wsx?(\?token=\S+)?/;
/**
 * @param {Object} adaptation
 * @param {Object} dlSegment
 * @param {Object} nextSegments
 */
function addNextSegments(adaptation, nextSegments, dlSegment) {
    var _a;
    log.debug("Smooth Parser: update segments information.");
    var representations = adaptation.representations;
    for (var i = 0; i < representations.length; i++) {
        var representation = representations[i];
        if (representation.index instanceof SmoothRepresentationIndex &&
            ((_a = dlSegment === null || dlSegment === void 0 ? void 0 : dlSegment.privateInfos) === null || _a === void 0 ? void 0 : _a.smoothMediaSegment) !== undefined) {
            representation.index._addSegments(nextSegments, dlSegment.privateInfos.smoothMediaSegment);
        }
        else {
            log.warn("Smooth Parser: should only encounter SmoothRepresentationIndex");
        }
    }
}
export default function (options) {
    var smoothManifestParser = createSmoothManifestParser(options);
    var segmentLoader = generateSegmentLoader(options.segmentLoader);
    var manifestLoaderOptions = { customManifestLoader: options.manifestLoader };
    var manifestLoader = generateManifestLoader(manifestLoaderOptions);
    var manifestPipeline = {
        resolver: function (_a) {
            var url = _a.url;
            if (url === undefined) {
                return observableOf({ url: undefined });
            }
            // TODO Remove WSX logic
            var resolving;
            if (WSX_REG.test(url)) {
                warnOnce("Giving WSX URL to loadVideo is deprecated." +
                    " You should only give Manifest URLs.");
                resolving = request({ url: replaceToken(url, ""),
                    responseType: "document" })
                    .pipe(map(function (_a) {
                    var value = _a.value;
                    var extractedURL = extractISML(value.responseData);
                    if (extractedURL === null || extractedURL.length === 0) {
                        throw new Error("Invalid ISML");
                    }
                    return extractedURL;
                }));
            }
            else {
                resolving = observableOf(url);
            }
            var token = extractToken(url);
            return resolving.pipe(map(function (_url) { return ({
                url: replaceToken(resolveManifest(_url), token),
            }); }));
        },
        loader: manifestLoader,
        parser: function (_a) {
            var response = _a.response, reqURL = _a.url;
            var url = response.url === undefined ? reqURL :
                response.url;
            var data = typeof response.responseData === "string" ?
                new DOMParser().parseFromString(response.responseData, "text/xml") :
                response.responseData; // TODO find a way to check if Document?
            var manifestReceivedTime = response.receivedTime;
            var parserResult = smoothManifestParser(data, url, manifestReceivedTime);
            var manifest = new Manifest(parserResult, {
                representationFilter: options.representationFilter,
                supplementaryImageTracks: options.supplementaryImageTracks,
                supplementaryTextTracks: options.supplementaryTextTracks,
            });
            return returnParsedManifest(manifest, url);
        },
    };
    var segmentPipeline = {
        loader: function (content) {
            if (content.segment.isInit || options.checkMediaSegmentIntegrity !== true) {
                return segmentLoader(content);
            }
            return segmentLoader(content).pipe(tap(function (res) {
                if ((res.type === "data-loaded" || res.type === "data-chunk") &&
                    res.value.responseData !== null) {
                    checkISOBMFFIntegrity(new Uint8Array(res.value.responseData), content.segment.isInit);
                }
            }));
        },
        parser: function (_a) {
            var _b, _c;
            var content = _a.content, response = _a.response, initTimescale = _a.initTimescale;
            var segment = content.segment, representation = content.representation, adaptation = content.adaptation, manifest = content.manifest;
            var data = response.data, isChunked = response.isChunked;
            if (data === null) {
                if (segment.isInit) {
                    var segmentProtections = representation.getProtectionsInitializationData();
                    return observableOf({ type: "parsed-init-segment", value: { initializationData: null, segmentProtections: segmentProtections, initTimescale: undefined } });
                }
                return observableOf({ type: "parsed-segment",
                    value: { chunkData: null,
                        chunkInfos: null,
                        chunkOffset: 0,
                        appendWindow: [undefined, undefined] } });
            }
            var responseBuffer = data instanceof Uint8Array ? data :
                new Uint8Array(data);
            if (segment.isInit) {
                var psshInfo = takePSSHOut(responseBuffer);
                if (psshInfo.length > 0) {
                    for (var i = 0; i < psshInfo.length; i++) {
                        var _d = psshInfo[i], systemID = _d.systemID, psshData = _d.data;
                        representation._addProtectionData("cenc", systemID, psshData);
                    }
                }
                var segmentProtections = representation.getProtectionsInitializationData();
                var timescale = (_c = (_b = segment.privateInfos) === null || _b === void 0 ? void 0 : _b.smoothInitSegment) === null || _c === void 0 ? void 0 : _c.timescale;
                return observableOf({ type: "parsed-init-segment", value: { initializationData: data,
                        // smooth init segments are crafted by hand.
                        // Their timescale is the one from the manifest.
                        initTimescale: timescale, segmentProtections: segmentProtections } });
            }
            var timingInfos = initTimescale !== undefined ?
                extractTimingsInfos(responseBuffer, isChunked, initTimescale, segment, manifest.isLive) :
                null;
            if (timingInfos === null ||
                timingInfos.chunkInfos === null ||
                timingInfos.scaledSegmentTime === undefined) {
                throw new Error("Smooth Segment without time information");
            }
            var nextSegments = timingInfos.nextSegments, chunkInfos = timingInfos.chunkInfos, scaledSegmentTime = timingInfos.scaledSegmentTime;
            var chunkData = patchSegment(responseBuffer, scaledSegmentTime);
            if (nextSegments.length > 0) {
                addNextSegments(adaptation, nextSegments, segment);
            }
            return observableOf({ type: "parsed-segment", value: { chunkData: chunkData,
                    chunkInfos: chunkInfos, chunkOffset: 0,
                    appendWindow: [undefined, undefined] } });
        },
    };
    var textTrackPipeline = {
        loader: function (_a) {
            var segment = _a.segment, representation = _a.representation, url = _a.url;
            if (segment.isInit || url === null) {
                return observableOf({ type: "data-created", value: { responseData: null } });
            }
            var isMP4 = isMP4EmbeddedTrack(representation);
            if (!isMP4 || options.checkMediaSegmentIntegrity !== true) {
                return request({ url: url, responseType: isMP4 ? "arraybuffer" : "text",
                    sendProgressEvents: true });
            }
            return request({ url: url, responseType: "arraybuffer",
                sendProgressEvents: true })
                .pipe(tap(function (res) {
                if (res.type === "data-loaded") {
                    checkISOBMFFIntegrity(new Uint8Array(res.value.responseData), segment.isInit);
                }
            }));
        },
        parser: function (_a) {
            var _b;
            var content = _a.content, response = _a.response, initTimescale = _a.initTimescale;
            var manifest = content.manifest, adaptation = content.adaptation, representation = content.representation, segment = content.segment;
            var language = adaptation.language;
            var isMP4 = isMP4EmbeddedTrack(representation);
            var _c = representation.mimeType, mimeType = _c === void 0 ? "" : _c, _d = representation.codec, codec = _d === void 0 ? "" : _d;
            var data = response.data, isChunked = response.isChunked;
            if (segment.isInit) { // text init segment has no use in HSS
                return observableOf({ type: "parsed-init-segment",
                    value: { initializationData: null,
                        segmentProtections: [],
                        initTimescale: undefined } });
            }
            if (data === null) {
                return observableOf({ type: "parsed-segment",
                    value: { chunkData: null,
                        chunkInfos: null,
                        chunkOffset: 0,
                        appendWindow: [undefined, undefined] } });
            }
            var nextSegments;
            var chunkInfos = null;
            var segmentStart;
            var segmentEnd;
            var _sdData;
            var _sdType;
            if (isMP4) {
                var chunkBytes = void 0;
                if (typeof data === "string") {
                    chunkBytes = strToUtf8(data);
                }
                else {
                    chunkBytes = data instanceof Uint8Array ? data :
                        new Uint8Array(data);
                }
                var timingInfos = initTimescale !== undefined ?
                    extractTimingsInfos(chunkBytes, isChunked, initTimescale, segment, manifest.isLive) :
                    null;
                nextSegments = timingInfos === null || timingInfos === void 0 ? void 0 : timingInfos.nextSegments;
                chunkInfos = (_b = timingInfos === null || timingInfos === void 0 ? void 0 : timingInfos.chunkInfos) !== null && _b !== void 0 ? _b : null;
                if (chunkInfos === null) {
                    if (isChunked) {
                        log.warn("Smooth: Unavailable time data for current text track.");
                    }
                    else {
                        segmentStart = segment.time;
                        segmentEnd = segment.end;
                    }
                }
                else {
                    segmentStart = chunkInfos.time;
                    segmentEnd = chunkInfos.duration !== undefined ?
                        chunkInfos.time + chunkInfos.duration :
                        segment.end;
                }
                var lcCodec = codec.toLowerCase();
                if (mimeType === "application/ttml+xml+mp4" ||
                    lcCodec === "stpp" ||
                    lcCodec === "stpp.ttml.im1t") {
                    _sdType = "ttml";
                }
                else if (lcCodec === "wvtt") {
                    _sdType = "vtt";
                }
                else {
                    throw new Error("could not find a text-track parser for the type " + mimeType);
                }
                var mdat = getMDAT(chunkBytes);
                _sdData = mdat === null ? "" :
                    utf8ToStr(mdat);
            }
            else { // not MP4
                segmentStart = segment.time;
                segmentEnd = segment.end;
                var chunkString = void 0;
                if (typeof data !== "string") {
                    var bytesData = data instanceof Uint8Array ? data :
                        new Uint8Array(data);
                    chunkString = utf8ToStr(bytesData);
                }
                else {
                    chunkString = data;
                }
                switch (mimeType) {
                    case "application/x-sami":
                    case "application/smil": // TODO SMIL should be its own format, no?
                        _sdType = "sami";
                        break;
                    case "application/ttml+xml":
                        _sdType = "ttml";
                        break;
                    case "text/vtt":
                        _sdType = "vtt";
                        break;
                }
                if (_sdType === undefined) {
                    var lcCodec = codec.toLowerCase();
                    if (lcCodec === "srt") {
                        _sdType = "srt";
                    }
                    else {
                        throw new Error("could not find a text-track parser for the type " + mimeType);
                    }
                }
                _sdData = chunkString;
            }
            if (chunkInfos !== null &&
                Array.isArray(nextSegments) && nextSegments.length > 0) {
                addNextSegments(adaptation, nextSegments, segment);
            }
            var chunkOffset = segmentStart !== null && segmentStart !== void 0 ? segmentStart : 0;
            return observableOf({ type: "parsed-segment", value: { chunkData: { type: _sdType,
                        data: _sdData,
                        start: segmentStart,
                        end: segmentEnd, language: language },
                    chunkInfos: chunkInfos,
                    chunkOffset: chunkOffset, appendWindow: [undefined, undefined] } });
        },
    };
    var imageTrackPipeline = {
        loader: function (_a) {
            var segment = _a.segment, url = _a.url;
            if (segment.isInit || url === null) {
                // image do not need an init segment. Passthrough directly to the parser
                return observableOf({ type: "data-created", value: { responseData: null } });
            }
            return request({ url: url, responseType: "arraybuffer",
                sendProgressEvents: true });
        },
        parser: function (_a) {
            var response = _a.response, content = _a.content;
            var data = response.data, isChunked = response.isChunked;
            if (content.segment.isInit) { // image init segment has no use
                return observableOf({ type: "parsed-init-segment",
                    value: { initializationData: null,
                        segmentProtections: [],
                        initTimescale: undefined } });
            }
            if (isChunked) {
                throw new Error("Image data should not be downloaded in chunks");
            }
            // TODO image Parsing should be more on the buffer side, no?
            if (data === null || features.imageParser === null) {
                return observableOf({ type: "parsed-segment",
                    value: { chunkData: null,
                        chunkInfos: null,
                        chunkOffset: 0,
                        appendWindow: [undefined, undefined] } });
            }
            var bifObject = features.imageParser(new Uint8Array(data));
            var thumbsData = bifObject.thumbs;
            return observableOf({ type: "parsed-segment",
                value: { chunkData: { data: thumbsData,
                        start: 0,
                        end: Number.MAX_VALUE,
                        timescale: 1,
                        type: "bif" },
                    chunkInfos: { time: 0,
                        duration: Number.MAX_VALUE,
                        timescale: bifObject.timescale },
                    chunkOffset: 0,
                    segmentProtections: [],
                    appendWindow: [undefined, undefined] } });
        },
    };
    return { manifest: manifestPipeline,
        audio: segmentPipeline,
        video: segmentPipeline,
        text: textTrackPipeline,
        image: imageTrackPipeline };
}
/**
 * Returns true if the given texttrack segment represents a textrack embedded
 * in a mp4 file.
 * @param {Representation} representation
 * @returns {Boolean}
 */
function isMP4EmbeddedTrack(representation) {
    return typeof representation.mimeType === "string" &&
        representation.mimeType.indexOf("mp4") >= 0;
}

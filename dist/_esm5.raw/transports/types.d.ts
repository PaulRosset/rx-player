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
import { Observable } from "rxjs";
import Manifest, { Adaptation, IRepresentationFilter, ISegment, ISupplementaryImageTrack, ISupplementaryTextTrack, Period, Representation } from "../manifest";
import { IBifThumbnail } from "../parsers/images/bif";
import { ILocalManifest } from "../parsers/manifest/local";
import { IMetaPlaylist } from "../parsers/manifest/metaplaylist";
/** Arguments for the loader of the manifest pipeline. */
export interface IManifestLoaderArguments {
    /**
     * URL of the Manifest we want to load.
     * `undefined` if the Manifest doesn't have an URL linked to it, in which
     *  case the Manifest should be loaded from another mean.
     */
    url: string | undefined;
}
/** Arguments for the loader of the segment pipelines. */
export interface ISegmentLoaderArguments {
    /** Manifest object related to this segment. */
    manifest: Manifest;
    /** Period object related to this segment. */
    period: Period;
    /** Adaptation object related to this segment. */
    adaptation: Adaptation;
    /** Representation Object related to this segment. */
    representation: Representation;
    /** Segment we want to load. */
    segment: ISegment;
    /**
     * URL at which the segment should be downloaded.
     * `null` if we do not have an URL (in which case the segment should be loaded
     * through an other mean).
     */
    url: string | null;
}
/** Payload of a "data-loaded" event. */
export interface ILoaderDataLoadedValue<T> {
    /** The loaded response data. */
    responseData: T;
    /** Duration the request took to be performed, in seconds. */
    duration: number | undefined;
    /**
     * "Real" URL (post-redirection) at which the data can be loaded.
     *
     * Note that this doesn't always apply e.g. some data might need multiple
     * URLs to be fetched, some other might need to fetch no URL.
     * This property should only be set when a unique URL is sufficient to
     * retrieve the whole data.
     */
    url?: string;
    /**
     * Time at which the request began in terms of `performance.now`.
     * If fetching the corresponding data necessitated to perform multiple
     * requests, this time corresponds to the first request made.
     */
    sendingTime?: number;
    /**
     * Time at which the request ended in terms of `performance.now`.
     * If fetching the corresponding data necessitated to perform multiple
     * requests, this time corresponds to the last request to end.
     */
    receivedTime?: number;
    /** Size in bytes of the loaded data.  `undefined` if we don't know.  */
    size: number | undefined;
}
/** Form that can take a loaded Manifest once loaded. */
export declare type ILoadedManifest = Document | string | IMetaPlaylist | ILocalManifest | Manifest;
/** Event emitted by a Manifest loader when the Manifest is fully available. */
export interface IManifestLoaderDataLoadedEvent {
    type: "data-loaded";
    value: ILoaderDataLoadedValue<ILoadedManifest>;
}
/** Event emitted by a segment loader when the data has been fully loaded. */
export interface ISegmentLoaderDataLoadedEvent<T> {
    type: "data-loaded";
    value: ILoaderDataLoadedValue<T>;
}
/**
 * Event emitted by a segment loader when the data is available without needing
 * to perform any request.
 *
 * Such data are for example directly generated from already-available data,
 * such as properties of a Manifest.
 */
export interface ISegmentLoaderDataCreatedEvent<T> {
    type: "data-created";
    value: {
        responseData: T;
    };
}
/**
 * Event emitted by a segment loader when new information on a pending request
 * is available.
 *
 * Note that this event is not mandatory.
 * It will be used to allow to communicate network metrics to the rest of the
 * player, like to adapt the quality of the content depending on the user's
 * bandwidth.
 */
export interface ILoaderProgressEvent {
    type: "progress";
    value: {
        /** Time since the beginning of the request so far, in seconds. */
        duration: number;
        /** Size of the data already downloaded, in bytes. */
        size: number;
        /** Size of whole data to download (data already-loaded included), in bytes. */
        totalSize?: number;
    };
}
/** Event emitted by a segment loader when a chunk of the response is available. */
export interface ISegmentLoaderDataChunkEvent {
    type: "data-chunk";
    value: {
        /** Loaded chunk, as raw data. */
        responseData: ArrayBuffer | Uint8Array;
    };
}
/**
 * Event emitted by segment loaders when all data from a segment has been
 * communicated through `ISegmentLoaderDataChunkEvent` events.
 */
export interface ISegmentLoaderDataChunkCompleteEvent {
    type: "data-chunk-complete";
    value: {
        /** Duration the request took to be performed, in seconds. */
        duration: number | undefined;
        /**
         * "Real" URL (post-redirection) at which the segment was loaded.
         *
         * Note that this doesn't always apply e.g. some segment might need multiple
         * URLs to be fetched, some other might need to fetch no URL.
         * This property should only be set when a unique URL is sufficient to
         * retrieve the whole data.
         */
        url?: string;
        /**
         * Time at which the request began in terms of `performance.now`.
         * If fetching the corresponding data necessitated to perform multiple
         * requests, this time corresponds to the first request made.
         */
        sendingTime?: number;
        /**
         * Time at which the request ended in terms of `performance.now`.
         * If fetching the corresponding data necessitated to perform multiple
         * requests, this time corresponds to the last request to end.
         */
        receivedTime?: number;
        /** Size in bytes of the loaded data.  `undefined` if we don't know.  */
        size: number | undefined;
    };
}
/**
 * Event sent by a segment loader when the corresponding segment is available
 * chunk per chunk.
 */
export declare type ISegmentLoaderChunkEvent = ISegmentLoaderDataChunkEvent | ISegmentLoaderDataChunkCompleteEvent;
/** Event emitted by a Manifest loader. */
export declare type IManifestLoaderEvent = IManifestLoaderDataLoadedEvent;
/** Event emitted by a segment loader. */
export declare type ISegmentLoaderEvent<T> = ILoaderProgressEvent | ISegmentLoaderChunkEvent | ISegmentLoaderDataLoadedEvent<T> | ISegmentLoaderDataCreatedEvent<T>;
/** Arguments given to the `parser` function of the Manifest pipeline. */
export interface IManifestParserArguments {
    /** Response obtained from the loader. */
    response: ILoaderDataLoadedValue<unknown>;
    /** Original URL used for the full version of the Manifest. */
    url?: string;
    /**
     * If set, offset to add to `performance.now()` to obtain the current
     * server's time.
     */
    externalClockOffset?: number;
    /** The previous value of the Manifest (when updating). */
    previousManifest: Manifest | null;
    /**
     * Allow the parser to ask for loading supplementary ressources while still
     * profiting from the same retries and error management than the loader.
     */
    scheduleRequest: (request: () => Observable<ILoaderDataLoadedValue<Document | string>>) => Observable<ILoaderDataLoadedValue<Document | string>>;
    /**
     * If set to `true`, the Manifest parser can perform advanced optimizations
     * to speed-up the parsing process. Those optimizations might lead to a
     * de-synchronization with what is actually on the server, hence the "unsafe"
     * part.
     * To use with moderation and only when needed.
     */
    unsafeMode: boolean;
}
/** Arguments given to the `parser` function of the segment pipeline. */
export interface ISegmentParserArguments<T> {
    /** Attributes of the corresponding loader's response. */
    response: {
        /** The loaded data. */
        data: T;
        /**
         * If `true`,`data` is only a "chunk" of the whole segment (which potentially
         * will contain multiple chunks).
         * If `false`, `data` is the data for the whole segment.
         */
        isChunked: boolean;
    };
    /**
     * "Timescale" obtained from parsing the wanted representation's initialization
     * segment.
     *
     * `undefined` if either no such `timescale` has been parsed yet or if this
     * value doesn't exist for the wanted segment.
     *
     * This value can be useful when parsing the loaded segment's data.
     */
    initTimescale?: number;
    /** Context about the wanted segment. */
    content: {
        /** Manifest object related to this segment. */
        manifest: Manifest;
        /** Period object related to this segment. */
        period: Period;
        /** Adaptation object related to this segment. */
        adaptation: Adaptation;
        /** Representation Object related to this segment. */
        representation: Representation;
        /** Segment we want to parse. */
        segment: ISegment;
    };
}
/** Event emitted when a Manifest object has been parsed. */
export interface IManifestParserResponseEvent {
    type: "parsed";
    value: {
        /** The parsed Manifest Object itself. */
        manifest: Manifest;
        /**
         * "Real" URL (post-redirection) at which the Manifest can be refreshed.
         *
         * Note that this doesn't always apply e.g. some Manifest might need multiple
         * URLs to be fetched, some other might need to fetch no URL.
         * This property should only be set when a unique URL is sufficient to
         * retrieve the whole data.
         */
        url?: string;
    };
}
/** Event emitted when a minor error was encountered when parsing the Manifest. */
export interface IManifestParserWarningEvent {
    type: "warning";
    /** Error describing the minor parsing error encountered. */
    value: Error;
}
/** Events emitted by the Manifest parser. */
export declare type IManifestParserEvent = IManifestParserResponseEvent | IManifestParserWarningEvent;
/** Observable returned by the Manifest parser. */
export declare type IManifestParserObservable = Observable<IManifestParserEvent>;
/**
 * Time information for a single segment.
 * Those variables expose the best guess we have on the effective duration and
 * starting time that the corresponding segment should have at decoding time.
 */
export interface IChunkTimeInfo {
    /**
     * Difference between the latest and the earliest presentation time
     * available in that segment, in seconds.
     *
     * Either `undefined` or set to `0` for initialization segment.
     */
    duration: number | undefined;
    /** Earliest presentation time available in that segment, in seconds. */
    time: number;
}
/** Encryption information linked to a segment. */
export interface ISegmentProtection {
    /**
     * The `initialization data type` of that segment protection information.
     * (https://www.w3.org/TR/encrypted-media/#initialization-data-type)
     */
    type: string;
    /** The segment protection information. */
    data: Uint8Array;
}
export interface ISegmentParserParsedInitSegment<T> {
    initializationData: T | null;
    initTimescale?: number;
    segmentProtections: ISegmentProtection[];
}
export interface ISegmentParserParsedSegment<T> {
    chunkData: T | null;
    chunkInfos: IChunkTimeInfo | null;
    chunkOffset: number;
    appendWindow: [
        number | undefined,
        // start window for the segment
        number | undefined
    ];
}
export interface ISegmentParserInitSegment<T> {
    type: "parsed-init-segment";
    value: ISegmentParserParsedInitSegment<T>;
}
export interface ISegmentParserSegment<T> {
    type: "parsed-segment";
    value: ISegmentParserParsedSegment<T>;
}
export declare type ISegmentParserResponse<T> = ISegmentParserInitSegment<T> | ISegmentParserSegment<T>;
export declare type IAudioVideoTrackSegmentData = Uint8Array | ArrayBuffer;
/** Text track segment data, once parsed. */
export interface ITextTrackSegmentData {
    /** The text track data, in the format indicated in `type`. */
    data: string;
    /** The format of `data` (examples: "ttml", "srt" or "vtt") */
    type: string;
    /**
     * Language in which the text track is, as a language code.
     * This is mostly needed for "sami" subtitles, to know which cues can / should
     * be parsed.
     */
    language?: string;
    /** start time from which the segment apply, in seconds. */
    start?: number;
    /** end time until which the segment apply, in seconds. */
    end?: number;
}
export interface IImageTrackSegmentData {
    data: IBifThumbnail[];
    end: number;
    start: number;
    timescale: number;
    type: string;
}
export declare type IAudioVideoParserInitSegmentResponse = ISegmentParserInitSegment<IAudioVideoTrackSegmentData>;
export declare type IAudioVideoParserSegmentResponse = ISegmentParserSegment<IAudioVideoTrackSegmentData>;
export declare type IAudioVideoParserResponse = IAudioVideoParserInitSegmentResponse | IAudioVideoParserSegmentResponse;
export declare type ITextParserInitSegmentResponse = ISegmentParserInitSegment<null>;
export declare type ITextParserSegmentResponse = ISegmentParserSegment<ITextTrackSegmentData>;
export declare type ITextParserResponse = ITextParserInitSegmentResponse | ITextParserSegmentResponse;
export declare type IImageParserInitSegmentResponse = ISegmentParserInitSegment<null>;
export declare type IImageParserSegmentResponse = ISegmentParserSegment<IImageTrackSegmentData>;
export declare type IImageParserResponse = IImageParserInitSegmentResponse | IImageParserSegmentResponse;
export declare type IAudioVideoParserObservable = Observable<IAudioVideoParserResponse>;
export declare type ITextParserObservable = Observable<ITextParserResponse>;
export declare type IImageParserObservable = Observable<IImageParserResponse>;
/**
 * "Resolve" URL of the Manifest.
 *
 * This is just here for legacy reasons. It should not be implemented anymore.
 * TODO Remove resolver
 */
export declare type IManifestResolverFunction = (x: IManifestLoaderArguments) => Observable<IManifestLoaderArguments>;
export declare type IManifestLoaderFunction = (x: IManifestLoaderArguments) => Observable<IManifestLoaderEvent>;
export declare type IManifestParserFunction = (x: IManifestParserArguments) => IManifestParserObservable;
export interface ITransportManifestPipeline {
    resolver?: IManifestResolverFunction;
    loader: IManifestLoaderFunction;
    parser: IManifestParserFunction;
}
export declare type ITransportAudioVideoSegmentLoader = (x: ISegmentLoaderArguments) => Observable<ISegmentLoaderEvent<Uint8Array | ArrayBuffer | null>>;
export declare type ITransportAudioVideoSegmentParser = (x: ISegmentParserArguments<Uint8Array | ArrayBuffer | null>) => IAudioVideoParserObservable;
export interface ITransportAudioVideoSegmentPipeline {
    loader: ITransportAudioVideoSegmentLoader;
    parser: ITransportAudioVideoSegmentParser;
}
export declare type ITransportTextSegmentLoader = (x: ISegmentLoaderArguments) => Observable<ISegmentLoaderEvent<Uint8Array | ArrayBuffer | string | null>>;
export declare type ITransportTextSegmentParser = (x: ISegmentParserArguments<Uint8Array | ArrayBuffer | string | null>) => ITextParserObservable;
export interface ITransportTextSegmentPipeline {
    loader: ITransportTextSegmentLoader;
    parser: ITransportTextSegmentParser;
}
export declare type ITransportImageSegmentLoader = (x: ISegmentLoaderArguments) => Observable<ISegmentLoaderEvent<Uint8Array | ArrayBuffer | null>>;
export declare type ITransportImageSegmentParser = (x: ISegmentParserArguments<Uint8Array | ArrayBuffer | null>) => IImageParserObservable;
export interface ITransportImageSegmentPipeline {
    loader: ITransportImageSegmentLoader;
    parser: ITransportImageSegmentParser;
}
export declare type ITransportSegmentPipeline = ITransportAudioVideoSegmentPipeline | ITransportTextSegmentPipeline | ITransportImageSegmentPipeline;
export declare type ITransportPipeline = ITransportManifestPipeline | ITransportSegmentPipeline;
export interface ITransportPipelines {
    manifest: ITransportManifestPipeline;
    audio: ITransportAudioVideoSegmentPipeline;
    video: ITransportAudioVideoSegmentPipeline;
    text: ITransportTextSegmentPipeline;
    image: ITransportImageSegmentPipeline;
}
interface IServerSyncInfos {
    serverTimestamp: number;
    clientTime: number;
}
export interface ITransportOptions {
    aggressiveMode?: boolean;
    checkMediaSegmentIntegrity?: boolean;
    lowLatencyMode: boolean;
    manifestLoader?: CustomManifestLoader;
    referenceDateTime?: number;
    representationFilter?: IRepresentationFilter;
    segmentLoader?: CustomSegmentLoader;
    serverSyncInfos?: IServerSyncInfos;
    supplementaryImageTracks?: ISupplementaryImageTrack[];
    supplementaryTextTracks?: ISupplementaryTextTrack[];
    __priv_patchLastSegmentInSidx?: boolean;
}
export declare type ITransportFunction = (options: ITransportOptions) => ITransportPipelines;
export declare type CustomSegmentLoader = (args: {
    adaptation: Adaptation;
    representation: Representation;
    segment: ISegment;
    transport: string;
    url: string;
    manifest: Manifest;
}, callbacks: {
    resolve: (rArgs: {
        data: ArrayBuffer | Uint8Array;
        sendingTime?: number;
        receivingTime?: number;
        size?: number;
        duration?: number;
    }) => void;
    progress: (pArgs: {
        duration: number;
        size: number;
        totalSize?: number;
    }) => void;
    reject: (err?: Error) => void;
    fallback?: () => void;
}) => (() => void) | void;
export declare type CustomManifestLoader = (url: string | undefined, callbacks: {
    resolve: (args: {
        data: ILoadedManifest;
        sendingTime?: number;
        receivingTime?: number;
        size?: number;
        duration?: number;
    }) => void;
    reject: (err?: Error) => void;
    fallback?: () => void;
}) => (() => void) | void;
export {};

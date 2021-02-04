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
import Manifest from "../../manifest";
import ABRManager from "../abr";
import { SegmentFetcherCreator } from "../fetchers";
import { IStreamOrchestratorOptions } from "../stream";
import { IInitClockTick, IMediaSourceLoaderEvent } from "./types";
/** Arguments needed by `createMediaSourceLoader`. */
export interface IMediaSourceLoaderArguments {
    /** Module helping to choose the right Representation. */
    abrManager: ABRManager;
    /** Various stream-related options. */
    bufferOptions: IStreamOrchestratorOptions;
    /** Observable emitting playback conditions regularly. */
    clock$: Observable<IInitClockTick>;
    manifest: Manifest;
    /** Media Element on which the content will be played. */
    mediaElement: HTMLMediaElement;
    /** Module to facilitate segment fetching. */
    segmentFetcherCreator: SegmentFetcherCreator<any>;
    /**
     * Observable emitting the wanted playback rate as it changes.
     * Replay the last value on subscription.
     */
    speed$: Observable<number>;
}
/**
 * Returns a function allowing to load or reload the content in arguments into
 * a single or multiple MediaSources.
 * @param {Object} args
 * @returns {Function}
 */
export default function createMediaSourceLoader({ mediaElement, manifest, clock$, speed$, bufferOptions, abrManager, segmentFetcherCreator }: IMediaSourceLoaderArguments): (mediaSource: MediaSource, initialTime: number, autoPlay: boolean) => Observable<IMediaSourceLoaderEvent>;

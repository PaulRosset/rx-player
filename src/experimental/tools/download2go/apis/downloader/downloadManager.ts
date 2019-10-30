/**
 * Copyright 2019 CANAL+ Group
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

import { combineLatest, AsyncSubject, of } from "rxjs";

import { initDownloader$ } from "./initSegment";
import {
  IInitSettings,
  IStoredManifest,
  IStoreManifestEveryFn,
} from "../../types";
import { IUtilsNotification } from "./types";
import { filter, startWith } from "rxjs/operators";
import { segmentPipelineDownloader$ } from "./segment";
import { SegmentPipelinesManager } from "../../../../../core/pipelines";
import { getTransportPipelineByTransport } from "./manifest";

class DownloadManager {
  readonly utils: IUtilsNotification;

  constructor(utils: IUtilsNotification) {
    this.utils = utils;
  }

  initDownload(initSettings: IInitSettings, pause$: AsyncSubject<void>) {
    const { contentID, adv } = initSettings;
    const pipelineSegmentDownloader$ = segmentPipelineDownloader$(
      initDownloader$(initSettings, this.utils.db),
      { contentID, db: this.utils.db, pause$, emitter: this.utils.emitter },
    );
    return combineLatest([
      pipelineSegmentDownloader$.pipe(
        filter(({ progress: { percentage } }) =>
          adv &&
          adv.storeManifestEvery &&
          typeof adv.storeManifestEvery === "function"
            ? adv.storeManifestEvery(percentage) || percentage === 100
            : percentage % 10 === 0,
        ),
        startWith(null),
      ),
      pause$.pipe(startWith(null)),
    ]);
  }

  resumeDownload(
    resumeSettings: IStoredManifest,
    pause$: AsyncSubject<void>,
    resumeOptions: {
      transport: "smooth" | "dash";
      storeManifestEvery?: IStoreManifestEveryFn;
    },
  ) {
    const { transport, storeManifestEvery } = resumeOptions;
    const segmentPipelinesManager = new SegmentPipelinesManager<any>(
      getTransportPipelineByTransport(transport),
      {
        lowLatencyMode: false,
      },
    );
    const {
      progress,
      manifest,
      builder: { video, audio, text },
      contentID,
    } = resumeSettings;
    const pipelineSegmentDownloader$ = segmentPipelineDownloader$(
      of({
        progress,
        video,
        audio,
        text,
        manifest,
        segmentPipelinesManager,
        type: "resume",
      }),
      { contentID, db: this.utils.db, pause$, emitter: this.utils.emitter },
    );
    return combineLatest([
      pipelineSegmentDownloader$.pipe(
        filter(({ progress: { percentage } }) =>
          storeManifestEvery && typeof storeManifestEvery === "function"
            ? storeManifestEvery(percentage) || percentage === 100
            : percentage % 10 === 0,
        ),
        startWith(null),
      ),
      pause$.pipe(startWith(null)),
    ]);
  }
}

export default DownloadManager;

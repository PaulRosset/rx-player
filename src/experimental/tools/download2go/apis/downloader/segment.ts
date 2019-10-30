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

import { merge, Observable, Subject, from, EMPTY } from "rxjs";
import { mergeMap, tap, map, reduce, scan, takeUntil } from "rxjs/operators";
import { concat, strToBytes } from "../../../../../utils/byte_parsing";
import {
  IUtils,
  IManifestDBState,
  ICustomSegment,
  IGlobalContext,
  IContext,
  IContextRicher,
} from "./types";
import { SegmentPipelinesManager } from "../../../../../core/pipelines";
import { createBox } from "../../../../../parsers/containers/isobmff";
import { ISegment } from "../../../../../manifest";
import { IInitGroupedSegments } from "./types";
import { IProgressBuilder } from "../../types";

export function handleSegmentPipelineFromContexts<
  KeyContextType extends keyof Omit<IGlobalContext, "manifest">
>(
  ctxs: IContext[],
  contentType: KeyContextType,
  {
    segmentPipelinesManager,
    isInitData,
    nextSegments,
    progress,
    type,
  }: {
    type: "start" | "resume";
    progress?: IProgressBuilder;
    isInitData: boolean;
    segmentPipelinesManager: SegmentPipelinesManager<any>;
    nextSegments?: ISegment[];
  },
): Observable<ICustomSegment> {
  const segmentFetcherForCurrentContentType = segmentPipelinesManager.createPipeline(
    contentType,
    new Subject(),
  );
  return from(ctxs).pipe(
    mergeMap(
      (ctx, index) =>
        segmentFetcherForCurrentContentType.createRequest(ctx).pipe(
          mergeMap(evt => {
            switch (evt.type) {
              case "chunk-complete":
                return EMPTY;
              case "chunk":
                return evt.parse();
              default:
                return EMPTY;
            }
          }),
          reduce(
            (acc, { chunkData, chunkInfos }) => {
              if (chunkData === null) {
                return acc;
              }
              const durationForCurrentChunk =
                chunkInfos !== null && chunkInfos.duration != undefined
                  ? chunkInfos.duration + acc.duration
                  : acc.duration;
              if (
                contentType === "text" &&
                ctx.representation.mimeType &&
                ctx.representation.mimeType === "application/mp4"
              ) {
                return {
                  chunkData: concat(
                    createBox("moof", acc.chunkData),
                    createBox("moof", strToBytes(chunkData.data)),
                  ),
                  duration: durationForCurrentChunk,
                };
              }
              return {
                chunkData: concat(acc.chunkData, chunkData),
                duration: durationForCurrentChunk,
              };
            },
            { chunkData: new Uint8Array(0), duration: 0 },
          ),
          map(infoData => {
            if (nextSegments && !isInitData) {
              delete nextSegments[index];
            }
            return {
              ...infoData,
              progress,
              type,
              contentType,
              ctx,
              index,
              isInitData,
              nextSegments,
              representationID: ctx.representation.id as string,
            };
          }),
        ),
      3,
    ),
  );
}

export function segmentPipelineDownloader$(
  builderObs$: Observable<IInitGroupedSegments>,
  { contentID, emitter, pause$, db }: IUtils,
): Observable<IManifestDBState> {
  return builderObs$.pipe(
    mergeMap(({ text, segmentPipelinesManager, manifest, progress, type }) => {
      if (manifest == null || segmentPipelinesManager == null) {
        return EMPTY;
      }
      return merge(
        // TODO: add video/audio here
        from(text).pipe(
          mergeMap<IContextRicher, Observable<ICustomSegment>>(
            contextRicher => {
              const { nextSegments, id, ...ctx } = contextRicher;
              return handleSegmentPipelineFromContexts(
                nextSegments.map(segment => ({ ...ctx, segment, manifest })),
                "text",
                {
                  type,
                  progress,
                  nextSegments,
                  segmentPipelinesManager,
                  isInitData: false,
                },
              );
            },
          ),
        ),
      );
    }),
    tap(async ({ chunkData, duration, index, representationID }) => {
      await db.put("segments", {
        contentID,
        data: chunkData,
        duration,
        segmentKey: `${representationID}--${contentID}--${index}`,
        size: chunkData.byteLength,
      });
    }),
    scan<
      {
        chunkData: Uint8Array;
        duration: number;
        ctx: IContext;
        index: number;
        contentType: "video" | "audio" | "text";
        representationID: string;
        isInitData: boolean;
        nextSegments?: ISegment[];
        progress?: IProgressBuilder;
        type: "start" | "resume";
      },
      IManifestDBState
    >(
      (
        acc,
        {
          progress,
          ctx,
          contentType,
          nextSegments,
          representationID,
          chunkData,
          type,
        },
      ) => {
        if (progress) {
          acc.progress.overall = progress.overall;
          if (type === "resume") {
            acc.progress.current = progress.current;
          }
          acc.progress.current += 1;
          acc.progress.percentage =
            (acc.progress.current / acc.progress.overall) * 100;
        }
        acc.size += chunkData.byteLength;
        if (!nextSegments) {
          return acc;
        }
        const indexRepresentation = acc[contentType].findIndex(
          ({ representation }) => representation.id === representationID,
        );
        if (indexRepresentation === -1) {
          acc[contentType].push({
            nextSegments,
            period: ctx.period,
            adaptation: ctx.adaptation,
            representation: ctx.representation,
            id: representationID,
          });
          return { ...acc, manifest: ctx.manifest };
        }
        acc[contentType][indexRepresentation] = {
          nextSegments,
          period: ctx.period,
          adaptation: ctx.adaptation,
          representation: ctx.representation,
          id: representationID,
        };
        return { ...acc, manifest: ctx.manifest };
      },
      {
        progress: { percentage: 0, current: 0, overall: 0 },
        manifest: null,
        video: [],
        audio: [],
        text: [],
        size: 0,
      },
    ),
    tap(({ size, progress }) => {
      emitter.trigger("progress", {
        contentID,
        progress: progress.percentage,
        size,
        status: "downloading",
      });
    }),
    takeUntil(pause$),
  );
}

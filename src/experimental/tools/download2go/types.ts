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

import { IDBPDatabase } from "idb";
import { Subject } from "rxjs";

import EventEmitter from "../../../utils/event_emitter";
import {
  IEmitterLoaderBuilder,
  ILocalManifestOnline,
  IProgressBarBuilder,
  IVideoSettings,
} from "./apis/dash/types";

export type IVideoSettingsQualityInputType = "HIGH" | "MEDIUM" | "LOW";
export interface ISettingsDownloader {
  url: string;
  type: "start";
  dbSettings: {
    contentID: string;
    metaData?: {
      [prop: string]: any;
    };
  };
  videoSettings: IVideoSettings;
}

export interface IProgressBarBuilderAbstract {
  progress: number;
  size: number;
  progressBarBuilder: IProgressBarBuilder;
  status: "counting" | "processing";
}

export interface IStoredManifest {
  contentID: string;
  metaData?: {
    [prop: string]: any;
  };
  progress: number;
  progressBarBuilder: IProgressBarBuilder;
  rxpManifest: ILocalManifestOnline;
  size: number;
}

export type IStoreManifestEveryFn = (progress: number) => boolean;

export interface IUtils {
  emitter: EventEmitter<IDownload2GoEvents>;
  db: IDBPDatabase;
  storeManifestEvery?: IStoreManifestEveryFn;
  progressBarBuilder$?: Subject<IEmitterLoaderBuilder>;
}

export interface IOptionsStarter {
  nameDB?: string;
  storeManifestEvery?: IStoreManifestEveryFn;
}

export interface IRequestArgs {
  method: "POST" | "GET";
  headers?: { [prop: string]: string };
  responseType?: XMLHttpRequestResponseType;
}

export interface IDownload2GoEvents {
  progress: {
    contentID: string;
    progress: number;
    size: number;
    status: string;
  };
  error: {
    action: string;
    contentID?: string;
    error: Error;
  };
  insertDB: {
    action: string;
    contentID: string;
    progress: number;
  };
}

export interface IPublicAPI {
  emitter: EventEmitter<IDownload2GoEvents>;
  download(settings: ISettingsDownloader): Promise<void>;
  resume(contentID: string): Promise<void>;
  pause(contentID: string): void;
  getAllDownloadedMovies<T>(): Promise<T[] | void>;
  getSingleMovie<T>(contentID: string): Promise<T | void>;
  deleteDownloadedMovie(contentID: string): Promise<void>;
}

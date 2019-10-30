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

import { IKeySystemOption } from "../../../core/eme";
import Manifest from "../../../manifest";
import { IContextRicher } from "./apis/downloader/types";

export type IVideoSettingsQualityInputType = "HIGH" | "MEDIUM" | "LOW";

export interface IGlobalSettings {
  nameDB?: string;
}

export interface IInitSettings {
  url: string;
  transport: "smooth" | "dash";
  // type: "start";
  contentID: string;
  metaData?: {
    [prop: string]: any;
  };
  adv?: IAdvancedSettings;
  keySystems?: IKeySystemOption;
}

export interface IResumeSettings extends IStoredManifest {
  type: "resume";
}

export interface IStoredManifest {
  contentID: string;
  manifest: Manifest | null;
  builder: {
    video: IContextRicher[];
    audio: IContextRicher[];
    text: IContextRicher[];
  };
  progress: IProgressBuilder;
  size: number;
  metaData?: {
    [prop: string]: any;
  };
}

export interface IProgressBuilder {
  percentage: number;
  current: number;
  overall: number;
}

export type IStoreManifestEveryFn = (progress: number) => boolean;
export interface IAdvancedSettings {
  storeManifestEvery?: IStoreManifestEveryFn;
  quality?: IVideoSettingsQualityInputType;
}

/***
 *
 * Event Emitter type:
 *
 */

type IArgs<
  TEventRecord,
  TEventName extends keyof TEventRecord
> = TEventRecord[TEventName];

export interface IEmitterTrigger<T> {
  trigger<TEventName extends keyof T>(
    evt: TEventName,
    arg: IArgs<T, TEventName>,
  ): void;
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

import Manifest, { Adaptation, Representation } from "../../../../../manifest";
import { IGlobalContext, IContextUniq, IContext } from "../downloader/types";
import { IVideoSettingsQualityInputType } from "../../types";

class ContentManager {
  readonly manifest: Manifest;
  readonly quality?: IVideoSettingsQualityInputType;

  constructor(manifest: Manifest, quality?: IVideoSettingsQualityInputType) {
    this.manifest = manifest;
    this.quality = quality;
  }

  getContextsForCurrentSession(): IGlobalContext {
    return this.manifest.periods.reduce(
      (acc: IGlobalContext, period) => {
        const videoContexts = this.decideUniqContext(
          period.getAdaptationsForType("video"),
          "video",
        );
        acc.video.push({ period, contexts: videoContexts });
        const audioContexts = this.decideUniqContext(
          period.getAdaptationsForType("audio"),
          "audio",
        );
        acc.audio.push({ period, contexts: audioContexts });
        const textContexts = this.decideUniqContext(
          period.getAdaptationsForType("text"),
          "text",
        );
        acc.text.push({ period, contexts: textContexts });
        return acc;
      },
      { video: [], audio: [], text: [], manifest: this.manifest },
    );
  }

  getContextsFormatted(
    globalCtx: IGlobalContext,
  ): { video: IContext[]; audio: IContext[]; text: IContext[] } {
    const video = globalCtx.video.reduce(
      (_: IContext[], currVideo): IContext[] => {
        return currVideo.contexts.map(
          (videoContext): IContext => ({
            manifest: globalCtx.manifest,
            period: currVideo.period,
            ...videoContext,
          }),
        );
      },
      [],
    );
    const audio = globalCtx.audio.reduce(
      (_: IContext[], currAudio): IContext[] => {
        return currAudio.contexts.map(
          (audioContext): IContext => ({
            manifest: globalCtx.manifest,
            period: currAudio.period,
            ...audioContext,
          }),
        );
      },
      [],
    );
    const text = globalCtx.text.reduce(
      (_: IContext[], currText): IContext[] => {
        return currText.contexts.map(
          (textContext): IContext => ({
            manifest: globalCtx.manifest,
            period: currText.period,
            ...textContext,
          }),
        );
      },
      [],
    );
    return { video, audio, text };
  }

  private decideRepresentation(
    representations: Representation[],
    contentType: "video" | "audio" | "text",
  ): Representation {
    switch (contentType) {
      case "video": {
        return representations.sort((a, b) =>
          b.height && a.height ? b.height - a.height : 0,
        )[representations.length - 1];
      }
      case "audio": {
        return representations[0];
      }
      case "text": {
        return representations[0];
      }
      default:
        return representations[0];
    }
  }

  private decideUniqContext(
    adaptations: Adaptation[],
    contentType: "video" | "audio" | "text",
  ): IContextUniq[] {
    return adaptations.reduce((acc: IContextUniq[], adaptation) => {
      const representation = this.decideRepresentation(
        adaptation.representations,
        contentType,
      );
      const segment = representation.index.getInitSegment();
      if (!segment) {
        throw new Error("Error while constructing the init segment");
      }
      acc.push({
        adaptation,
        representation,
        segment,
      });
      return acc;
    }, []);
  }
}

export default ContentManager;

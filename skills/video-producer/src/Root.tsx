import React from 'react';
import { Composition, staticFile } from 'remotion';
import {
  CaptionedVideo,
  calculateCaptionedVideoMetadata,
  captionedVideoSchema,
} from './CaptionedVideo';
import {
  BrandedReel,
  brandedReelSchema,
  brandedReelDefaultProps,
  calculateBrandedReelMetadata,
} from './BrandedReel';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BrandedReel"
        component={BrandedReel}
        calculateMetadata={calculateBrandedReelMetadata}
        schema={brandedReelSchema}
        width={1080}
        height={1920}
        defaultProps={{ ...brandedReelDefaultProps, src: staticFile('sample-video.mp4') }}
      />
      <Composition
        id="CaptionedVideo"
        component={CaptionedVideo}
        calculateMetadata={calculateCaptionedVideoMetadata}
        schema={captionedVideoSchema}
        width={1080}
        height={1920}
        defaultProps={{ src: staticFile('sample-video.mp4') }}
      />
    </>
  );
};

'use client';

import React, { forwardRef, useState } from 'react';
import { DefaultPlayer } from './default-player.js';
import { Alert } from './alert.js';
import { createVideoRequest, defaultLoader } from './video-loader.js';
import { config, camelCase, toSymlinkPath, usePolling } from './utils.js';
import * as transformers from '../providers/transformers.js';

import type { DefaultPlayerRefAttributes, DefaultPlayerProps } from './default-player.js';
import type { Asset } from '../assets.js';
import type { VideoLoaderProps, VideoProps, VideoPropsInternal } from './types.js';

const DEV_MODE = process.env.NODE_ENV === 'development';

const NextVideo = forwardRef<DefaultPlayerRefAttributes | null, VideoProps>((props: VideoProps, forwardedRef) => {
  let {
    as: VideoPlayer = DefaultPlayer,
    loader = defaultLoader,
    transform = defaultTransformer,
    className,
    style,
    src,
    width,
    height,
  } = props;

  let [asset, setAsset] = useState(typeof src === 'object' ? src : undefined);
  const [playing, setPlaying] = useState(false);

  // Required to make Next.js fast refresh when the local JSON file changes.
  // https://nextjs.org/docs/architecture/fast-refresh#fast-refresh-and-hooks
  if (typeof src === 'object') {
    asset = src;
    src = undefined;
  }

  // If the source is a string, poll the server for the JSON file.
  const loaderProps: VideoLoaderProps = { src, width, height };
  const request = createVideoRequest(loader, loaderProps, (json) => setAsset(json));

  const status = asset?.status;
  const needsPolling = DEV_MODE && (typeof src === 'string' && status != 'ready');
  usePolling(request, needsPolling ? 1000 : null);

  const videoProps = getVideoProps(
    { ...props, transform, src } as VideoPropsInternal,
    { asset }
  );

  return (
    <div
      className={`${className ? `${className} ` : ''}next-video-container`}
      style={style}
    >
      <style>{
        /* css */`
        .next-video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
        }

        [data-next-video] {
          position: relative;
          width: 100%;
          height: 100%;
          display: inline-block;
          line-height: 0;
        }

        [data-next-video] img {
          object-fit: var(--media-object-fit, contain);
          object-position: var(--media-object-position, center);
          background: center / var(--media-object-fit, contain) no-repeat transparent;
          width: 100%;
          height: 100%;
        }
        `
      }</style>

      <VideoPlayer
        ref={forwardedRef}
        data-next-video={status ?? ''}
        style={{ width, height }}
        asset={asset}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        {...videoProps}
      ></VideoPlayer>

      {DEV_MODE && <Alert
        hidden={Boolean(playing || !status || status === 'ready')}
        status={status}
      />}
    </div>
  );
});

export function getVideoProps(allProps: VideoPropsInternal, state: { asset?: Asset }) {
  const { asset } = state;
  // Remove props that are not needed for VideoPlayer.
  const {
    controls = true,
    as,
    className,
    style,
    src,
    poster,
    blurDataURL,
    loader,
    transform,
    ...rest
  } = allProps;

  const props: DefaultPlayerProps = {
    src: src as string | undefined,
    controls,
    poster,
    blurDataURL,
    ...rest
  };

  if (asset) {
    if (asset.status === 'ready') {
      props.blurDataURL ??= asset.blurDataURL;

      const transformedAsset = transform(asset);
      if (transformedAsset) {
        // src can't be overridden by the user.
        props.src = transformedAsset.sources?.[0]?.src;
        props.poster ??= transformedAsset.poster;
      }
    } else {
      props.src = toSymlinkPath(asset.originalFilePath);
    }
  }

  return props;
}

function defaultTransformer(asset: Asset) {
  const provider = asset.provider ?? config.provider;
  for (let [key, transformer] of Object.entries(transformers)) {
    if (key === camelCase(provider)) {
      return transformer.transform(asset);
    }
  }
}

export default NextVideo;

export type {
  VideoLoaderProps,
  VideoProps,
  DefaultPlayerProps,
};

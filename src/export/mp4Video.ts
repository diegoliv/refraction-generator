import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { createExportCanvas, createFrameRenderer, sanitizeName } from './pngSequence';
import type { ExportOptions } from './types';

const AVC_CODEC_CANDIDATES = [
  'avc1.640028',
  'avc1.64001f',
  'avc1.4d0028',
  'avc1.4d001f',
  'avc1.42e01f',
] as const;

type SupportedEncoderConfig = {
  codec: (typeof AVC_CODEC_CANDIDATES)[number];
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  bitrateMode: 'variable';
  latencyMode: 'quality';
  avc: { format: 'avc' };
};

function downloadFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function getBitrate(width: number, height: number, fps: number) {
  return Math.max(4_000_000, Math.round(width * height * fps * 0.12));
}

async function getSupportedEncoderConfig(width: number, height: number, fps: number): Promise<SupportedEncoderConfig> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('This browser does not support WebCodecs MP4 export.');
  }

  const base = {
    width,
    height,
    bitrate: getBitrate(width, height, fps),
    framerate: fps,
    bitrateMode: 'variable' as const,
    latencyMode: 'quality' as const,
    avc: { format: 'avc' as const },
  };

  for (const codec of AVC_CODEC_CANDIDATES) {
    const config: SupportedEncoderConfig = {
      codec,
      ...base,
    };

    if (typeof VideoEncoder.isConfigSupported !== 'function') {
      return config;
    }

    const support = await VideoEncoder.isConfigSupported(config);
    if (support.supported) {
      return config;
    }
  }

  throw new Error('This browser cannot encode MP4 video with the current export settings.');
}

export async function exportMp4Video({ config, animation, presetName, onProgress }: ExportOptions): Promise<void> {
  const { canvas, ctx, frameCount } = createExportCanvas(config);
  const renderFrame = await createFrameRenderer(config, animation, ctx, config.export.width, config.export.height, frameCount);
  const fileStem = `${sanitizeName(presetName)}_shader_${config.export.width}x${config.export.height}_${config.export.fps}fps`;
  const frameDurationUs = Math.round(1_000_000 / config.export.fps);

  onProgress?.({
    frame: 0,
    totalFrames: frameCount,
    progress: 0,
    status: 'Preparing MP4 encoder...',
  });

  const encoderConfig = await getSupportedEncoderConfig(config.export.width, config.export.height, config.export.fps);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: config.export.width,
      height: config.export.height,
      frameRate: config.export.fps,
    },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      throw error;
    },
  });

  encoder.configure(encoderConfig);

  try {
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      renderFrame(frameIndex);
      const timestamp = frameIndex * frameDurationUs;
      const frame = new VideoFrame(canvas, {
        timestamp,
        duration: frameDurationUs,
      });

      encoder.encode(frame, {
        keyFrame: frameIndex === 0 || frameIndex % Math.max(1, config.export.fps) === 0,
      });
      frame.close();

      onProgress?.({
        frame: frameIndex + 1,
        totalFrames: frameCount,
        progress: (frameIndex + 1) / Math.max(frameCount, 1) * 0.92,
        status: `Encoding frame ${frameIndex + 1} / ${frameCount}`,
      });

      if (encoder.encodeQueueSize > 12) {
        await encoder.flush();
      }
    }

    onProgress?.({
      frame: frameCount,
      totalFrames: frameCount,
      progress: 0.96,
      status: 'Finalizing MP4...',
    });

    await encoder.flush();
    muxer.finalize();

    const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
    downloadFile(mp4Blob, `${fileStem}.mp4`);

    onProgress?.({
      frame: frameCount,
      totalFrames: frameCount,
      progress: 1,
      status: 'MP4 export complete.',
    });
  } finally {
    encoder.close();
  }
}

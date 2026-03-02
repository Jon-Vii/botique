import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJBMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadSilkscreen } from '@remotion/google-fonts/Silkscreen';

const inter = loadInter('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const mono = loadJBMono('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const pixel = loadSilkscreen('normal', {
  weights: ['400', '700'],
  subsets: ['latin'],
});

export const FONT = {
  display: inter.fontFamily,
  mono: mono.fontFamily,
  pixel: pixel.fontFamily,
} as const;

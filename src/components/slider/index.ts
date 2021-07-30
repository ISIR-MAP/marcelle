import { Slider } from './slider.component';
import { SliderOptions } from '../../ui/components/slider-types';

export function slider(options: Partial<SliderOptions>): Slider {
  return new Slider(options);
}

export type { Slider, SliderOptions };

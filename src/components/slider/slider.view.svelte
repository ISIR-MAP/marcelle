<script lang="ts">
  import { Stream } from '../../core/';
  import ViewContainer from '../../core/ViewContainer.svelte';
  import RangeSlider from 'svelte-range-slider-pips';
  import { SliderOptions } from './slider.component';

  export let title: string;
  export let values: Stream<number[]>;
  export let options: Stream<SliderOptions>;
</script>

<ViewContainer {title}>
  <RangeSlider
    bind:values={$values}
    min={$options.min}
    max={$options.max}
    step={$options.step}
    range={$options.range}
    float={$options.float}
    vertial={$options.vertical}
    pips={$options.pips}
    pipstep={$options.pipstep}
    formatter={$options.formatter}
    all="label"
    springValues={$options.springValues}
  />
</ViewContainer>

<style lang="postcss">
  :global(.rangeSlider > .rangeBar),
  :global(.rangeSlider > .rangeHandle > .rangeNub),
  :global(.rangeSlider > .rangeHandle > .rangeFloat) {
    @apply bg-teal-500;
  }
  :global(.rangeSlider.focus > .rangeBar),
  :global(.rangeSlider > .rangeHandle.active > .rangeNub),
  :global(.rangeSlider > .rangeHandle.active > .rangeFloat) {
    @apply bg-teal-400;
  }
</style>

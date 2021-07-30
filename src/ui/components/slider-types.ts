export interface SliderOptions {
  values: number[];
  min: number;
  max: number;
  step: number;
  range: boolean | 'min' | 'max';
  float: boolean;
  vertical: boolean;
  pips: boolean;
  pipstep: number;
  springValues: {
    stiffness: number;
    damping: number;
  };
  formatter: (x: unknown) => unknown;
}

export interface SliderOptions {
  values: number[];
  min: number;
  max: number;
  step: number;
  range: boolean | 'min' | 'max';
  float: boolean;
  vertical: boolean;
  pips: boolean;
  first: boolean | 'label';
  last: boolean | 'label';
  rest: boolean | 'label';
  all: boolean | 'label';
  pipstep: number;
  springValues: {
    stiffness: number;
    damping: number;
  };
  formatter: (x: unknown) => unknown;
}

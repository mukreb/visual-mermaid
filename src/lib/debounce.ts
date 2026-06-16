export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel: () => void;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return debounced as Debounced<A>;
}

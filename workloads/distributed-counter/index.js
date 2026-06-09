export function distributedCounterWorkload() {
  return {
    name: "distributed-counter",
    states: 1500,
    description: "A monotone counter with merge pressure"
  };
}

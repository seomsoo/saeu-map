/** exhaustive switch 보조 — 유니온에 케이스가 추가되면 컴파일 에러로 잡힌다. */
export function assertNever(value: never): never {
  throw new Error(`unreachable: ${String(value)}`);
}

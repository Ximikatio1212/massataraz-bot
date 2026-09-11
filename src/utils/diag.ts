export const diag: string[] = [];

export function mark(msg: string) {
  diag.push(msg);
}

export function resetDiag() {
  diag.length = 0;
}
export interface WonParts {
  sign: "" | "-";
  currency: "₩";
  digits: string;
}

export function formatWon(amount: number): WonParts {
  return { sign: amount < 0 ? "-" : "", currency: "₩", digits: Math.abs(amount).toLocaleString("ko-KR") };
}

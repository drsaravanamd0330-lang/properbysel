/** Money is stored as integer paise. */
export function rupeesToPaise(rupees: number): bigint {
  if (!Number.isFinite(rupees) || rupees < 0) throw new RangeError("Invalid rupee amount");
  return BigInt(Math.round(rupees * 100));
}

export function paiseToRupees(paise: bigint | number | string): number {
  return Number(BigInt(paise)) / 100;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** ₹1,25,00,000 style grouping. */
export function formatINR(paise: bigint | number | string): string {
  return inr.format(paiseToRupees(paise));
}

/** Short form: ₹1.25 Cr, ₹45 L, ₹25,000. */
export function formatINRShort(paise: bigint | number | string): string {
  const r = paiseToRupees(paise);
  const trim = (n: number) => (Math.round(n * 100) / 100).toString();
  if (r >= 1_00_00_000) return `₹${trim(r / 1_00_00_000)} Cr`;
  if (r >= 1_00_000) return `₹${trim(r / 1_00_000)} L`;
  return inr.format(r);
}

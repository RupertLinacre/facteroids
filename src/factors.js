// Expand powers before handing the answer to the game's existing split logic.
export function parseFactorisation(input) {
  const syntax = "Enter factors such as 2 × 35, 2^5, or 2^2 × 3.";
  input = input.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (power) =>
    "^" + [...power].map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(digit)).join("")
  );
  const match = /^(?:(\d+)\s*=\s*)?([^=]+)$/.exec(input.trim());
  if (!match) return { error: syntax };
  const terms = match[2].replace(/\s*\^\s*/g, "^").split(/\s*[x×*]\s*|\s+/i);
  const factors = [];
  let product = 1;
  for (const term of terms) {
    const power = /^(\d+)(?:\^(\d+))?$/.exec(term);
    if (!power) return { error: syntax };
    const base = Number(power[1]),
      exponent = Number(power[2] ?? 1);
    if (base < 2 || exponent < 1)
      return {
        error: "Use factors greater than one and positive whole-number powers.",
      };
    // Validate the product first so even a very large exponent needs no array.
    product *= base ** exponent;
    if (!Number.isSafeInteger(product))
      return { error: "Those factors make a number that is too large." };
    for (let i = 0; i < exponent; i++) factors.push(base);
  }
  if (factors.length < 2) return { error: syntax };
  if (match[1] && Number(match[1]) !== product)
    return {
      error: "Those factors multiply to " + product + ".",
    };
  return { product, factors: factors.sort((a, b) => a - b) };
}

// Format completed powers and separators while retaining an editable text field.
export function formatFactors(value) {
  return value
    .replace(/\^(\d+)(?=\s|[x×*])/gi, (_, power) =>
      [...power].map((digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]).join("")
    )
    .replace(/\s*[x×*]\s*|\s+/gi, " × ");
}

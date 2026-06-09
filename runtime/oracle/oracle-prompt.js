/**
 * runtime/oracle/oracle-prompt.js
 *
 * Prompt construction for the transition oracle.
 *
 * Role in F_Q:
 *   Projects (S, Q, meta) into a structured natural-language prompt
 *   that forces multi-model output into the IR algebra.
 *
 * No chat. No summaries. Only IR transitions.
 */

/**
 * Build a structured transition prompt from state, query, and meta context.
 *
 * @param {object} state  - current UniStack state
 * @param {object} query  - active query (family, constraints)
 * @param {object} [meta] - optional basin/CPS context
 * @returns {string}
 */
export function buildTransitionPrompt(state, query, meta = {}) {
  const cpsVector = meta.cpsVector
    ? JSON.stringify(meta.cpsVector, null, 2)
    : "{}";

  const basinId  = meta.basinId  ?? "unknown";
  const rootHash = meta.rootHash ?? "unknown";
  const irWindow = JSON.stringify(meta.recentIR ?? [], null, 2);

  return `
STATE SUMMARY:
- CPS vector: ${cpsVector}
- basin_id: ${basinId}
- root_hash: ${rootHash}
- recent IR window: ${irWindow}

QUERY:
${JSON.stringify(query, null, 2)}

TASK:
Generate valid IR transitions that move S toward a stable fixed point under Q.
Each IR object must have an "opcode" (integer 0–15) and a "payload" (array of integers).
Prefer minimal transitions. Do not explain. Do not add commentary.

OUTPUT FORMAT:
Return a JSON array of IR objects only. Example:
[{"opcode":0,"payload":[1,7,0,0]},{"opcode":1,"payload":[0,2,0,0]}]
`.trim();
}

/**
 * Parse LLM text into a validated IR array.
 * Strips markdown fences, handles partial JSON, filters malformed objects.
 *
 * @param {string} text
 * @param {string} [modelName]
 * @returns {Array<{opcode:number, payload:number[]}>}
 */
export function parseIRArray(text, modelName = "?") {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end   = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    console.warn(`[oracle:${modelName}] no JSON array found in output`);
    return [];
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(ir =>
        ir !== null &&
        typeof ir === "object" &&
        typeof ir.opcode === "number" &&
        Array.isArray(ir.payload)
      )
      .map(ir => ({
        opcode:  Math.floor(ir.opcode) & 0xF,
        payload: ir.payload.map(v => Number(v) || 0)
      }));
  } catch {
    console.warn(`[oracle:${modelName}] JSON parse error`);
    return [];
  }
}

export default { buildTransitionPrompt, parseIRArray };

import { hash, rootOf } from "../unistack-core/index.js";

const ROOT_RE = /^[0-9a-f]{64}$/;

export function createStore() {
  const objects = new Map();

  function put(object) {
    const root = rootOf(object);
    objects.set(root, object);
    return root;
  }

  function has(root) {
    return objects.has(root);
  }

  function get(root) {
    return objects.get(root) ?? null;
  }

  function load(root) {
    return get(root);
  }

  function witness(root, target) {
    const object = get(root);
    if (!object) return null;
    const path = [];
    const siblings = [];

    const visit = (value, depth = 0) => {
      if (value === target) {
        return true;
      }
      if (typeof value === "string" && ROOT_RE.test(value) && objects.has(value)) {
        const child = get(value);
        if (child && visit(child, depth + 1)) {
          path.unshift(value);
          siblings.unshift([]);
          return true;
        }
        return false;
      }
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          if (visit(value[i], depth + 1)) {
            path.unshift(i);
            siblings.unshift(value.filter((_, j) => j !== i));
            return true;
          }
        }
        return false;
      }
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (visit(child, depth + 1)) {
            path.unshift(key);
            siblings.unshift(Object.fromEntries(Object.entries(value).filter(([k]) => k !== key)));
            return true;
          }
        }
      }
      return false;
    };

    const found = visit(object);
    return found
      ? {
          root,
          rootID: hash({ kind: "RootID", value: root }),
          target,
          path,
          siblings,
          leafHash: hash(target),
          proofType: "store-witness",
          depth: path.length
        }
      : null;
  }

  function witnessForRoot(root) {
    const object = get(root);
    if (!object) return null;
    return {
      root,
      rootID: hash({ kind: "RootID", value: root }),
      target: object,
      path: [],
      siblings: [],
      leafHash: hash(object),
      proofType: "root-witness",
      depth: 0
    };
  }

  function walk(root, seen = new Set()) {
    if (seen.has(root) || !objects.has(root)) return [];
    seen.add(root);
    const object = objects.get(root);
    const children = [];
    const visit = (value) => {
      if (typeof value === "string" && ROOT_RE.test(value) && objects.has(value)) {
        children.push(value);
        children.push(...walk(value, seen));
      } else if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(visit);
      }
    };
    visit(object);
    return [...new Set(children)];
  }

  function verify(witnessObject) {
    if (!witnessObject) return false;
    if (!has(witnessObject.root)) return false;
    const object = get(witnessObject.root);
    return hash(object) === witnessObject.leafHash || hash(witnessObject.target) === witnessObject.leafHash;
  }

  return { put, get, has, load, walk, witness, witnessForRoot, verify };
}

export function rootAddress(object) {
  return hash({ kind: "RootAddress", root: rootOf(object) });
}

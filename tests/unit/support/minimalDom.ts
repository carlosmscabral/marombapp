/**
 * Lightweight Node DOM harness for `react-dom/client` component unit tests.
 * Provides element creation, child tree mutation, `textContent`, and React fiber prop lookup without jsdom.
 */

export interface MinimalElement {
  nodeType: number;
  tagName: string;
  childNodes: Array<MinimalElement | { nodeType: 3; nodeValue: string }>;
  parentNode?: unknown;
  style: Record<string, unknown>;
  attributes: Record<string, string>;
  textContent: string;
  [key: string]: unknown;
}

/**
 * Installs a minimal `window` and `document` on `globalThis` and returns a root `<div>` container.
 */
export function createTestContainer(): MinimalElement {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as Record<string, unknown>).HTMLIFrameElement = class {};
  const noop = () => undefined;

  const doc: Record<string, unknown> = {
    nodeType: 9,
    documentElement: { style: {} },
    createElement: (tag: string) => makeEl(tag),
    createElementNS: (_ns: string, tag: string) => makeEl(tag),
    createTextNode: (text: string) => ({
      nodeType: 3 as const,
      nodeValue: String(text),
      data: String(text),
    }),
    addEventListener: noop,
    removeEventListener: noop,
  };

  function makeEl(tag: string): MinimalElement {
    const upper = tag.toUpperCase();
    return {
      nodeType: 1,
      nodeName: upper,
      tagName: upper,
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      ownerDocument: doc,
      childNodes: [],
      style: {},
      attributes: {},
      addEventListener: noop,
      removeEventListener: noop,
      setAttribute(k: string, v: unknown) {
        (this.attributes as Record<string, string>)[k] = String(v);
      },
      removeAttribute(k: string) {
        delete (this.attributes as Record<string, string>)[k];
      },
      appendChild(child: MinimalElement) {
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      removeChild(child: MinimalElement) {
        this.childNodes = this.childNodes.filter((x) => x !== child);
        return child;
      },
      insertBefore(child: MinimalElement, before: MinimalElement | null) {
        const idx = before ? this.childNodes.indexOf(before) : -1;
        if (idx === -1) this.childNodes.push(child);
        else this.childNodes.splice(idx, 0, child);
        child.parentNode = this;
        return child;
      },
      get textContent(): string {
        return this.childNodes
          .map((c) =>
            c.nodeType === 3 ? c.nodeValue : (c as MinimalElement).textContent,
          )
          .join('');
      },
      set textContent(value: string) {
        this.childNodes = value
          ? [{ nodeType: 3 as const, nodeValue: String(value) }]
          : [];
      },
    };
  }

  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).document = doc;
  return makeEl('div');
}

/**
 * Returns every `<button>` descendant under `rootEl` in document order.
 */
export function findButtons(rootEl: MinimalElement): MinimalElement[] {
  const out: MinimalElement[] = [];
  function walk(node: MinimalElement) {
    if (node.tagName === 'BUTTON') out.push(node);
    for (const child of node.childNodes) {
      if (child.nodeType === 1) walk(child as MinimalElement);
    }
  }
  walk(rootEl);
  return out;
}

/**
 * Reads React's internal props object attached to a rendered `MinimalElement`.
 */
export function getReactProps(el: MinimalElement): {
  onClick?: (e: { stopPropagation: () => void }) => void;
  'aria-label'?: string;
} {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  return (key ? (el[key] as ReturnType<typeof getReactProps>) : {}) ?? {};
}

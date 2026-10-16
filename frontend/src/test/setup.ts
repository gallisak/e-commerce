import '@testing-library/jest-dom/vitest';

Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

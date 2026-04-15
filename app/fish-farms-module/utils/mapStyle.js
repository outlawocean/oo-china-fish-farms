export const cloneMapStyle = (style) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(style);
  }

  return JSON.parse(JSON.stringify(style));
};

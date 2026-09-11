'use client';

// Paqshi re-skin (R2-16): the OSIRIS crypto token panel ($OSIRIS ticker +
// dexscreener chart iframe) is removed for the enterprise/sovereign build.
// Rendering nothing keeps every existing <TokenPanel/> usage a harmless no-op.
export default function TokenPanel() {
  return null;
}

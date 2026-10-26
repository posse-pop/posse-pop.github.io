// Background-only configuration: replace image with a local PNG/WebP/SVG URL.
// Paths are relative to this file. Run npm run prepare (or npm run package)
// afterwards: image existence and offline caching are updated automatically.
export const theme = [
  {name:'candy', color:'#ec91b1', image:'./assets/blocks/candy.png', shape:'<circle cx="16" cy="16" r="10"/>'},
  {name:'dice', color:'#84bba2', image:'./assets/blocks/dice.png', shape:'<path d="m16 3 4 8 9 1-7 7 2 10-8-5-8 5 2-10-7-7 9-1Z"/>'},
  {name:'book', color:'#ac98c9', image:'./assets/blocks/book.png', shape:'<path d="M4 6h10l2 2 2-2h10v22H18l-2 2-2-2H4Z"/>'},
  {name:'mabo', color:'#b9d5ff', image:'./assets/blocks/mabo.png', shape:'<rect x="11" y="3" width="10" height="18" rx="5"/><path d="M7 16v2a9 9 0 0 0 18 0v-2M16 27v4" fill="none"/>'},
  {name:'ramu', color:'#ffd2a8', image:'./assets/blocks/ramu.png', shape:'<rect x="5" y="5" width="22" height="22" rx="5"/>'},
  {name:'denu', color:'#e9ed98', image:'./assets/blocks/denu.png', shape:'<circle cx="16" cy="16" r="12"/>'}
];

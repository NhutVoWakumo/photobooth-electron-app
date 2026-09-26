/** The same document is used for silent printing and pre-release PDF proofs. */
export function buildPrintPage(widthInches: number, heightInches: number): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${widthInches}in ${heightInches}in;margin:0}html,body{margin:0;padding:0;width:${widthInches}in;height:${heightInches}in;overflow:hidden}img{display:block;width:100%;height:100%;object-fit:fill}</style></head><body><img src="photo.jpg"></body></html>`
}

export function printPageSizeMicrons(widthInches: number, heightInches: number): { width: number; height: number } {
  return { width: Math.round(widthInches * 25400), height: Math.round(heightInches * 25400) }
}

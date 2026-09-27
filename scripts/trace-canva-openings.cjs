// Inspect the original Canva artwork before changing calibrated photo slots.
const { readFileSync, writeFileSync } = require('node:fs')
const { inflateSync, deflateSync } = require('node:zlib')
const { join } = require('node:path')

const source = join(__dirname, '../src/renderer/src/assets/canva-together-bookmark.png')
const data = readFileSync(source)
const width = data.readUInt32BE(16)
const height = data.readUInt32BE(20)
if (width !== 600 || height !== 1800 || data[24] !== 8 || data[25] !== 2) throw new Error('Unexpected Canva artwork PNG format.')
const chunks = []
for (let offset = 8; offset < data.length;) {
  const length = data.readUInt32BE(offset)
  const type = data.toString('ascii', offset + 4, offset + 8)
  if (type === 'IDAT') chunks.push(data.subarray(offset + 8, offset + 8 + length))
  offset += length + 12
}
const raw = inflateSync(Buffer.concat(chunks))
const rgb = Buffer.alloc(width * height * 3)
let sourceOffset = 0
for (let y = 0; y < height; y += 1) {
  const filter = raw[sourceOffset++]
  for (let x = 0; x < width * 3; x += 1) {
    const base = y * width * 3 + x
    const left = x >= 3 ? rgb[base - 3] : 0
    const up = y > 0 ? rgb[base - width * 3] : 0
    const upperLeft = x >= 3 && y > 0 ? rgb[base - width * 3 - 3] : 0
    const prediction = left + up - upperLeft
    const paeth = [left, up, upperLeft].reduce((best, value) => Math.abs(prediction - value) < Math.abs(prediction - best) ? value : best, left)
    const byte = raw[sourceOffset++]
    rgb[base] = (byte + (filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? Math.floor((left + up) / 2) : paeth)) & 255
  }
}

const colour = (x, y) => Array.from(rgb.subarray((y * width + x) * 3, (y * width + x) * 3 + 3))
const samples = [[300,300],[300,120],[300,150],[300,650],[115,350],[125,350],[485,350],[300,850],[300,1100],[300,1250]]
console.log('samples', samples.map(([x,y]) => `${x},${y}:${colour(x,y).join(',')}`).join(' '))
const frequency = new Map()
for (let y = 100; y < 1300; y += 1) for (let x = 80; x < 520; x += 1) {
  const key = colour(x,y).join(',')
  frequency.set(key, (frequency.get(key) ?? 0) + 1)
}
console.log('top colours', [...frequency].sort((a,b) => b[1]-a[1]).slice(0,12))
const cream = ([r,g,b]) => Math.abs(r-251)+Math.abs(g-251)+Math.abs(b-244) < 9
if (process.argv.includes('--emit-masks')) {
  const crc32 = bytes => { let crc=0xffffffff; for(const byte of bytes) {crc^=byte;for(let i=0;i<8;i++) crc=(crc>>>1) ^ (crc&1 ? 0xedb88320 : 0)} return (crc^0xffffffff)>>>0 }
  const chunk=(type,body)=>{const name=Buffer.from(type);const length=Buffer.alloc(4),check=Buffer.alloc(4);length.writeUInt32BE(body.length);check.writeUInt32BE(crc32(Buffer.concat([name,body])));return Buffer.concat([length,name,body,check])}
  for (const [name, top, bottom] of [['top',120,670],['bottom',770,1320]]) {
    const left=80, maskWidth=440, maskHeight=bottom-top, scan=[]
    for(let y=top;y<bottom;y++) {
      if(!cream(colour(300,y))) {scan.push(null);continue}
      let start=300,end=300
      while(start>left && cream(colour(start-1,y))) start--
      while(end<left+maskWidth-1 && cream(colour(end+1,y))) end++
      scan.push([start,end])
    }
    const raw=Buffer.alloc(maskHeight*(1+maskWidth*4))
    for(let row=0;row<maskHeight;row++) {
      const run=scan[row]
      if(!run) continue
      const nearby=scan.slice(Math.max(0,row-4),Math.min(maskHeight,row+5)).filter(Boolean)
      const median=side=>nearby.map(bounds=>bounds[side]).sort((a,b)=>a-b)[Math.floor(nearby.length/2)]
      const start=Math.max(run[0],median(0)-4),end=Math.min(run[1],median(1)+4)
      for(let x=start;x<=end;x++) {
        const offset=row*(1+maskWidth*4)+1+(x-left)*4
        raw[offset]=255;raw[offset+1]=255;raw[offset+2]=255;raw[offset+3]=255
      }
    }
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(maskWidth,0);ihdr.writeUInt32BE(maskHeight,4);ihdr[8]=8;ihdr[9]=6
    const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw, {level:9})),chunk('IEND',Buffer.alloc(0))])
    const target=join(__dirname,`../src/renderer/src/assets/canva-together-mask-${name}.png`)
    writeFileSync(target,png)
    console.log('generated',target,png.length)
  }
}
if (process.argv.includes('--flood')) {
  for (const [name, top, bottom, seedY] of [['top',130,660,300],['bottom',778,1310,1030]]) {
    const left=80,right=520,w=right-left,h=bottom-top
    const found=new Uint8Array(w*h), queue=new Int32Array(w*h)
    let head=0,tail=0
    queue[tail++]=(seedY-top)*w+300-left
    found[queue[0]]=1
    while(head<tail) {
      const index=queue[head++],x=index%w,y=Math.floor(index/w)
      for(const other of [x>0?index-1:-1,x<w-1?index+1:-1,y>0?index-w:-1,y<h-1?index+w:-1]) {
        if(other<0||found[other]) continue
        const px=left+other%w,py=top+Math.floor(other/w)
        if(!cream(colour(px,py))) continue
        found[other]=1;queue[tail++]=other
      }
    }
    const borders={top:0,bottom:0,left:0,right:0}
    for(let x=0;x<w;x++) {borders.top+=found[x];borders.bottom+=found[(h-1)*w+x]}
    for(let y=0;y<h;y++) {borders.left+=found[y*w];borders.right+=found[y*w+w-1]}
    console.log('flood',name,{pixels:tail,bounds:[left,top,w,h],borders})
  }
}
if (process.argv.includes('--rows')) {
  for (const [name, start, end] of [['top', 136, 650], ['bottom', 784, 1304]]) {
    const rows=[]
    for (let y=start;y<=end;y+=8) {
      let left=300,right=300
      if (!cream(colour(300,y))) continue
      while (left>0 && cream(colour(left-1,y))) left--
      while (right<599 && cream(colour(right+1,y))) right++
      rows.push([y,left,right])
    }
    console.log(name,JSON.stringify(rows))
    const smooth=[]
    for(let y=start;y<=end;y+=16) {
      const nearby=rows.filter(([row])=>Math.abs(row-y)<=16)
      const median=key=>nearby.map(row=>row[key]).sort((a,b)=>a-b)[Math.floor(nearby.length/2)]
      smooth.push([y,median(1),median(2)])
    }
    console.log(name+'-smooth',JSON.stringify(smooth))
    const outline=smooth.map(([y,left])=>[left,y]).concat([...smooth].reverse().map(([y,,right])=>[right,y]))
    const contains=(x,y)=>{ let inside=false; for(let i=0,j=outline.length-1;i<outline.length;j=i++) { const [ax,ay]=outline[i],[bx,by]=outline[j]; if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside } return inside }
    let creamLeft=0, noncreamCovered=0, totalCream=0
    for(let y=start;y<=end;y++) for(let x=70;x<530;x++) {
      const isCream=cream(colour(x,y))
      if(isCream) totalCream++
      if(contains(x,y)) { if(!isCream) noncreamCovered++ } else if(isCream) creamLeft++
    }
    console.log(name+'-coverage',JSON.stringify({creamLeft,noncreamCovered,totalCream}))
    let ellipseCreamLeft=0
    for(let y=start;y<=end;y++) for(let x=70;x<530;x++) if(cream(colour(x,y))) {
      const cy=name==='top'?393:1044, ry=name==='top'?257:260
      if(((x-300)/190)**2+((y-cy)/ry)**2>=1) ellipseCreamLeft++
    }
    console.log(name+'-ellipse-cream-left',ellipseCreamLeft)
  }
}
for (const y of [100,120,140,160,180,220,260,320,380,450,520,580,620,650,680,720,760,800,840,900,980,1060,1140,1220,1280,1320]) {
  let left=300,right=300
  while (left>0 && cream(colour(left-1,y))) left--
  while (right<599 && cream(colour(right+1,y))) right++
  console.log('cream run',y,left,right)
}
for (const [label, [x0,y0,x1,y1]] of Object.entries({ legacy1:[108,180,492,657], test1:[108,144,492,639], legacy2:[108,819,492,1296], test2:[108,792,492,1296] })) {
  let total=0,bad=0
  for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
    const nx=(x-(x0+x1)/2)/((x1-x0)/2), ny=(y-(y0+y1)/2)/((y1-y0)/2)
    if (nx*nx+ny*ny>=1) continue
    total++
    const [r,g,b]=colour(x,y)
    if (!(r>=245&&g>=245&&b>=235)) bad++
  }
  console.log('ellipse',label,total,bad,(bad/total*100).toFixed(2)+'%')
}
for (const [label, topRange, bottomRange] of [['top',[136,164],[630,656]],['bottom',[784,814],[1280,1310]]]) {
  const good=[]
  for(let radius=190;radius<=202;radius+=2) for(let top=topRange[0];top<=topRange[1];top+=2) for(let bottom=bottomRange[0];bottom<=bottomRange[1];bottom+=2) {
    const cy=(top+bottom)/2, ry=(bottom-top)/2
    let invalid=false
    for(let i=0;i<720;i++) {
      const angle=i*Math.PI*2/720
      const x=Math.round(300+radius*Math.cos(angle)), y=Math.round(cy+ry*Math.sin(angle))
      const [r,g,b]=colour(x,y)
      if (!(r>=245&&g>=245&&b>=235)) { invalid=true; break }
    }
    if(!invalid) good.push({radius,top,bottom,area:Math.round(Math.PI*radius*ry)})
  }
  console.log('best ellipse',label,good.sort((a,b)=>b.area-a.area).slice(0,5))
}

if (process.argv.includes('--verify')) {
  for (const [label, [x0,y0,x1,y1]] of Object.entries({ top:[110,136,490,650], bottom:[110,784,490,1304] })) {
    let bad=0
    for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
      const nx=(x-(x0+x1)/2)/((x1-x0)/2), ny=(y-(y0+y1)/2)/((y1-y0)/2)
      if (nx*nx+ny*ny>=1) continue
      const [r,g,b]=colour(x,y)
      if (!(r>=245&&g>=245&&b>=235)) bad++
    }
    if (bad) throw new Error(`${label} cutout covers ${bad} non-ivory artwork pixels.`)
    console.log('verified',label,'0 non-ivory pixels covered')
  }
  for (const [label, top] of [['top',120],['bottom',770]]) {
    const png=readFileSync(join(__dirname,`../src/renderer/src/assets/canva-together-mask-${label}.png`))
    const offset=8+25, compressed=png.subarray(offset+8,offset+8+png.readUInt32BE(offset))
    const pixels=inflateSync(compressed), rowBytes=1+440*4
    let covered=0,invalid=0
    for(let row=0;row<550;row++) for(let x=0;x<440;x++) {
      const alpha=pixels[row*rowBytes+1+x*4+3]
      if(!alpha) continue
      covered++
      if(!cream(colour(80+x,top+row))) invalid++
    }
    if(invalid || covered<150000) throw new Error(`${label} generated cutout covers ${invalid} artwork pixels or is too small (${covered}).`)
    console.log('verified image mask',label,{covered,invalid})
  }
}

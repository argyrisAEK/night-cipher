import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LENGTHS=[5,10,15,20,26];
const SELECTORS=[
  'rect[fill="url(#bldgG)"]',
  'circle[fill="#ffd166"], rect[fill="#ffd166"]',
  'circle[r="48"]',
  'rect[y="250"]',
  'rect[width="60"]',
  'circle[data-hue]',
  'g[data-cipher="count-tile"]',
  'polygon[data-cipher="poly"]',
  'g[data-cipher="petals"]',
  'rect[width="84"]'
];
const OVERLAP_THRESHOLD=0.10;

test('Visual Audit: deterministic geometry, clipping and screenshot baseline for all 10 ciphers', async ({ page }, testInfo) => {
  const cipherNames = await page.evaluate(async () => (await import('/js/ciphers.js')).TRAIN.map(item=>item.n));
  expect(cipherNames).toHaveLength(10);

  const auditDir=path.resolve('test-results/visual-audit');
  await mkdir(auditDir,{recursive:true});
  const report={
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    source:'TRAIN renderers on main branch; fixed deterministic seeds',
    canvas:{width:800,height:500},
    lengths:LENGTHS,
    overlapThreshold:OVERLAP_THRESHOLD,
    note:'Geometry indicators are diagnostic, not pass/fail judgments of visual decodability. Screenshots are visual evidence; no renderer or cipher mapping is modified.',
    ciphers:[]
  };

  for(let cipherIndex=0;cipherIndex<cipherNames.length;cipherIndex++){
    const cipher={n:cipherNames[cipherIndex]};
    const cipherReport={index:cipherIndex,name:cipher.n,measurements:[]};

    for(const length of LENGTHS){
      const message=ALPHABET.slice(0,length);
      const seed=9000+cipherIndex*100+length;
      const svg=await page.evaluate(async ({cipherIndex,message,seed})=>{
        const {TRAIN}=await import('/js/ciphers.js');
        return TRAIN[cipherIndex].g(message,seed);
      },{cipherIndex,message,seed});

      const selector=SELECTORS[cipherIndex];
      const metrics=await page.evaluate(({svg,selector})=>{
        const host=document.createElement('div');
        host.style.cssText='position:fixed;left:-10000px;top:0;width:800px;height:500px';
        host.innerHTML=svg;
        document.body.appendChild(host);
        const root=host.querySelector('svg');
        const vb=(root.getAttribute('viewBox')||'0 0 800 500').split(/[ ,]+/).map(Number);
        const [vx,vy,vw,vh]=vb;
        const nodes=[...root.querySelectorAll(selector)];
        const boxes=nodes.map(node=>{
          const b=node.getBBox();
          return {x:b.x,y:b.y,width:b.width,height:b.height};
        });
        let clipped=0,overlaps=0,maxOverlapRatio=0;
        for(const b of boxes){
          if(b.x<vx||b.y<vy||b.x+b.width>vx+vw||b.y+b.height>vy+vh)clipped++;
        }
        for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
          const a=boxes[i],b=boxes[j];
          const iw=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));
          const ih=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
          const intersection=iw*ih;
          const minArea=Math.min(a.width*a.height,b.width*b.height);
          const ratio=minArea?intersection/minArea:0;
          if(ratio>0.10)overlaps++;
          maxOverlapRatio=Math.max(maxOverlapRatio,ratio);
        }
        const bounds=root.getBBox();
        const result={
          symbolBoxes:boxes.length,
          clippedSymbolBoxes:clipped,
          overlappingPairs:overlaps,
          maxPairwiseOverlapRatio:Number(maxOverlapRatio.toFixed(4)),
          svgBounds:{x:Number(bounds.x.toFixed(2)),y:Number(bounds.y.toFixed(2)),width:Number(bounds.width.toFixed(2)),height:Number(bounds.height.toFixed(2))},
          viewBox:{x:vx,y:vy,width:vw,height:vh}
        };
        host.remove();
        return result;
      },{svg,selector});
      metrics.expectedCharacters=length;

      cipherReport.measurements.push({length,seed,...metrics});

      if(length===26){
        for(const width of [800,256]){
          await page.setViewportSize({width:Math.max(width,320),height:Math.round(width*500/800)});
          await page.setContent('<!doctype html><html><head><style>html,body{margin:0;background:#080d20}main{width:'+width+'px}svg{display:block;width:100%;height:auto}</style></head><body><main>'+svg+'</main></body></html>');
          await page.locator('svg').screenshot({
            path:path.join(auditDir,cipher.n.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+width+'.png'),
            animations:'disabled'
          });
        }
      }
    }
    report.ciphers.push(cipherReport);
  }

  const jsonPath=path.join(auditDir,'visual-audit-report.json');
  await writeFile(jsonPath,JSON.stringify(report,null,2)+'\n');
  await testInfo.attach('visual-audit-report',{path:jsonPath,contentType:'application/json'});
  for(const cipher of report.ciphers){
    const full=path.join(auditDir,cipher.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-800.png');
    const small=path.join(auditDir,cipher.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-256.png');
    await testInfo.attach(cipher.name+' — 800px',{path:full,contentType:'image/png'});
    await testInfo.attach(cipher.name+' — 256px',{path:small,contentType:'image/png'});
  }

  expect(report.ciphers.map(c=>c.name)).toEqual([
    'Skyline','Morse stars','Compass','Windows','Braille',
    'Colour','Constellation','Facets','Bloom','Rhythm'
  ]);
  expect(report.ciphers.every(c=>c.measurements.length===LENGTHS.length)).toBe(true);
});

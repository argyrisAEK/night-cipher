/* ---------- enhanced training puzzles & SVGs ---------- */
const E=(t,o,c='')=>`<${t} ${Object.entries(o).map(([k,v])=>`${k}="${v}"`).join(' ')}>${c}</${t}>`;
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const wrap=b=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">${b}</svg>`;
const idx=c=>c.charCodeAt(0)-64;

const sky=r=>{
  let s='<defs>'+
    '<linearGradient id="bgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#070b1b"/><stop offset="48%" stop-color="#111b3b"/><stop offset="100%" stop-color="#263052"/></linearGradient>'+
    '<radialGradient id="nebulaG" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="#7562a8" stop-opacity=".32"/><stop offset="55%" stop-color="#354c86" stop-opacity=".16"/><stop offset="100%" stop-color="#111b3b" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="moonG" cx="34%" cy="30%" r="70%"><stop offset="0%" stop-color="#ffffff"/><stop offset="62%" stop-color="#e8eaff"/><stop offset="100%" stop-color="#aeb9db"/></radialGradient>'+
    '<linearGradient id="bldgG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#28365d"/><stop offset="48%" stop-color="#111a36"/><stop offset="100%" stop-color="#080e21"/></linearGradient>'+
    '<linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff2c7"/><stop offset="48%" stop-color="#f4c978"/><stop offset="100%" stop-color="#b77b48"/></linearGradient>'+
    '<linearGradient id="glassG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#9de9f0" stop-opacity=".8"/><stop offset="45%" stop-color="#6679bd" stop-opacity=".62"/><stop offset="100%" stop-color="#302d62" stop-opacity=".9"/></linearGradient>'+
    '<filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
    '<filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
    '<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur"/><feOffset dy="5"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'+
    '<style>'+
      'circle[fill="#ffd166"],rect[fill="#ffd166"]{fill:url(#goldG);filter:url(#glow);stroke:#fff0c2;stroke-opacity:.58;stroke-width:.8}'+
      'circle[r="6"][fill="#ffd166"]{fill:url(#goldG)}'+
      'rect[fill="url(#bldgG)"]{filter:url(#shadow);stroke:#8fa5d8;stroke-opacity:.24}'+
      'polygon[fill="#232b52"]{fill:url(#glassG);stroke:#a8c3e8;stroke-opacity:.35}'+
      'rect[fill="#151b36"],rect[fill="#151c3b"]{fill:#1a2948;stroke:#9cb5df;stroke-opacity:.14}'+
      'circle[fill="#0b0f24"],circle[fill="url(#bldgG)"]{fill:url(#glassG);stroke:#b5c7ed;stroke-opacity:.55}'+
      'rect[fill="#0d122b"],rect[fill="#101733"]{fill:url(#glassG);fill-opacity:.58;stroke:#91a9d6;stroke-opacity:.42}'+
      'circle[fill="#182042"],circle[fill="#273258"]{fill:#263b60;stroke:#a9c0e8;stroke-opacity:.22}'+
      'circle[fill="#fff2c2"]{filter:url(#softGlow);stroke:#fff;stroke-opacity:.65}'+
      'polygon[data-cipher="poly"]{fill:url(#glassG);filter:url(#softGlow);stroke:#d5e6ff;stroke-width:2.2}'+
      'ellipse[data-cipher="petal"]{fill:url(#goldG);filter:url(#glow);stroke:#fff0c2;stroke-opacity:.82}'+
      'circle[data-hue]{stroke:#e9f5ff;stroke-opacity:.62;stroke-width:1.8;filter:url(#softGlow)}'+
      'rect[data-cipher="rhythm-bit"]{fill:url(#goldG);filter:url(#glow);stroke:#fff0c2;stroke-opacity:.45}'+
      'line[stroke="#ffd166"],circle[stroke="#ffd166"]{filter:url(#glow)}'+
      'circle[r="10"]{filter:url(#glow);stroke:#f5dca8;stroke-opacity:.5}'+
    '</style>'+
    '</defs>';
  s+=E('rect',{width:800,height:500,fill:'url(#bgG)'})+
    E('ellipse',{cx:410,cy:180,rx:440,ry:230,fill:'url(#nebulaG)'})+
    '<path d="M0 255 C120 205 170 220 280 180 S480 205 580 145 S730 165 800 115 L800 330 L0 330Z" fill="#53608c" opacity=".09"/>'+
    '<path d="M0 315 C130 270 210 300 330 250 S570 275 800 215" fill="none" stroke="#9ca9df" stroke-opacity=".12" stroke-width="28" filter="url(#softGlow)"/>'+
    '<path d="M0 390 Q150 330 285 385 T560 365 T800 350 L800 500 L0 500Z" fill="#0a1127" opacity=".72"/>';
  for(let i=0;i<118;i++){
    const x=r()*800,y=r()*340,bright=r()>.78;
    s+=E('circle',{cx:x,cy:y,r:bright?1.5:.65,fill:bright?'#e4e9ff':'#aab8df',opacity:(r()*.48+.22).toFixed(2),filter:bright?'url(#glow)':'none'});
  }
  for(let i=0;i<4;i++){
    const x=75+i*190,y=70+(i%2)*44;
    s+=E('path',{d:`M${x} ${y} l5 9 9 5 -9 5 -5 9 -5 -9 -9 -5 9 -5Z`,fill:'#d9e5ff',opacity:.35,filter:'url(#glow)'})+
      E('circle',{cx:x+31,cy:y+17,r:1.5,fill:'#f5dba4',opacity:.7});
  }
  s+='<circle cx="700" cy="78" r="39" fill="none" stroke="#dce5ff" stroke-opacity=".12" stroke-width="1"/>'+
    E('circle',{cx:700,cy:78,r:29,fill:'url(#moonG)',filter:'url(#softGlow)',opacity:.96})+
    '<path d="M680 61 Q695 43 716 58" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>'+
    '<path d="M0 438 Q170 415 320 440 T640 428 T800 435" fill="none" stroke="#8b9bc8" stroke-opacity=".18" stroke-width="1"/>';
  return s;
};

const skyline=(m,sd=7)=>{
  const r=rng(sd),L=[...m],n=L.length,bw=Math.min(80,640/n),g=bw*.2,x0=400-n*(bw+g)/2;let s=sky(r);
  for(let k=1;k<=26;k++)s+=E('line',{x1:0,x2:800,y1:470-(k*12+10),y2:470-(k*12+10),stroke:'#ffd166','stroke-opacity':k%5?.05:.2,'stroke-dasharray':k%5?'4 4':''});
  L.forEach((c,i)=>{
    const h=idx(c)*12+10,x=x0+i*(bw+g);
    s+=E('rect',{x,y:470-h,width:bw,height:h,fill:'url(#bldgG)',stroke:'#2e396d','stroke-width':'1'});
    s+=E('polygon',{points:`${x},${470-h} ${x+bw/2},${460-h} ${x+bw},${470-h}`,fill:'#232b52'});
    for(let wy=480-h;wy<456;wy+=18)for(let wx=x+8;wx<x+bw-12;wx+=16)s+=E('rect',{x:wx,y:wy,width:7,height:9,rx:1,fill:r()<.45?'#ffd166':'#151b36',filter:r()<.45?'url(#glow)':'none'})
  });
  return wrap(s+E('rect',{y:470,width:800,height:30,fill:'#050711'}))
};

const MORSE={A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..'};
const morse=(m,sd=3)=>{
  const r=rng(sd);let s=sky(r),x=70,y=170;
  [...m].forEach(c=>{
    const code=MORSE[c],w=[...code].reduce((a,k)=>a+(k=='.'?22:44),0);
    if(x+w>740){x=70;y+=110}
    [...code].forEach(k=>{
      if(k=='.'){
        s+=E('circle',{cx:x+6,cy:y,r:6,fill:'#ffd166',filter:'url(#glow)'});x+=22
      }else{
        s+=E('rect',{x,y:y-4,width:28,height:8,rx:4,fill:'#ffd166',filter:'url(#glow)'});x+=44
      }
    });
    x+=40
  });
  return wrap(s+`<path d="M0 500 V420 Q200 370 400 420 T800 400 V500 Z" fill="#060914"/>`)
};

const compass=(m,sd=5)=>{
  const r=rng(sd);let s=sky(r);
  [...m].forEach((c,i)=>{
    const cx=110+(i%6)*116,cy=190+Math.floor(i/6)*130;
    s+=E('circle',{cx,cy,r:48,fill:'#0b0f24',stroke:'#ffd166','stroke-width':1.5,filter:'url(#glow)'});
    s+=E('circle',{cx,cy,r:44,fill:'url(#bldgG)',stroke:'#3d4785'});
    for(let k=0;k<26;k++){
      const a=k/26*2*Math.PI,x=Math.sin(a),y=-Math.cos(a);
      s+=E('line',{x1:cx+x*38,y1:cy+y*38,x2:cx+x*44,y2:cy+y*44,stroke:k?'#5c68ad':'#ff5252','stroke-width':k?1:2})
    }
    const a=(idx(c)-1)/26*2*Math.PI;
    s+=E('line',{x1:cx,y1:cy,x2:cx+Math.sin(a)*34,y2:cy-Math.cos(a)*34,stroke:'#ffd166','stroke-width':3.5,'stroke-linecap':'round',filter:'url(#glow)'})+E('circle',{cx,cy,r:4,fill:'#fff'})
  });
  return wrap(s)
};

const windows=(m,sd=11)=>{
  const r=rng(sd),L=[...m],n=L.length,bw=Math.min(70,640/n),g=bw*.2,x0=400-n*(bw+g)/2;let s=sky(r);
  L.forEach((c,i)=>{
    const x=x0+i*(bw+g),v=idx(c);
    s+=E('rect',{x,y:250,width:bw,height:220,fill:'url(#bldgG)',stroke:'#27315e','stroke-width':1});
    for(let k=0;k<5;k++){
      const on=(v>>(4-k))&1;
      s+=E('rect',{x:x+bw/2-10,y:262+k*40,width:20,height:26,rx:2,fill:on?'#ffd166':'#151c3b',filter:on?'url(#glow)':'none'})
    }
  });
  return wrap(s+E('rect',{y:470,width:800,height:30,fill:'#050711'}))
};

const BR='1,12,14,145,15,124,1245,125,24,245,13,123,134,1345,135,1234,12345,1235,234,2345,136,1236,2456,1346,13456,1356'.split(',');
const braille=(m,sd=13)=>{
  const r=rng(sd);let s=sky(r);
  [...m].forEach((c,i)=>{
    const cx=90+(i%8)*86,cy=170+Math.floor(i/8)*150,d=BR[idx(c)-1];
    s+=E('rect',{x:cx-16,y:cy-18,width:60,height:104,rx:12,fill:'#0d122b',stroke:'#2e396e'});
    for(let k=1;k<=6;k++){
      const active=d.includes(k);
      s+=E('circle',{cx:cx+(k>3?28:0),cy:cy+((k-1)%3)*34,r:10,fill:active?'#ffd166':'#182042',filter:active?'url(#glow)':'none'})
    }
  });
  return wrap(s)
};

const colour=(m,sd=17)=>{
  const r=rng(sd),L=[...m],n=L.length,sp=Math.min(100,720/n),hue=c=>`hsl(${(idx(c)-1)/26*360|0},80%,55%)`;let s=sky(r);
  let defs='<defs>';
  L.forEach((c,i)=>{
    const h=(idx(c)-1)/26*360|0;
    defs+=`<radialGradient id="bal_${i}" cx="35%" cy="35%" r="65%"><stop offset="0%" stop-color="hsl(${h},90%,80%)"/><stop offset="70%" stop-color="hsl(${h},75%,50%)"/><stop offset="100%" stop-color="hsl(${h},80%,25%)"/></radialGradient>`;
  });
  s=defs+'</defs>'+s;
  for(let k=0;k<26;k++)s+=E('circle',{cx:75+k*26.2,cy:50,r:9,fill:hue(String.fromCharCode(65+k)),filter:'url(#glow)'});
  L.forEach((c,i)=>{
    const cx=400-n*sp/2+sp/2+i*sp,cy=230+(r()*60|0),stringDx=(r()*20-10|0),h=(idx(c)-1)/26*360|0;
    s+=`<path d="M${cx} ${cy+34} Q${cx+stringDx} ${cy+120} ${cx} 470" stroke="rgba(255,255,255,0.35)" stroke-width="2" fill="none"/>`;
    s+=E('circle',{cx,cy,r:34,fill:`url(#bal_${i})`,'data-hue':h,filter:'url(#glow)'});
    s+=E('polygon',{points:`${cx-4},${cy+34} ${cx+4},${cy+34} ${cx},${cy+39}`,fill:`hsl(${h},75%,45%)`});
  });
  return wrap(s+E('rect',{y:470,width:800,height:30,fill:'#050711'}))
};



/* Additional deterministic visual ciphers: every scheme has a matching decoder. */
const countTiles=(m,sd=23)=>{
  const r=rng(sd),L=[...m],n=L.length,cell=Math.min(112,740/n),x0=(800-n*cell)/2;let s=sky(r);
  L.forEach((c,i)=>{const x=x0+i*cell+cell/2,y=250,v=idx(c);s+='<g data-cipher="count-tile">'+E('rect',{x:x-cell/2+4,y:145,width:cell-8,height:220,rx:12,fill:'#101733',stroke:'#344174'});
    for(let k=0;k<26;k++){const cx=x-30+(k%5)*15,cy=y-65+Math.floor(k/5)*25;s+=E('circle',{cx,cy,r:4.5,fill:k<v?'#ffd166':'#273258','data-cipher':'count-dot'})}s+='</g>';
  });return wrap(s)
};
const polygons=(m,sd=29)=>{
  const r=rng(sd),L=[...m],n=L.length,step=Math.min(145,700/n),x0=400-(n-1)*step/2;let s=sky(r);
  L.forEach((c,i)=>{const cx=x0+i*step,cy=260,rad=54,sides=idx(c)+2,pts=Array.from({length:sides},(_,k)=>`${(cx+Math.cos(k*2*Math.PI/sides-Math.PI/2)*rad).toFixed(2)},${(cy+Math.sin(k*2*Math.PI/sides-Math.PI/2)*rad).toFixed(2)}`).join(' ');
    s+=E('polygon',{points:pts,fill:'#28345f',stroke:'#ffd166','stroke-width':3,'data-cipher':'poly'});
  });return wrap(s)
};
const petals=(m,sd=31)=>{
  const r=rng(sd),L=[...m],n=L.length,cols=Math.min(5,n),cellW=154,cellH=158;
  const x0=(800-cols*cellW)/2+cellW/2,y0=150;let s=sky(r);
  // Every flower uses one evenly spaced ring: no stacked rings or hidden/overlapping petals.
  // Narrow tangential width keeps all 1–26 petals separately countable.
  L.forEach((c,i)=>{
    const cx=x0+(i%cols)*cellW,cy=y0+Math.floor(i/cols)*cellH,v=idx(c);
    s+='<g data-cipher="petals">';
    s+=E('circle',{cx,cy,r:4.5,fill:'#fff2c2',stroke:'#d4a84d','stroke-width':1,'data-cipher':'flower-center'});
    for(let k=0;k<v;k++){
      const a=k*2*Math.PI/v-Math.PI/2;
      const radius=39,px=cx+Math.cos(a)*radius,py=cy+Math.sin(a)*radius;
      s+=E('ellipse',{
        cx:px.toFixed(2),cy:py.toFixed(2),rx:2.2,ry:7.2,
        transform:'rotate('+((a*180/Math.PI+90).toFixed(1))+' '+px.toFixed(2)+' '+py.toFixed(2)+')',
        fill:'#ffd166',stroke:'#8f6829','stroke-width':.65,opacity:1,
        'data-cipher':'petal'
      });
    }
    s+='</g>';
  });
  return wrap(s)
};
const rhythm=(m,sd=37)=>{
  const r=rng(sd),L=[...m],n=L.length,step=Math.min(125,700/n),x0=400-(n-1)*step/2;let s=sky(r);
  L.forEach((c,i)=>{const cx=x0+i*step,v=idx(c);s+=E('rect',{x:cx-42,y:150,width:84,height:220,rx:10,fill:'#101733',stroke:'#344174'});
    for(let k=0;k<5;k++){const bit=(v>>(4-k))&1,h=bit?72:22,y=330-k*37-h;s+=E('rect',{x:cx-25+k*12,y,width:7,height:h,rx:3,fill:bit?'#ffd166':'#29345e','data-cipher':'rhythm-bit'})}
  });return wrap(s)
};

const TRAIN=[
{n:'Skyline',m:'BEE',g:skyline,s:'Building height: one building per letter, roof height = alphabet position × 12 px (the most common scheme in the study).',h:['One object per letter. Ignore the colours and look at the shapes.','Taller roof = later letter. The faint lines are one letter apart, counted from the ground (A = 1st line).']},
{n:'Morse stars',m:'HONEY',g:morse,s:'Morse code: short stars are dots, long stars are dashes, wide gaps separate letters.',h:['Two kinds of golden stars: short and long.','Dot and dash, with a wide gap between letters. Think of an old telegraph.']},
{n:'Compass',m:'NECTAR',g:compass,s:'Needle angle: each dial is one letter, angle = (alphabet position − 1) × 360/26 degrees clockwise from the red tick.',h:['One dial per letter.','26 ticks around each dial. The red tick is A, and the needle points to the letter, going clockwise.']},
{n:'Windows',m:'WAX',g:windows,s:'Binary windows: one building per letter, five windows = 5 bits (lit = 1, top to bottom), value = alphabet position.',h:['One building per letter. Look at the windows, not the roofs.','Five windows per building: lit = 1, dark = 0, read top to bottom as a binary number. A = 1, B = 2 … Z = 26.']},
{n:'Braille',m:'COMB',g:braille,s:'Braille: each 2×3 cell is one letter. Gold dots are raised dots (numbered down the left column 1-2-3, then the right column 4-5-6).',h:['Each group of six dots is a cell. Gold = raised.','This is the Braille alphabet. A = top-left dot only, B = left top and middle, C = both top dots. Check a Braille chart for the rest.']},
{n:'Colour',m:'BLOOM',g:colour,s:'Colour: each balloon hue is the letter\'s position on a 26-step hue wheel; the strip of swatches at the top is the key (A to Z, left to right).',h:['One balloon per letter. The row of swatches at the top is a key.','Match each balloon\'s colour to a swatch. The swatches run A to Z from left to right.']},
{n:'Constellation',m:'NOVA',g:countTiles,s:'Dot count: each framed cluster is one letter; count the gold dots. The full 26-position grid establishes the alphabet range.',h:['Look for repeated framed clusters.','Count only the gold dots in each cluster; A is 1, B is 2, and so on.']},
{n:'Facets',m:'GEM',g:polygons,s:'Polygon sides: each polygon is one letter; count its sides. Three sides is A, four is B, continuing upward.',h:['Each outlined shape represents one letter.','Count the edges, starting with triangle = A.']},
{n:'Bloom',m:'IRIS',g:petals,s:'Petal count: each flower represents one letter; count its petals. One petal is A.',h:['Each flower is one letter.','Count the petals, not the centre. One petal = A.']},
{n:'Rhythm',m:'BEAT',g:rhythm,s:'Binary rhythm: each framed group has five vertical bars. Tall = 1, short = 0, read left to right as a five-bit number; A = 1.',h:['Each framed group represents one letter.','Read five bars left to right: tall is 1, short is 0. Convert the binary number to A=1 through Z=26.']}];


/* ---------- SVG inspection helpers (shared by annotate and the self-test decoders) ---------- */
const INV=Object.fromEntries(Object.entries(MORSE).map(([k,v])=>[v,k])),P=x=>new DOMParser().parseFromString(x,'image/svg+xml'),L=(d,q)=>[...d.querySelectorAll(q)],CH=n=>String.fromCharCode(n);

/* ---------- reveal: highlight and label the encoded letters ---------- */
function annotate(svg,idx){const d=P(svg),root=d.documentElement,col='#ff4d6d',NS='http://www.w3.org/2000/svg';
const tag=(x,y,t)=>{const e=d.createElementNS(NS,'text');e.setAttribute('x',x);e.setAttribute('y',y);e.setAttribute('fill',col);e.setAttribute('font-size','36');e.setAttribute('font-family','monospace');e.setAttribute('font-weight','bold');e.setAttribute('text-anchor','middle');root.appendChild(e);e.textContent=t};
if(idx===0){L(d,'rect[height]').filter(r=>r.getAttribute('fill')==='url(#bldgG)'||r.getAttribute('fill')==='#10142b').forEach(r=>{const h=+r.getAttribute('height');r.setAttribute('stroke',col);r.setAttribute('stroke-width','5');r.setAttribute('stroke-dasharray','10 6');tag(+r.getAttribute('x')+ +r.getAttribute('width')/2,+r.getAttribute('y')-18,CH(64+(h-10)/12))})}
else if(idx===1){let c='',x0=0,y0=0,nx=0,py=-1;L(d,'circle[fill="#ffd166"],rect[fill="#ffd166"]').forEach(e=>{const dot=e.tagName=='circle',x=dot?+e.getAttribute('cx')-6:+e.getAttribute('x'),y=dot?+e.getAttribute('cy'):+e.getAttribute('y')+4;if(c&&(y!=py||x-nx>10)){tag(x0,y0-26,INV[c]||'?');c=''}if(!c){x0=x;y0=y}c+=dot?'.':'-';nx=x+(dot?22:44);py=y});if(c)tag(x0,y0-26,INV[c]||'?')}
else if(idx===2){L(d,'line[stroke="#ffd166"]').forEach(l=>{const a=Math.atan2(l.getAttribute('x2')-l.getAttribute('x1'),l.getAttribute('y1')-l.getAttribute('y2')),n=Math.round((a<0?a+2*Math.PI:a)/(2*Math.PI)*26)%26,hl=d.createElementNS(NS,'line');['x1','y1','x2','y2'].forEach(k=>hl.setAttribute(k,l.getAttribute(k)));hl.setAttribute('stroke',col);hl.setAttribute('stroke-width','6');hl.setAttribute('stroke-linecap','round');root.appendChild(hl);tag(+l.getAttribute('x1'),+l.getAttribute('y1')-58,CH(65+n))})}
else if(idx===3){const W=L(d,'rect[width="20"],rect[width="18"]');L(d,'rect[y="250"]').forEach((b,i)=>{const bits=W.slice(i*5,i*5+5),v=parseInt(bits.map(w=>w.getAttribute('fill')=='#ffd166'?1:0).join(''),2);bits.forEach(w=>{w.setAttribute('stroke',col);w.setAttribute('stroke-width','3')});tag(+b.getAttribute('x')+ +b.getAttribute('width')/2,+b.getAttribute('y')-14,CH(64+v))})}
else if(idx===4){const C=L(d,'circle[r="10"]');for(let i=0;i<C.length;i+=6){C.slice(i,i+6).forEach(c=>{if(c.getAttribute('fill')=='#ffd166'){c.setAttribute('stroke',col);c.setAttribute('stroke-width','4')}});tag(+C[i].getAttribute('cx'),+C[i].getAttribute('cy')-26,CH(65+BR.indexOf(C.slice(i,i+6).map((c,k)=>c.getAttribute('fill')=='#ffd166'?k+1:'').join(''))))}}
else if(idx===5){L(d,'circle[r="34"]').forEach(c=>{const h=+c.getAttribute('data-hue');c.setAttribute('stroke',col);c.setAttribute('stroke-width','5');tag(+c.getAttribute('cx'),+c.getAttribute('cy')-48,CH(65+Math.round(h*26/360)))})}
else if(idx===6){L(d,'g[data-cipher="count-tile"]').forEach(g=>{const dots=L(g,'circle[data-cipher="count-dot"]'),v=dots.filter(c=>c.getAttribute('fill')==='#ffd166').length;dots.filter(c=>c.getAttribute('fill')==='#ffd166').forEach(c=>{c.setAttribute('stroke',col);c.setAttribute('stroke-width','2')});const b=L(g,'rect')[0];tag(+b.getAttribute('x')+ +b.getAttribute('width')/2,125,CH(64+v))})}
else if(idx===7){L(d,'polygon[data-cipher="poly"]').forEach(p=>{const n=p.getAttribute('points').trim().split(/\s+/).length;p.setAttribute('stroke',col);p.setAttribute('stroke-width','7');const a=p.getAttribute('points').split(' ')[0].split(',');tag(+a[0],+a[1]-18,CH(62+n))})}
else if(idx===8){L(d,'g[data-cipher="petals"]').forEach(g=>{const es=L(g,'ellipse'),v=es.length;es.forEach(e=>{e.setAttribute('stroke',col);e.setAttribute('stroke-width','3')});const c=L(g,'circle')[0];tag(+c.getAttribute('cx'),+c.getAttribute('cy')-62,CH(64+v))})}
else if(idx===9){L(d,'rect[data-cipher="rhythm-bit"]').forEach((b,i)=>{if(b.getAttribute('fill')==='#ffd166'){b.setAttribute('stroke',col);b.setAttribute('stroke-width','3')}});L(d,'rect[width="84"]').forEach((b,i)=>{const bits=L(d,'rect[data-cipher="rhythm-bit"]').slice(i*5,i*5+5),v=parseInt(bits.map(x=>x.getAttribute('fill')==='#ffd166'?1:0).join(''),2);tag(+b.getAttribute('x')+42,125,CH(64+v))})}
return new XMLSerializer().serializeToString(root)}

export { TRAIN, MORSE, BR, INV, P, L, CH, annotate };

import{a as h,b as m}from"./DxWc3f38.js";function x(c){return c.trim()?c.replace(/<br\s*\/?>\s*/gi,`
`).replace(/<\/p>\s*<p[^>]*>/gi,`
`).replace(/<\/p>\s*/gi,`
`).replace(/<p[^>]*>\s*/gi,"").replace(/<[^>]*>/g," ").replace(/[ \t]+/g," ").replace(/\n+/g,`
`).trim().split(`
`).map(i=>i.trim()).filter(Boolean):[]}function u(c){const s=c.match(/@([a-zA-Z0-9_-]+)/g);if(!s?.length)return;const a=s.map(i=>i.slice(1).toLowerCase()).filter(i=>i!=="todo");return a[a.length-1]}function T(c,s){const a=x(c),i=a.join(`
`),l=new Map(s.map(e=>[e.text,e])),n=[],t=new Set,g=/@todo\s+([\s\S]*?)@Todo\s+ends/gi;let r;for(;(r=g.exec(i))!==null;){const e=r[1].trim();if(e&&!t.has(e)){t.add(e);const p=u(e),o=l.get(e);o?n.push({...o,assignedTo:p??o.assignedTo}):n.push(h(e,"inline",p))}}for(const e of a){const p=e.toLowerCase().indexOf("/todo");if(p===-1)continue;const o=e.slice(p+5).trim();if(o&&!t.has(o)){t.add(o);const f=u(o),d=l.get(o);d?n.push({...d,assignedTo:f??d.assignedTo}):n.push(h(o,"slash",f))}}for(const e of s)e.checked&&!t.has(e.text)&&n.push({...e});return n.length?n:s}function B(c,s){const a=x(c),i=new Map(s.map(t=>[t.text,t])),l=[],n=new Set;for(const t of a){const g=t.toLowerCase().indexOf("/agree");if(g===-1)continue;const r=t.slice(g+6).trim();r&&!n.has(r)&&(n.add(r),l.push(i.get(r)??m(r)))}return l.length?l:s}export{B as a,u as e,T as p};

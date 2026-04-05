// range-slider.js
// Optional: color the thumb based on value (0 green → 10 red). Track is always gradient.
// Usage: add class="score-range" to <input type="range"> and call initScoreRanges().

(function(){
  'use strict';

  function lerp(a,b,t){ return Math.round(a + (b-a)*t); }
  function hexToRgb(hex){
    const h = String(hex||'').replace('#','').trim();
    if(!h) return {r:39,g:215,b:155};
    const full = (h.length===3) ? h.split('').map(x=>x+x).join('') : h;
    const n = parseInt(full, 16);
    return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
  }
  function mix(c1, c2, t){
    t = Math.max(0, Math.min(1, t));
    return { r: lerp(c1.r, c2.r, t), g: lerp(c1.g, c2.g, t), b: lerp(c1.b, c2.b, t) };
  }
  function rgbStr(c){ return `rgb(${c.r},${c.g},${c.b})`; }

  function getThemeStops(){
    const cs = getComputedStyle(document.documentElement);
    const ok = cs.getPropertyValue('--ok').trim() || '#27d79b';
    const warn = cs.getPropertyValue('--warn').trim() || '#ffcc66';
    const danger = cs.getPropertyValue('--danger').trim() || '#ff5c5c';
    return { cOk: hexToRgb(ok), cWarn: hexToRgb(warn), cDanger: hexToRgb(danger) };
  }

  // Set --thumbColor based on current value. Assumes min/max numeric.
  function updateScoreRange(el){
    if(!el) return;
    const min = Number(el.min ?? 0);
    const max = Number(el.max ?? 10);
    const val = Number(el.value ?? 0);
    const mid = min + (max-min)/2;

    const { cOk, cWarn, cDanger } = getThemeStops();
    let fill;
    if(val <= mid){
      const t = (max===min) ? 0 : (val - min) / (mid - min || 1);
      fill = mix(cOk, cWarn, t);
    } else {
      const t = (max===min) ? 0 : (val - mid) / (max - mid || 1);
      fill = mix(cWarn, cDanger, t);
    }
    el.style.setProperty('--thumbColor', rgbStr(fill));
  }

  function initScoreRanges(root=document){
    root.querySelectorAll('input[type="range"].score-range').forEach(el=>{
      updateScoreRange(el);
      el.addEventListener('input', ()=>updateScoreRange(el), {passive:true});
      el.addEventListener('change', ()=>updateScoreRange(el), {passive:true});
    });
  }

  // Expose globals for your inline script
  window.updateScoreRange = updateScoreRange;
  window.initScoreRanges = initScoreRanges;
})();

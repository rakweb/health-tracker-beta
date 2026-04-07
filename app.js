'use strict';

/**
 * app.js — Health Tracker core logic
 * (Corrected version: HTML entities removed)
 */

/* ==================== PWA: SW Register, Install, Updates ==================== */
let deferredPrompt = null, swReg = null;

const installBtn = document.getElementById('btnInstall');
const checkBtn = document.getElementById('btnCheckUpdates');
const installHint = document.getElementById('installHint');
const buildNumberSpan = document.getElementById('buildNumber');
const swVersionSpan = document.getElementById('swVersion');

function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js')
    .then(reg => {
      swReg = reg;

      navigator.serviceWorker.addEventListener('message', evt => {
        if (
          evt.data?.type === 'VERSION' &&
          evt.data?.cache &&
          swVersionSpan
        ) {
          swVersionSpan.textContent = evt.data.cache;
        }
      });

      (reg.active ? Promise.resolve() : navigator.serviceWorker.ready)
        .then(sendGetVersion);

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;

        nw.addEventListener('statechange', () => {
          if (
            nw.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            showUpdateToast(reg);
          }
        });
      });
    })
    .catch(e => console.error('SW registration failed', e));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}

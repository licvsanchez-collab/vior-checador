const CACHE_NAME = 'vior-checador-v1';

// App shell — always available offline
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// face-api.js model files to cache
const MODEL_BASE = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const MODEL_FILES = [
  `${MODEL_BASE}/tiny_face_detector_model-weights_manifest.json`,
  `${MODEL_BASE}/tiny_face_detector_model-shard1`,
  `${MODEL_BASE}/face_landmark_68_tiny_model-weights_manifest.json`,
  `${MODEL_BASE}/face_landmark_68_tiny_model-shard1`,
  `${MODEL_BASE}/face_recognition_model-weights_manifest.json`,
  `${MODEL_BASE}/face_recognition_model-shard1`,
  `${MODEL_BASE}/face_recognition_model-shard2`,
];

// Install — cache static assets and models
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache static assets first (always works)
      cache.addAll(STATIC_ASSETS).catch(e => console.warn('Static cache:', e));
      // Cache models (may fail first time, will be cached on first use)
      return cache.addAll(MODEL_FILES).catch(e => console.warn('Model cache partial:', e));
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first for models and static, network first for Firebase
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase requests — always network, no cache
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com')) {
    return; // Let it fall through to network
  }

  // face-api models and static assets — cache first
  if (url.includes('justadudewhohacks') ||
      url.includes('fonts.googleapis.com') ||
      url.includes('fonts.gstatic.com') ||
      url.includes('jsdelivr.net') ||
      url.includes('cdnjs.cloudflare.com') ||
      url.endsWith('.html') ||
      url.endsWith('.json') ||
      url.endsWith('.png') ||
      url.endsWith('.js')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached); // If network fails, return cache even if stale
      })
    );
  }
});

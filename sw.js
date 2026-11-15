/*
 * Service Worker - Offline-Betrieb der Video Feedback App
 *
 * - Beim Installieren werden alle Dateien der App gespeichert.
 * - Seitenaufruf (index.html): zuerst Netzwerk, damit Updates sofort
 *   ankommen; ohne Netz die gespeicherte Version.
 * - Übrige Dateien (Logo, Manifest): aus dem Speicher, im Hintergrund
 *   aktualisiert.
 *
 * Nach Änderungen an den Dateien CACHE_VERSION erhöhen, damit alte
 * Speicherstände gelöscht werden.
 */
const CACHE_VERSION = 'video-delay-v1';
const APP_FILES = ['./', './index.html', './manifest.json', './logo.png'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

    if (req.mode === 'navigate') {
        // Netzwerk zuerst, gespeicherte Seite als Rückfall
        event.respondWith(
            fetch(req)
                .then(res => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_VERSION).then(c => c.put('./index.html', copy));
                    }
                    return res;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Speicher zuerst, im Hintergrund aktualisieren
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then(cached => {
            const network = fetch(req)
                .then(res => {
                    if (res.ok) {
                        const copy = res.clone();
                        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
                    }
                    return res;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});

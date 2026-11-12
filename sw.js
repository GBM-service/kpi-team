/* Service worker: เก็บหน้าเปลือกแอปไว้ในเครื่อง ให้เปิดแอปได้เร็วและแสดงข้อความเมื่อออฟไลน์
 * ข้อมูลจริงอยู่ใน Google Apps Script จึงต้องต่ออินเทอร์เน็ตเพื่อดู/บันทึกข้อมูล
 * เปลี่ยนไฟล์ในโฟลเดอร์นี้เมื่อไร ให้เพิ่มเลขรุ่นด้านล่าง เพื่อให้เครื่องผู้ใช้โหลดรุ่นใหม่ */
const VER = 'kpi-shell-v6';
const FILES = ['./', './index.html', './config.js', './qr.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
/* เฉพาะไฟล์ของแอปนี้: ใช้ของใหม่จากเน็ตก่อน ถ้าออฟไลน์ใช้ของที่เก็บไว้ · คำขอไป Google ปล่อยผ่านตามปกติ */
self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    const copy = res.clone();
    caches.open(VER).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
  }));
});

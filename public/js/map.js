/* Leaflet-based map module */
/* global L, showToast, escHtml */

let map = null;
let markers = {};
let userMarker = null;
let pickMarker = null;

function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: false }).setView([22.63, 120.31], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  const LocateControl = L.Control.extend({
    onAdd() {
      const btn = L.DomUtil.create('button', 'locate-btn');
      btn.innerHTML = '⊕';
      btn.title = '定位我的位置';
      L.DomEvent.on(btn, 'click', (e) => { L.DomEvent.stopPropagation(e); locateMe(); });
      return btn;
    },
  });
  new LocateControl({ position: 'topright' }).addTo(map);

  // Map click for location picking
  map.on('click', (e) => {
    if (!window.pickingLocation) return;
    window.pickingLocation = false;
    if (pickMarker) map.removeLayer(pickMarker);
    pickMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
      radius: 9, color: '#FFB800', fillColor: '#FFB800', fillOpacity: 0.9, weight: 2,
    }).addTo(map).bindPopup('回報位置').openPopup();
    window.onMapPick && window.onMapPick(e.latlng.lat, e.latlng.lng);
  });

}

function locateMe(silent = false) {
  if (!navigator.geolocation) {
    if (!silent) showToast('此裝置不支援定位');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      map.setView([lat, lng], 15);
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([lat, lng], {
        radius: 8, color: '#3498db', fillColor: '#3498db', fillOpacity: 0.85, weight: 2,
      }).addTo(map).bindPopup('你在這裡');
      if (!silent) showToast('📍 已定位到你的位置');
    },
    (err) => {
      if (silent) return;
      if (location.protocol === 'http:' && location.hostname !== 'localhost') {
        showToast('手機 HTTP 無法定位，請用回報表單內的「地圖選點」');
      } else if (err.code === 1) {
        showToast('請在瀏覽器允許位置存取後再試');
      } else {
        showToast('無法取得位置，請確認定位設定');
      }
    },
    { timeout: 8000, maximumAge: 60000 },
  );
}

function renderMapHazards(hazards, categories = []) {
  if (!map) return;

  Object.values(markers).forEach((m) => map.removeLayer(m));
  markers = {};

  hazards.forEach((h) => {
    if (h.status === 'rejected') return;
    const cat = categories.find((c) => c.id === h.categoryId);
    const emoji = h.emoji || cat?.emoji || '⚠️';
    const color = h.colors?.[0] || h.color1 || '#FF3B4E';

    const sev = h.severity || 3;
    const size = [28, 30, 34, 40, 46][sev - 1] || 34;
    const fontSize = [13, 14, 15, 17, 20][sev - 1] || 15;
    const glow = sev >= 4 ? `0 0 10px ${color}99, 0 2px 8px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.4)';
    const pulse = sev === 5 ? 'animation:marker-pulse 1.6s ease-in-out infinite;' : '';
    const icon = L.divIcon({
      html: `<div style="
        background:${color};
        width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        box-shadow:${glow};border:2px solid rgba(255,255,255,0.3);${pulse}">
        <span style="transform:rotate(45deg);font-size:${fontSize}px;">${emoji}</span>
      </div>`,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size],
    });

    const marker = L.marker([h.lat, h.lng], { icon }).addTo(map);
    marker.on('click', () => {
      map.flyTo([h.lat, h.lng], Math.max(map.getZoom(), 17), { duration: 0.5 });
    });
    markers[h.id] = marker;
  });
}

function invalidateMapSize() {
  if (map) map.invalidateSize();
}

function panTo(lat, lng, zoom = 15) {
  if (map) map.setView([lat, lng], zoom);
}

function setPickingMode(on) {
  document.getElementById('map')?.classList.toggle('picking', on);
}

function getMapCenter() {
  if (!map) return null;
  const c = map.getCenter();
  return { lat: c.lat, lng: c.lng };
}

window.initMap = initMap;
window.locateMe = locateMe;
window.panTo = panTo;
window.renderMapHazards = renderMapHazards;
window.invalidateMapSize = invalidateMapSize;
window.setPickingMode = setPickingMode;
window.getMapCenter = getMapCenter;

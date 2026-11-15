/* Blue Marble Next Generation data courtesy of Reto Stöckli (NASA/GSFC)
   and NASA's Earth Observatory. Surface and clouds from NASA/Goddard Space
   Flight Center Scientific Visualization Studio: https://svs.gsfc.nasa.gov/3615/
   The camera, rotation, and illumination are illustrative. */
(() => {
  'use strict';

  const radians = Math.PI / 180;
  const framesPerSecond = 24;

  // Cache the inverse orthographic projection and lighting. Only longitude
  // changes between frames, so the same terminator stays under the same sun.
  function createSurface(canvas, map, size) {
    const texture = document.createElement('canvas');
    const width = texture.width = map.naturalWidth;
    const height = texture.height = map.naturalHeight;
    const sampler = texture.getContext('2d', {willReadFrequently: true});
    sampler.drawImage(map, 0, 0);
    const pixels = sampler.getImageData(0, 0, width, height).data;
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const frame = context.createImageData(size, size);
    const output = frame.data;
    const count = size * size;
    const rows = new Int32Array(count).fill(-1);
    const longitude = new Float32Array(count);
    const shade = new Float32Array(count);
    const rim = new Float32Array(count);
    const radius = size / 2 - 2;
    const tilt = 13 * radians, latitude = 15 * radians;
    const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
    const cosLatitude = Math.cos(latitude), sinLatitude = Math.sin(latitude);

    for (let i = 0; i < count; i++) {
      const x = (i % size + .5 - size / 2) / radius;
      const y = (size / 2 - Math.floor(i / size) - .5) / radius;
      const distance = Math.sqrt(x * x + y * y);
      const coverage = Math.min(1, .5 + (1 - distance) * radius);
      if (coverage <= 0) continue;
      const z = Math.sqrt(Math.max(0, 1 - distance * distance));
      const east = cosTilt * x + sinTilt * y;
      const north = -sinTilt * x + cosTilt * y;
      const worldY = Math.max(-1, Math.min(1, north * cosLatitude + z * sinLatitude));
      const worldZ = z * cosLatitude - north * sinLatitude;
      const sourceY = Math.round(height * (.5 - Math.asin(worldY) / Math.PI) - .5);
      rows[i] = Math.min(height - 1, Math.max(0, sourceY)) * width;
      longitude[i] = width * (.5 + Math.atan2(east, worldZ) / (2 * Math.PI)) - .5;
      const sun = Math.sqrt(Math.max(0, Math.min(1, -.71 * x + .27 * y + .65 * z)));
      shade[i] = .048 + 1.1 * sun;
      rim[i] = (1 - z) ** 3 * (.16 + .84 * sun);
      output[4 * i + 3] = Math.round(255 * coverage);
    }

    return function draw(centerLongitude) {
      const offset = width * (2 + centerLongitude / 360);
      for (let i = 0; i < count; i++) {
        if (rows[i] < 0) continue;
        const u = longitude[i] + offset;
        const integer = Math.floor(u);
        const fraction = u - integer;
        const column = integer % width;
        const from = 4 * (rows[i] + column);
        const to = 4 * (rows[i] + (column + 1) % width);
        const lit = shade[i], atmosphere = rim[i];
        const p = 4 * i;
        output[p] = (pixels[from] + (pixels[to] - pixels[from]) * fraction) * lit + atmosphere * 52 + 1;
        output[p + 1] = (pixels[from + 1] + (pixels[to + 1] - pixels[from + 1]) * fraction) * lit + atmosphere * 135 + 3;
        output[p + 2] = (pixels[from + 2] + (pixels[to + 2] - pixels[from + 2]) * fraction) * lit + atmosphere * 207 + 5;
      }
      context.putImageData(frame, 0, 0);
    };
  }

  function mount(figure) {
    const canvas = figure?.querySelector('.earth-surface');
    const button = figure?.querySelector('.earth-toggle');
    if (!canvas || !button || location.protocol === 'file:' ||
        !window.IntersectionObserver || !window.matchMedia) return () => {};

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!preference.addEventListener) return () => {};
    const disc = canvas.parentElement;
    const poster = figure.querySelector('.earth-poster');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'earth-scrub';
    slider.min = '-180';
    slider.max = '180';
    slider.step = '1';
    slider.setAttribute('aria-label', 'Earth center longitude');
    slider.title = 'Drag to rotate Earth. Use the arrow keys for one degree at a time.';
    const readout = document.createElement('span');
    readout.className = 'earth-longitude';
    readout.setAttribute('aria-hidden', 'true');
    canvas.after(slider);
    figure.append(readout);

    const map = new Image();
    map.decoding = 'async';
    let draw, timer, lastTime, drag, scrubFrame, pendingSetup, resizeTimer;
    let disposed = false, visible = false, manuallyPaused = false, optedIn = false;
    let center = 20, displayedDegree, mapRequested = false;

    const isPaused = () => manuallyPaused || (preference.matches && !optedIn);

    function wrapLongitude(degrees) {
      if (degrees >= -180 && degrees <= 180) return degrees;
      return ((degrees + 180) % 360 + 360) % 360 - 180;
    }

    function updateCoordinates() {
      const degree = Math.round(center);
      if (degree === displayedDegree) return;
      displayedDegree = degree;
      slider.value = String(degree);
      const direction = degree === 0 ? '' : degree > 0 ? 'east' : 'west';
      slider.setAttribute('aria-valuetext', (Math.abs(degree) + ' degrees ' + direction).trim());
      readout.textContent = Math.abs(degree) + '°' + (direction ? ' ' + direction[0].toUpperCase() : '');
    }

    function requestMap() {
      if (mapRequested) return;
      mapRequested = true;
      map.src = 'earth-map.webp';
    }

    function surfaceSize() {
      const scale = Math.min(window.devicePixelRatio || 1, 1.3);
      return Math.min(560, Math.max(8, Math.round(disc.clientWidth * scale)));
    }

    function cancelSetup() {
      if (pendingSetup === undefined) return;
      if (window.requestIdleCallback) window.cancelIdleCallback(pendingSetup);
      else clearTimeout(pendingSetup);
      pendingSetup = undefined;
    }

    function prepareSurface() {
      pendingSetup = undefined;
      if (disposed || !figure.isConnected) return cleanup();
      if (!visible || document.hidden) return;
      try {
        const size = surfaceSize();
        if (!draw || canvas.width !== size) {
          draw = createSurface(canvas, map, size);
          draw(center);
          figure.classList.add('earth-ready');
        }
        sync();
      } catch {
        cleanup();
      }
    }

    function scheduleSetup() {
      if (disposed || !visible || document.hidden || !map.complete || !map.naturalWidth || pendingSetup !== undefined) return;
      pendingSetup = window.requestIdleCallback
        ? window.requestIdleCallback(prepareSurface, {timeout: 300})
        : setTimeout(prepareSurface, 0);
    }

    function resize() {
      if (!mapRequested) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(scheduleSetup, 150);
    }

    function stop() {
      clearTimeout(timer);
      timer = undefined;
      lastTime = undefined;
    }

    function step() {
      timer = undefined;
      if (!figure.isConnected || disposed) return cleanup();
      const time = performance.now();
      if (lastTime !== undefined) center = wrapLongitude(center - Math.min(time - lastTime, 150) * 360 / 150000);
      lastTime = time;
      try {
        draw(center);
        updateCoordinates();
      } catch {
        return cleanup();
      }
      const delay = Math.max(0, 1000 / framesPerSecond - (performance.now() - time));
      timer = setTimeout(step, delay);
    }

    function sync() {
      if (disposed) return;
      const paused = isPaused();
      button.textContent = paused ? 'Play rotation' : 'Pause rotation';
      button.dataset.paused = String(paused);
      button.hidden = false;
      if (!visible || document.hidden) {
        cancelSetup();
        stop();
        return;
      }
      // When the still image is unavailable, draw one map frame even for a
      // reduced-motion visitor. The pause state continues to control rotation.
      if (poster && poster.complete && !poster.naturalWidth && !mapRequested) requestMap();
      if (mapRequested && map.naturalWidth && (!draw || canvas.width !== surfaceSize())) scheduleSetup();
      if (paused) {
        stop();
      } else if (!mapRequested) requestMap();
      else if (draw && timer === undefined) {
        lastTime = performance.now();
        timer = setTimeout(step, 1000 / framesPerSecond);
      }
    }

    function toggle() {
      if (isPaused()) {
        manuallyPaused = false;
        optedIn = preference.matches;
      } else {
        manuallyPaused = true;
        optedIn = false;
      }
      sync();
    }

    function motionChange() {
      optedIn = false;
      sync();
    }

    function pauseForInput() {
      manuallyPaused = true;
      optedIn = false;
      sync();
    }

    function scrubTo(degrees) {
      center = wrapLongitude(degrees);
      updateCoordinates();
      requestMap();
      if (draw && scrubFrame === undefined) {
        scrubFrame = requestAnimationFrame(() => {
          scrubFrame = undefined;
          try { draw(center); } catch { cleanup(); }
        });
      }
    }

    function rangeInput() {
      const degrees = slider.valueAsNumber;
      pauseForInput();
      scrubTo(degrees);
    }

    function pointerDown(event) {
      if (drag || !event.isPrimary || event.button !== 0) return;
      // Use relative motion so grabbing a continent never jumps to another one.
      event.preventDefault();
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, center, active: false};
      disc.setPointerCapture(event.pointerId);
    }

    function pointerMove(event) {
      if (drag?.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      if (!drag.active) {
        if (Math.abs(dx) < 3 || Math.abs(dx) < Math.abs(event.clientY - drag.y)) return;
        drag.active = true;
        slider.focus({preventScroll: true});
        pauseForInput();
      }
      const diameter = disc.getBoundingClientRect().width;
      if (diameter) scrubTo(Math.round(drag.center - dx * 180 / diameter));
    }

    function pointerEnd(event) {
      if (drag?.id !== event.pointerId) return;
      drag = undefined;
      if (disc.hasPointerCapture(event.pointerId)) disc.releasePointerCapture(event.pointerId);
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });

    function cleanup() {
      if (disposed) return;
      disposed = true;
      stop();
      cancelSetup();
      clearTimeout(resizeTimer);
      cancelAnimationFrame(scrubFrame);
      if (drag && disc.hasPointerCapture(drag.id)) disc.releasePointerCapture(drag.id);
      observer.disconnect();
      poster?.removeEventListener('error', sync);
      button.removeEventListener('click', toggle);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', resize);
      preference.removeEventListener('change', motionChange);
      canvas.removeEventListener('contextlost', cleanup);
      slider.removeEventListener('input', rangeInput);
      slider.removeEventListener('focus', pauseForInput);
      disc.removeEventListener('pointerdown', pointerDown);
      disc.removeEventListener('pointermove', pointerMove);
      disc.removeEventListener('pointerup', pointerEnd);
      disc.removeEventListener('pointercancel', pointerEnd);
      disc.removeEventListener('lostpointercapture', pointerEnd);
      slider.remove();
      readout.remove();
      map.onload = map.onerror = null;
      draw = null;
      figure.classList.remove('earth-ready');
      button.hidden = true;
    }

    map.onload = scheduleSetup;
    map.onerror = cleanup;
    updateCoordinates();
    slider.addEventListener('input', rangeInput);
    slider.addEventListener('focus', pauseForInput);
    disc.addEventListener('pointerdown', pointerDown);
    disc.addEventListener('pointermove', pointerMove);
    disc.addEventListener('pointerup', pointerEnd);
    disc.addEventListener('pointercancel', pointerEnd);
    disc.addEventListener('lostpointercapture', pointerEnd);
    observer.observe(figure);
    canvas.addEventListener('contextlost', cleanup);
    poster?.addEventListener('error', sync);
    button.addEventListener('click', toggle);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', resize);
    preference.addEventListener('change', motionChange);
    sync();
    return cleanup;
  }

  window.FFEarth = {mount};
})();

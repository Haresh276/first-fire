'use strict';

window.FFDeskHome = function (root) {
  root.innerHTML = `
    <section class="ff-cinema-home" aria-labelledby="ff-title">
      <div class="ff-cinema-lead">
        <p class="ff-cinema-topic">Spacecraft fire research</p>
        <h1 id="ff-title">Flame in <span>Freefall</span></h1>
        <p class="ff-cinema-description">Ask about a NASA fire experiment or find a lab to test an idea.</p>
      </div>
      <div data-home-chat></div>
      <figure class="earth-figure ff-cinema-earth">
        <div class="earth-disc">
          <img class="earth-poster" src="earth-poster.webp" width="720" height="720" alt="Sunlight over Earth" fetchpriority="high">
          <canvas class="earth-surface" aria-hidden="true"></canvas>
        </div>
        <figcaption class="earth-credit"><a href="https://svs.gsfc.nasa.gov/3615/" aria-label="Earth imagery from NASA’s Scientific Visualization Studio" target="_blank" rel="noopener noreferrer">Earth imagery · NASA / SVS</a></figcaption>
        <button class="earth-toggle" type="button" hidden>Pause rotation</button>
      </figure>
    </section>`;
  const figure=root.querySelector('.earth-figure');
  let disposed=false,stop;
  window.FFLoadAsset('earth.js').then(()=>{
    if(!disposed && figure.isConnected)stop=window.FFEarth?.mount(figure);
  }).catch(()=>{}); // The NASA poster remains available without rotation.
  return ()=>{disposed=true;stop?.();};
};

(() => {
  const figure = document.querySelector('.earth-figure');
  let dispose;
  function mount() {
    if (figure && !dispose) dispose = window.FFEarth?.mount(figure);
  }
  window.addEventListener('pagehide', () => {
    dispose?.();
    dispose = undefined;
  });
  window.addEventListener('pageshow', mount);
  mount();
})();

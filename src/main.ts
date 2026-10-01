const canvas = document.getElementById('screen') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  if (ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

window.addEventListener('resize', resize);
resize();

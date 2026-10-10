import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

// Dev-only: POST a PNG data URL to /__snap?name=foo to save it in .snaps/foo.png.
// Lets tooling capture exact frames from the running game.
function snapshots() {
  return {
    name: 'snapshots',
    configureServer(server) {
      server.middlewares.use('/__snap', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'snap').replace(/[^\w-]/g, '');
          mkdirSync('.snaps', { recursive: true });
          writeFileSync(`.snaps/${name}.png`, Buffer.from(body.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  server: { port: 5180, strictPort: true },
  plugins: [snapshots()],
});

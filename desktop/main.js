const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let server;
let serverUrl;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8'
};

function createLocalServer() {
  const routes = [
    { prefix: '/vendor/ffmpeg/', folder: path.join(__dirname, 'node_modules', '@ffmpeg', 'ffmpeg', 'dist', 'esm') },
    { prefix: '/vendor/core/', folder: path.join(__dirname, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm') }
  ];

  server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      return res.end('Method Not Allowed');
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch {
      res.writeHead(400);
      return res.end('Bad Request');
    }

    let filePath;

    if (pathname === '/') {
      filePath = path.join(__dirname, 'index.html');
    } else {
      const route = routes.find(item => pathname.startsWith(item.prefix));

      if (!route) {
        res.writeHead(404);
        return res.end('Not Found');
      }

      const relativePath = pathname.slice(route.prefix.length);
      const baseFolder = path.resolve(route.folder);
      filePath = path.resolve(baseFolder, relativePath);

      if (!filePath.startsWith(baseFolder + path.sep)) {
        res.writeHead(403);
        return res.end('Forbidden');
      }
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404);
        return res.end('Not Found');
      }

      const contentType = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store'
      });

      if (req.method === 'HEAD') return res.end();

      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      stream.pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      serverUrl = `http://127.0.0.1:${server.address().port}/`;
      resolve();
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 850,
    minWidth: 800,
    minHeight: 650,
    title: 'Dandelion Message Notes',
    backgroundColor: '#12518e',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.loadURL(serverUrl);
}

app.whenReady().then(async () => {
  await createLocalServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(error => {
  console.error('Failed to start Dandelion:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) server.close();
});

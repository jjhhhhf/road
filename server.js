const os   = require('os');
const http = require('http');
const { openDb, DB_FILE, DEMO_DB_FILE } = require('./src/db/index');
const createApp = require('./src/app');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const IS_RENDER = !!process.env.RENDER;

(async () => {
  const { db: realDb, persist: realPersist } = await openDb(DB_FILE);
  const { db: demoDb, persist: demoPersist } = await openDb(DEMO_DB_FILE, { withDemoData: true });
  const app = createApp(realDb, realPersist, demoDb, demoPersist);

  http.createServer(app).listen(PORT, '0.0.0.0', () => {
    if (IS_RENDER) {
      console.log(`Server running on port ${PORT}`);
    } else {
      console.log('\nRoad Hazard Map ready:');
      console.log(`  http://localhost:${PORT}`);
      for (const [name, ifaces] of Object.entries(os.networkInterfaces()))
        for (const iface of ifaces)
          if (iface.family === 'IPv4' && !iface.internal)
            console.log(`  [${name}] http://${iface.address}:${PORT}`);
      console.log('\n  For mobile GPS: see Mobile Tunnel window\n');
    }
  });
})();

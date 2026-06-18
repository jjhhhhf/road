const os = require('os');
const { openDb, DB_FILE, DEMO_DB_FILE } = require('./src/db/index');
const createApp = require('./src/app');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

(async () => {
  const { db: realDb, persist: realPersist } = await openDb(DB_FILE);
  const { db: demoDb, persist: demoPersist } = await openDb(DEMO_DB_FILE, { withDemoData: true });

  const app = createApp(realDb, realPersist, demoDb, demoPersist);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`本機：http://localhost:${PORT}`);
    for (const [name, ifaces] of Object.entries(os.networkInterfaces())) {
      for (const iface of ifaces) {
        if (iface.family === 'IPv4' && !iface.internal)
          console.log(`  [${name}] http://${iface.address}:${PORT}`);
      }
    }
  });
})();

const localtunnel = require('localtunnel');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

(async () => {
  console.log('Connecting tunnel...');
  let tunnel;
  try {
    tunnel = await localtunnel({ port: PORT });
  } catch (e) {
    console.error('Tunnel failed:', e.message);
    process.exit(1);
  }

  console.log('');
  console.log('==================================================');
  console.log('  Mobile URL (GPS works):');
  console.log('  ' + tunnel.url);
  console.log('==================================================');
  console.log('');
  console.log('  Step 1: Open the URL above on your phone');
  console.log('  Step 2: You will see a verification page');
  console.log('          -> Just tap the [Submit] button');
  console.log('  Step 3: Site opens, GPS works!');
  console.log('');
  console.log('  Press Ctrl+C to stop tunnel.');
  console.log('');

  tunnel.on('close', () => console.log('Tunnel closed.'));
  tunnel.on('error', e => console.error('Tunnel error:', e.message));
})();

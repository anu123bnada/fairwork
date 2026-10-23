import { createConnection } from 'node:net';

// Probe TCP, not HTTP: a compiling Next route may take longer than one second.
// A timeout or unexpected error must not be mistaken for an unused port.
export async function assertNoCompetingDevServer(port, message) {
  await new Promise((resolve, reject) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = error => { socket.destroy(); if (error) reject(error); else resolve(); };
    socket.setTimeout(2000);
    socket.once('connect', () => finish(new Error(message)));
    socket.once('timeout', () => finish(new Error('Local development port status is uncertain; refusing another server.')));
    socket.once('error', error => finish(error.code === 'ECONNREFUSED' ? undefined : new Error('Cannot verify the competing local development port; no server started.')));
  });
}

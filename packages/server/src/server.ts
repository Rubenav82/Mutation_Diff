import { createApp } from './app.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

createApp().listen(PORT, () => {
  console.log(`MutaDiff server listening on http://localhost:${PORT}`);
});

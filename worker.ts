import { createRequestHandler, type RequestHandler } from 'expo-server/adapter/workerd';

import { setWorkerEnv } from './src/server/env';

const handler: RequestHandler = createRequestHandler({ build: './dist/server' });

export default {
  fetch(request: Request, env: unknown, ctx: Parameters<RequestHandler>[2]) {
    // Bindingi żyją tylko w tym wywołaniu — patrz src/server/env.ts.
    setWorkerEnv(env);
    return handler(request, env, ctx);
  },
};

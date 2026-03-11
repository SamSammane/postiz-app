import { Redis } from 'ioredis';

// Create a mock Redis implementation for testing environments
class MockRedis {
  private data: Map<string, any> = new Map();

  async get(key: string) {
    return this.data.get(key);
  }

  async set(key: string, value: any) {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string) {
    this.data.delete(key);
    return 1;
  }

  pipeline() {
    const commands: Array<{ method: string; args: any[] }> = [];
    const pipe = {
      set: (...args: any[]) => { commands.push({ method: 'set', args }); return pipe; },
      del: (...args: any[]) => { commands.push({ method: 'del', args }); return pipe; },
      get: (...args: any[]) => { commands.push({ method: 'get', args }); return pipe; },
      exec: async () => {
        const results: any[] = [];
        for (const cmd of commands) {
          const result = await (this as any)[cmd.method](...cmd.args);
          results.push([null, result]);
        }
        return results;
      },
    };
    return pipe;
  }
}

// Use real Redis if REDIS_URL is defined, otherwise use MockRedis
export const ioRedis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
    })
  : (new MockRedis() as unknown as Redis); // Type cast to Redis to maintain interface compatibility

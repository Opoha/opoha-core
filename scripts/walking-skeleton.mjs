#!/usr/bin/env node
/**
 * H-01 MVP + G-02 Commerce Core walking skeleton (core slice).
 *
 * Proves: docker deps → migrate → seed → boot → health → staff login → me
 *   → catalog product+variant → inventory → cart → prepareCheckout → placeOrder.
 * When sibling CLI + plugin paths exist (local multi-repo), also:
 *   opoha plugin install, plugin GraphQL probe, opoha doctor.
 *
 * Full multi-repo path (create-opoha + admin UI) is documented in README;
 * this script is the automated CI/local gate for the runtime spine.
 *
 * Env:
 *   BASE_URL          default http://127.0.0.1:4000
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  (from .env or process)
 *   SKIP_DOCKER=1     skip `docker compose up`
 *   SKIP_PLUGIN=1     skip plugin install / GraphQL probe
 *   SKIP_DOCTOR=1     skip opoha doctor
 *   SKIP_COMMERCE=1   skip catalog→order smoke (G-02)
 *   WALKING_SKELETON_PORT  override listen port for spawned core (default 4000)
 */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SIBLING = resolve(ROOT, '..');

const BASE_URL = (process.env.BASE_URL ?? 'http://127.0.0.1:4000').replace(
  /\/$/,
  '',
);
const PORT = process.env.WALKING_SKELETON_PORT ?? process.env.PORT ?? '4000';
const SKIP_DOCKER = process.env.SKIP_DOCKER === '1';
const SKIP_PLUGIN = process.env.SKIP_PLUGIN === '1';
const SKIP_DOCTOR = process.env.SKIP_DOCTOR === '1';
const SKIP_COMMERCE = process.env.SKIP_COMMERCE === '1';

const PLUGIN_PATH = join(SIBLING, 'plugin-manual-payment');
const CLI_BIN = join(SIBLING, 'opoha-cli', 'dist', 'cli.js');

function log(step, msg) {
  console.log(`[walking-skeleton] ${step}: ${msg}`);
}

function fail(step, msg) {
  console.error(`[walking-skeleton] FAIL ${step}: ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const cwd = opts.cwd ?? ROOT;
  try {
    execFileSync(cmd, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, ...opts.env },
    });
  } catch (err) {
    if (
      cmd === 'pnpm' &&
      args[0] === 'install' &&
      args.includes('--frozen-lockfile')
    ) {
      log('deps', 'frozen-lockfile failed; retrying without');
      execFileSync('pnpm', ['install'], {
        cwd,
        stdio: 'inherit',
        env: { ...process.env, ...opts.env },
      });
      return;
    }
    throw err;
  }
}

function loadDotEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function waitFor(url, { attempts = 60, delayMs = 1000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(delayMs);
  }
  fail('boot', `timed out waiting for ${url}`);
}

async function gql(query, variables, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    fail('graphql', `${res.status} ${JSON.stringify(json.errors ?? json)}`);
  }
  return json.data;
}

function ensureEnvFile(dot) {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    const example = join(ROOT, '.env.example');
    if (!existsSync(example)) fail('env', 'missing .env and .env.example');
    copyFileSync(example, envPath);
    log('env', 'copied .env.example → .env');
  }
  const email =
    process.env.SEED_ADMIN_EMAIL ??
    dot.SEED_ADMIN_EMAIL ??
    'admin@example.com';
  const password =
    process.env.SEED_ADMIN_PASSWORD ??
    dot.SEED_ADMIN_PASSWORD ??
    'change-me-in-local-dev';
  return { email, password };
}

async function main() {
  log('start', `root=${ROOT}`);

  if (!SKIP_DOCKER) {
    log('docker', 'compose up -d');
    run('docker', ['compose', 'up', '-d']);
  } else {
    log('docker', 'skipped (SKIP_DOCKER=1)');
  }

  const dot = loadDotEnv();
  const { email, password } = ensureEnvFile(dot);

  log('deps', 'pnpm install');
  run('pnpm', ['install', '--frozen-lockfile']);

  log('build', 'tsc');
  run('pnpm', ['build']);

  log('migrate', 'TypeORM migration:run');
  run('pnpm', ['db:migrate']);

  log('seed', 'db:seed');
  run('pnpm', ['db:seed'], {
    env: {
      SEED_ADMIN_EMAIL: email,
      SEED_ADMIN_PASSWORD: password,
    },
  });

  const pluginEnv =
    !SKIP_PLUGIN && existsSync(PLUGIN_PATH)
      ? { OPOHA_PLUGINS: PLUGIN_PATH }
      : {};

  if (pluginEnv.OPOHA_PLUGINS) {
    log('plugin', `OPOHA_PLUGINS=${PLUGIN_PATH}`);
    if (!existsSync(join(PLUGIN_PATH, 'dist', 'index.js'))) {
      log('plugin', 'building plugin-manual-payment');
      run('pnpm', ['install'], { cwd: PLUGIN_PATH });
      run('pnpm', ['build'], { cwd: PLUGIN_PATH });
    }
  }

  log('boot', `starting core on :${PORT}`);
  const child = spawn('node', ['dist/main.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...dot,
      PORT,
      SEED_ADMIN_EMAIL: email,
      SEED_ADMIN_PASSWORD: password,
      ...pluginEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrBuf = '';
  child.stderr.on('data', (b) => {
    stderrBuf += b.toString();
  });
  child.stdout.on('data', () => {});

  const shutdown = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };
  process.on('exit', shutdown);
  process.on('SIGINT', () => {
    shutdown();
    process.exit(130);
  });

  try {
    await waitFor(`${BASE_URL}/health/live`);
    log('health', 'live OK');

    const ready = await fetch(`${BASE_URL}/health/ready`);
    if (!ready.ok) {
      fail('health', `ready status ${ready.status}\n${stderrBuf}`);
    }
    log('health', 'ready OK');

    const loginData = await gql(
      `mutation($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          accessToken
          user { id email }
        }
      }`,
      { email, password },
    );
    const token = loginData.login.accessToken;
    if (!token) fail('auth', 'no accessToken');
    log('auth', `login OK (${loginData.login.user.email})`);

    const meData = await gql(`query { me { id email } }`, undefined, token);
    if (meData.me.email !== email) {
      fail('auth', `me email mismatch: ${meData.me.email}`);
    }
    log('auth', 'me OK');

    if (!SKIP_COMMERCE) {
      const stamp = Date.now().toString(36);
      const slug = `ws-smoke-${stamp}`;
      const sku = `WS-SKU-${stamp}`;

      log('commerce', 'createProduct + variant');
      const productData = await gql(
        `mutation($input: CreateProductInput!) {
          createProduct(input: $input) {
            id
            slug
            variants { id sku priceMinor }
          }
        }`,
        {
          input: {
            name: `Walking Skeleton ${stamp}`,
            slug,
            description: 'G-02 commerce smoke product',
            variants: [
              {
                sku,
                name: 'Default',
                priceMinor: '1500',
                currencyCode: 'USD',
              },
            ],
          },
        },
        token,
      );
      const variantId = productData.createProduct?.variants?.[0]?.id;
      if (!variantId) {
        fail('commerce', 'createProduct returned no variant id');
      }
      log('commerce', `product ${productData.createProduct.id} variant ${variantId}`);

      log('commerce', 'createInventoryItem');
      const invData = await gql(
        `mutation($input: CreateInventoryItemInput!) {
          createInventoryItem(input: $input) {
            id
            variantId
            quantityOnHand
            quantityAvailable
          }
        }`,
        { input: { variantId, quantityOnHand: 5 } },
        token,
      );
      if (invData.createInventoryItem.quantityOnHand !== 5) {
        fail(
          'commerce',
          `unexpected on-hand ${invData.createInventoryItem.quantityOnHand}`,
        );
      }

      log('commerce', 'createCart + addCartLine');
      const cartData = await gql(
        `mutation {
          createCart(input: { currencyCode: "USD" }) { id status currencyCode }
        }`,
        undefined,
        token,
      );
      const cartId = cartData.createCart.id;
      await gql(
        `mutation($input: AddCartLineInput!) {
          addCartLine(input: $input) {
            id
            lines { id variantId quantity }
          }
        }`,
        { input: { cartId, variantId, quantity: 1 } },
        token,
      );

      log('commerce', 'prepareCheckout');
      const checkoutData = await gql(
        `mutation($cartId: ID!) {
          prepareCheckout(cartId: $cartId) {
            cartId
            reservationIds
            totals { totalMinor currencyCode }
            cart { status }
          }
        }`,
        { cartId },
        token,
      );
      if (!checkoutData.prepareCheckout.reservationIds?.length) {
        fail('commerce', 'prepareCheckout produced no reservations');
      }
      if (checkoutData.prepareCheckout.cart.status !== 'locked') {
        fail(
          'commerce',
          `cart not locked after prepareCheckout (status=${checkoutData.prepareCheckout.cart.status})`,
        );
      }

      log('commerce', 'placeOrder (manual)');
      const orderData = await gql(
        `mutation($input: PlaceOrderInput!) {
          placeOrder(input: $input) {
            id
            status
            cartId
            totalMinor
            lines { variantId quantity }
          }
        }`,
        { input: { cartId, paymentMethod: 'manual' } },
        token,
      );
      const order = orderData.placeOrder;
      if (!order?.id) fail('commerce', 'placeOrder returned no order id');
      if (order.status !== 'confirmed') {
        fail('commerce', `expected confirmed order, got ${order.status}`);
      }
      log(
        'commerce',
        `order ${order.id} status=${order.status} total=${order.totalMinor} OK`,
      );
    } else {
      log('commerce', 'skipped (SKIP_COMMERCE=1)');
    }

    if (!SKIP_PLUGIN && existsSync(CLI_BIN) && existsSync(PLUGIN_PATH)) {
      log('plugin', 'opoha plugin install');
      run('node', [CLI_BIN, 'plugin', 'install', PLUGIN_PATH], {
        cwd: ROOT,
      });

      const pluginRes = await fetch(`${BASE_URL}/graphql`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: 'query { manualPaymentConfig }' }),
      });
      const pluginJson = await pluginRes.json();
      if (pluginJson.errors?.length) {
        log(
          'plugin',
          `manualPaymentConfig not resolvable yet (OK if enable required): ${JSON.stringify(pluginJson.errors[0]?.message)}`,
        );
      } else {
        log(
          'plugin',
          `manualPaymentConfig → ${JSON.stringify(pluginJson.data?.manualPaymentConfig)}`,
        );
      }
    } else {
      log('plugin', 'skipped (no CLI/plugin path or SKIP_PLUGIN=1)');
    }

    if (!SKIP_DOCTOR && existsSync(CLI_BIN)) {
      log('doctor', 'opoha doctor');
      run('node', [CLI_BIN, 'doctor'], { cwd: ROOT });
    } else {
      log('doctor', 'skipped');
    }

    log('done', 'walking skeleton green');
  } finally {
    shutdown();
    await sleep(500);
    if (stderrBuf && process.env.WALKING_SKELETON_DEBUG === '1') {
      console.error(stderrBuf);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

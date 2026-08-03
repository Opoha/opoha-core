#!/usr/bin/env node
/**
 * H-01 MVP + Phase 1 G-02 commerce + Phase 2 G-02 commerce-ops walking skeleton.
 *
 * Proves: docker deps → migrate → seed → boot → health → staff login → me
 *   → catalog product+variant → inventory → cart
 *   → (ops) select shipping + tax context → prepareCheckout → placeOrder (payment).
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
 *   SKIP_COMMERCE_OPS=1  skip payment+shipping+tax assertions (Phase 2 G-02)
 *   OPOHA_FLAT_RATE_AMOUNT / OPOHA_TAX_STANDARD_DEFAULT_RATE_BPS  ops smoke defaults
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
const SKIP_COMMERCE_OPS = process.env.SKIP_COMMERCE_OPS === '1';

/** Phase 2 G-02 ops plugins (payment + shipping + tax). */
const OPS_PLUGIN_DIRS = [
  'plugin-manual-payment',
  'plugin-shipping-flat-rate',
  'plugin-tax-standard',
];
const PLUGIN_PATH = join(SIBLING, 'plugin-manual-payment');
const FLAT_RATE_PLUGIN_PATH = join(SIBLING, 'plugin-shipping-flat-rate');
const TAX_STANDARD_PLUGIN_PATH = join(SIBLING, 'plugin-tax-standard');
const CLI_BIN = join(SIBLING, 'opoha-cli', 'dist', 'cli.js');

const OPS_FLAT_RATE_AMOUNT = process.env.OPOHA_FLAT_RATE_AMOUNT ?? '500';
const OPS_TAX_RATE_BPS = process.env.OPOHA_TAX_STANDARD_DEFAULT_RATE_BPS ?? '1000';

function resolveOpsPluginPaths() {
  return OPS_PLUGIN_DIRS.map((name) => join(SIBLING, name)).filter((p) =>
    existsSync(p),
  );
}

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

function ensurePluginBuilt(pluginRoot) {
  // Always rebuild so ops smoke is not tripped by stale dist (e.g. Phase 2
  // authorize/capture added after an older dist/index.js existed).
  log('plugin', `building ${pluginRoot}`);
  run('pnpm', ['install'], { cwd: pluginRoot });
  run('pnpm', ['build'], { cwd: pluginRoot });
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

  // Clear plugin settings so env bootstrap (amount/rate) is not overridden by stale rows.
  try {
    const databaseUrl =
      process.env.DATABASE_URL ?? dot.DATABASE_URL ?? '';
    if (databaseUrl.includes('postgresql')) {
      execFileSync(
        'psql',
        [
          databaseUrl,
          '-v',
          'ON_ERROR_STOP=0',
          '-c',
          `DO $$ BEGIN
             EXECUTE 'TRUNCATE shipping_flat_rate_settings RESTART IDENTITY';
           EXCEPTION WHEN undefined_table THEN NULL;
           END $$;
           DO $$ BEGIN
             EXECUTE 'TRUNCATE tax_standard_rates RESTART IDENTITY';
           EXCEPTION WHEN undefined_table THEN NULL;
           END $$;`,
        ],
        { stdio: 'ignore' },
      );
      log('plugin', 'cleared flat-rate/tax-standard settings tables (if present)');
    }
  } catch {
    log('plugin', 'settings truncate skipped (psql unavailable or tables missing)');
  }

  const opsPluginPaths = !SKIP_PLUGIN ? resolveOpsPluginPaths() : [];
  const hasManual = opsPluginPaths.includes(PLUGIN_PATH);
  const hasFlatRate = opsPluginPaths.includes(FLAT_RATE_PLUGIN_PATH);
  const hasTaxStandard = opsPluginPaths.includes(TAX_STANDARD_PLUGIN_PATH);

  const pluginEnv = {};
  if (opsPluginPaths.length > 0) {
    for (const p of opsPluginPaths) {
      ensurePluginBuilt(p);
    }
    pluginEnv.OPOHA_PLUGINS = opsPluginPaths.join(',');
    // Always pin ops smoke amounts (override .env / parent) so quotes are non-zero.
    if (hasFlatRate) {
      pluginEnv.OPOHA_FLAT_RATE_AMOUNT =
        process.env.OPOHA_FLAT_RATE_AMOUNT ?? OPS_FLAT_RATE_AMOUNT;
    }
    if (hasTaxStandard) {
      pluginEnv.OPOHA_TAX_STANDARD_DEFAULT_RATE_BPS =
        process.env.OPOHA_TAX_STANDARD_DEFAULT_RATE_BPS ?? OPS_TAX_RATE_BPS;
    }
    log('plugin', `OPOHA_PLUGINS=${pluginEnv.OPOHA_PLUGINS}`);
    log(
      'plugin',
      `ops env flatRate=${pluginEnv.OPOHA_FLAT_RATE_AMOUNT ?? 'n/a'} taxBps=${pluginEnv.OPOHA_TAX_STANDARD_DEFAULT_RATE_BPS ?? 'n/a'}`,
    );
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

    // Enable ops plugins so Payment/Shipping/Tax registries are active (G-02).
    if (!SKIP_PLUGIN && opsPluginPaths.length > 0) {
      const pluginIds = [];
      if (hasManual) pluginIds.push('manual-payment');
      if (hasFlatRate) pluginIds.push('shipping-flat-rate');
      if (hasTaxStandard) pluginIds.push('tax-standard');
      for (const id of pluginIds) {
        const enabled = await gql(
          `mutation($id: ID!) {
            enablePlugin(id: $id) { id state enabled }
          }`,
          { id },
          token,
        );
        const state = enabled.enablePlugin?.state;
        const isEnabled = enabled.enablePlugin?.enabled;
        if (state !== 'enabled' && isEnabled !== true) {
          fail(
            'plugin',
            `enablePlugin(${id}) expected enabled, got ${JSON.stringify(enabled.enablePlugin)}`,
          );
        }
        log('plugin', `enablePlugin(${id}) → state=${state}`);
      }
    }

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

      const wantOps =
        !SKIP_COMMERCE_OPS && (hasManual || hasFlatRate || hasTaxStandard);

      if (!SKIP_COMMERCE_OPS && (!hasManual || !hasFlatRate || !hasTaxStandard)) {
        fail(
          'commerce-ops',
          'Phase 2 G-02 requires sibling plugins plugin-manual-payment, plugin-shipping-flat-rate, and plugin-tax-standard (set SKIP_COMMERCE_OPS=1 to skip)',
        );
      }

      if (wantOps) {
        log('commerce-ops', 'payment + shipping + tax smoke (Phase 2 G-02)');

        if (hasManual) {
          const providers = await gql(
            `query { paymentProviders { code displayName } }`,
            undefined,
            token,
          );
          const codes = (providers.paymentProviders ?? []).map((p) => p.code);
          if (!codes.includes('manual')) {
            fail(
              'commerce-ops',
              `expected paymentProviders to include "manual", got ${JSON.stringify(codes)}`,
            );
          }
          log('commerce-ops', `paymentProviders OK (${codes.join(',')})`);
        }

        if (hasFlatRate) {
          const methods = await gql(
            `query { shippingMethods { code displayName } }`,
            undefined,
            token,
          );
          const methodCodes = (methods.shippingMethods ?? []).map((m) => m.code);
          if (!methodCodes.includes('flat-rate')) {
            fail(
              'commerce-ops',
              `expected shippingMethods to include "flat-rate", got ${JSON.stringify(methodCodes)}`,
            );
          }

          const shipped = await gql(
            `mutation($input: SelectCartShippingInput!) {
              selectCartShipping(input: $input) {
                id
                shippingMethodCode
                shippingRateCode
                shippingMinor
              }
            }`,
            {
              input: {
                cartId,
                methodCode: 'flat-rate',
                rateCode: 'flat-rate',
                destinationCountryCode: 'US',
                destinationPostalCode: '10001',
              },
            },
            token,
          );
          const shipAmt = shipped.selectCartShipping.shippingMinor;
          if (shipAmt !== OPS_FLAT_RATE_AMOUNT) {
            fail(
              'commerce-ops',
              `expected shippingMinor=${OPS_FLAT_RATE_AMOUNT}, got ${shipAmt}`,
            );
          }
          log(
            'commerce-ops',
            `selectCartShipping OK shippingMinor=${shipAmt}`,
          );
        }

        if (hasTaxStandard) {
          await gql(
            `mutation($input: SetCartTaxContextInput!) {
              setCartTaxContext(input: $input) {
                id
                taxPricingMode
                taxCountryCode
                taxProviderCode
              }
            }`,
            {
              input: {
                cartId,
                pricingMode: 'exclusive',
                countryCode: 'US',
                providerCode: 'standard',
              },
            },
            token,
          );
          log('commerce-ops', 'setCartTaxContext exclusive/US/standard OK');
        }
      } else if (SKIP_COMMERCE_OPS) {
        log('commerce-ops', 'skipped (SKIP_COMMERCE_OPS=1)');
      }

      log('commerce', 'prepareCheckout');
      const checkoutData = await gql(
        `mutation($cartId: ID!) {
          prepareCheckout(cartId: $cartId) {
            cartId
            reservationIds
            totals {
              subtotalMinor
              shippingMinor
              taxMinor
              discountMinor
              totalMinor
              currencyCode
            }
            cart { status shippingMethodCode shippingMinor taxMinor }
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

      const totals = checkoutData.prepareCheckout.totals;
      if (wantOps && hasFlatRate) {
        if (totals.shippingMinor !== OPS_FLAT_RATE_AMOUNT) {
          fail(
            'commerce-ops',
            `prepareCheckout shippingMinor expected ${OPS_FLAT_RATE_AMOUNT}, got ${totals.shippingMinor}`,
          );
        }
      }
      if (wantOps && hasTaxStandard) {
        const taxMinor = BigInt(String(totals.taxMinor ?? '0'));
        if (taxMinor <= 0n) {
          fail(
            'commerce-ops',
            `prepareCheckout taxMinor expected > 0 (rate ${OPS_TAX_RATE_BPS} bps), got ${totals.taxMinor}`,
          );
        }
        log(
          'commerce-ops',
          `prepareCheckout totals shipping=${totals.shippingMinor} tax=${totals.taxMinor} total=${totals.totalMinor}`,
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
            shippingMinor
            taxMinor
            shippingMethodCode
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
      if (wantOps && hasFlatRate) {
        if (order.shippingMinor !== OPS_FLAT_RATE_AMOUNT) {
          fail(
            'commerce-ops',
            `order.shippingMinor expected ${OPS_FLAT_RATE_AMOUNT}, got ${order.shippingMinor}`,
          );
        }
        if (order.shippingMethodCode !== 'flat-rate') {
          fail(
            'commerce-ops',
            `order.shippingMethodCode expected flat-rate, got ${order.shippingMethodCode}`,
          );
        }
      }
      if (wantOps && hasTaxStandard) {
        const orderTax = BigInt(String(order.taxMinor ?? '0'));
        if (orderTax <= 0n) {
          fail(
            'commerce-ops',
            `order.taxMinor expected > 0, got ${order.taxMinor}`,
          );
        }
      }
      log(
        'commerce',
        `order ${order.id} status=${order.status} total=${order.totalMinor} shipping=${order.shippingMinor} tax=${order.taxMinor} OK`,
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

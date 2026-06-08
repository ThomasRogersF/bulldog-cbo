// Bulldog CBO — Bootstrap script
// Creates the first owner auth user + profile and seeds a realistic Venezuelan
// hot dog cart catalog (menu, ingredients, recipes, opening stock, customers).
//
// Re-runnable: the owner user/profile are upserted, and catalog seeding is
// skipped if ingredients already exist. Pre-seeded categories (the schema's
// PART 16 seeds menu/ingredient categories) are reused by name instead of
// being duplicated.
//
// Requires the SERVICE ROLE key (the anon key cannot create auth users and is
// subject to RLS). NEVER expose the service role key to the client.
//
// Run:  SUPABASE_SERVICE_ROLE_KEY=... node scripts/bootstrap.mjs
//
// Env:
//   PUBLIC_SUPABASE_URL          (or read from .env.local)
//   SUPABASE_SERVICE_ROLE_KEY    (REQUIRED — server-only)
//   OWNER_EMAIL                  (default owner@bulldogcbo.com)
//   OWNER_PASSWORD               (default bulldog123)
//   OWNER_NAME                   (default Dueño Bulldog)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

function readEnvLocal(key) {
	try {
		const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
		const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, 'm'));
		if (!match) return undefined;
		// Strip optional surrounding quotes and trailing whitespace.
		return match[1].trim().replace(/^["']|["']$/g, '');
	} catch {
		return undefined;
	}
}

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || readEnvLocal('PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@bulldogcbo.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'bulldog123';
const OWNER_NAME = process.env.OWNER_NAME || 'Dueño Bulldog';

if (!SUPABASE_URL) {
	console.error(
		'✖ Missing Supabase URL. Set PUBLIC_SUPABASE_URL in your environment or .env.local.'
	);
	process.exit(1);
}

if (!SERVICE_ROLE) {
	console.error('✖ Missing SUPABASE_SERVICE_ROLE_KEY.');
	console.error('');
	console.error('  This script needs the Supabase SERVICE ROLE key (the anon key cannot');
	console.error('  create users and is blocked by RLS). It is a secret — never commit it');
	console.error('  or expose it to the client/browser.');
	console.error('');
	console.error('  Find it in: Supabase Dashboard → Project Settings → API → service_role.');
	console.error('');
	console.error('  Then run, e.g.:');
	console.error('    # PowerShell');
	console.error('    $env:SUPABASE_SERVICE_ROLE_KEY="<key>"; node scripts/bootstrap.mjs');
	console.error('    # bash');
	console.error('    SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/bootstrap.mjs');
	process.exit(1);
}

// Service role client: bypasses RLS, no session persistence.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
	auth: { autoRefreshToken: false, persistSession: false }
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Throw on a Supabase error, otherwise return the data. */
function unwrap(result, context) {
	if (result.error) {
		throw new Error(`${context}: ${result.error.message}`);
	}
	return result.data;
}

/** Find the owner user id by email by paging through the admin user list. */
async function findUserIdByEmail(email) {
	const target = email.toLowerCase();
	let page = 1;
	const perPage = 200;
	for (;;) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
		if (error) throw new Error(`listUsers: ${error.message}`);
		const found = data.users.find((u) => (u.email || '').toLowerCase() === target);
		if (found) return found.id;
		if (data.users.length < perPage) return undefined;
		page += 1;
	}
}

// -----------------------------------------------------------------------------
// Step 1 — Owner auth user
// -----------------------------------------------------------------------------

async function ensureOwnerUser() {
	console.log('→ Step 1: creating owner auth user…');
	const { data, error } = await supabase.auth.admin.createUser({
		email: OWNER_EMAIL,
		password: OWNER_PASSWORD,
		email_confirm: true
	});

	if (!error && data?.user) {
		console.log(`  ✓ Created owner user ${OWNER_EMAIL}`);
		return data.user.id;
	}

	// Already exists → look it up so the script stays re-runnable.
	const msg = (error?.message || '').toLowerCase();
	const alreadyExists =
		msg.includes('already') || msg.includes('exist') || msg.includes('registered');
	if (alreadyExists) {
		const id = await findUserIdByEmail(OWNER_EMAIL);
		if (!id) {
			throw new Error(
				`Owner user reported as existing but could not be found by email ${OWNER_EMAIL}`
			);
		}
		console.log(`  ✓ Owner user already exists (${OWNER_EMAIL}) — reusing`);
		return id;
	}

	throw new Error(`createUser: ${error?.message || 'unknown error'}`);
}

// -----------------------------------------------------------------------------
// Step 2 — Owner profile
// -----------------------------------------------------------------------------

async function ensureOwnerProfile(ownerId) {
	console.log('→ Step 2: upserting owner profile…');
	unwrap(
		await supabase.from('profiles').upsert({ id: ownerId, full_name: OWNER_NAME, role: 'owner' }),
		'upsert profile'
	);
	console.log(`  ✓ Profile set: ${OWNER_NAME} (owner)`);
}

// -----------------------------------------------------------------------------
// Step 3 — Catalog seed
// -----------------------------------------------------------------------------

const MENU_CATEGORIES = [
	{ name: 'Perros', color: '#D62828', emoji: '🌭', sort_order: 1 },
	{ name: 'Hamburguesas', color: '#F4A400', emoji: '🍔', sort_order: 2 },
	{ name: 'Bebidas', color: '#1565C0', emoji: '🥤', sort_order: 3 },
	{ name: 'Extras', color: '#2E7D32', emoji: '🍟', sort_order: 4 }
];

const INGREDIENT_CATEGORIES = [
	{ name: 'Panes', color: '#F4A400', sort_order: 1 },
	{ name: 'Carnes', color: '#D62828', sort_order: 2 },
	{ name: 'Salsas', color: '#E65100', sort_order: 3 },
	{ name: 'Vegetales', color: '#2E7D32', sort_order: 4 },
	{ name: 'Bebidas', color: '#1565C0', sort_order: 5 }
];

// ingredient key → definition. `cat` references an INGREDIENT_CATEGORIES name.
const INGREDIENTS = [
	{
		key: 'pan_perro',
		name: 'Pan de perro',
		unit: 'unit',
		min_stock: 20,
		cat: 'Panes',
		opening: 80
	},
	{
		key: 'pan_ham',
		name: 'Pan de hamburguesa',
		unit: 'unit',
		min_stock: 15,
		cat: 'Panes',
		opening: 60
	},
	{ key: 'salchicha', name: 'Salchicha', unit: 'unit', min_stock: 30, cat: 'Carnes', opening: 100 },
	{
		key: 'carne_ham',
		name: 'Carne de hamburguesa',
		unit: 'unit',
		min_stock: 15,
		cat: 'Carnes',
		opening: 60
	},
	{ key: 'tocineta', name: 'Tocineta', unit: 'g', min_stock: 500, cat: 'Carnes', opening: 2000 },
	{ key: 'queso', name: 'Queso', unit: 'g', min_stock: 500, cat: 'Carnes', opening: 3000 },
	{
		key: 'salsa_tomate',
		name: 'Salsa de tomate',
		unit: 'ml',
		min_stock: 1000,
		cat: 'Salsas',
		opening: 4000
	},
	{ key: 'mayonesa', name: 'Mayonesa', unit: 'ml', min_stock: 1000, cat: 'Salsas', opening: 4000 },
	{ key: 'mostaza', name: 'Mostaza', unit: 'ml', min_stock: 500, cat: 'Salsas', opening: 2000 },
	{
		key: 'repollo',
		name: 'Repollo rallado',
		unit: 'g',
		min_stock: 500,
		cat: 'Vegetales',
		opening: 2500
	},
	{ key: 'papas', name: 'Papas', unit: 'kg', min_stock: 5, cat: 'Vegetales', opening: 20 },
	{
		key: 'refresco_lata',
		name: 'Refresco lata',
		unit: 'unit',
		min_stock: 24,
		cat: 'Bebidas',
		opening: 72
	}
];

// menu item key → definition. `cat` references a MENU_CATEGORIES name.
// `recipe` maps ingredient key → qty_required.
const MENU_ITEMS = [
	{
		key: 'perro_clasico',
		name: 'Perro Clásico',
		description: 'Salchicha, pan, salsas y repollo',
		price_usd: 3.0,
		cat: 'Perros',
		sort_order: 1,
		recipe: { pan_perro: 1, salchicha: 1, salsa_tomate: 20, mayonesa: 20, mostaza: 10, repollo: 40 }
	},
	{
		key: 'perro_especial',
		name: 'Perro Especial',
		description: 'Doble salchicha, queso, tocineta y todas las salsas',
		price_usd: 4.5,
		cat: 'Perros',
		sort_order: 2,
		recipe: {
			pan_perro: 1,
			salchicha: 2,
			queso: 40,
			tocineta: 30,
			salsa_tomate: 25,
			mayonesa: 25,
			mostaza: 10,
			repollo: 40
		}
	},
	{
		key: 'ham_clasica',
		name: 'Hamburguesa Clásica',
		description: 'Carne, pan, queso y salsas',
		price_usd: 5.0,
		cat: 'Hamburguesas',
		sort_order: 1,
		recipe: { pan_ham: 1, carne_ham: 1, queso: 40, salsa_tomate: 25, mayonesa: 25 }
	},
	{
		key: 'ham_doble',
		name: 'Hamburguesa Doble',
		description: 'Doble carne, doble queso y tocineta',
		price_usd: 7.0,
		cat: 'Hamburguesas',
		sort_order: 2,
		recipe: { pan_ham: 1, carne_ham: 2, queso: 80, tocineta: 40, salsa_tomate: 25, mayonesa: 25 }
	},
	{
		key: 'papas_fritas',
		name: 'Papas Fritas',
		description: 'Ración de papas fritas crujientes',
		price_usd: 2.5,
		cat: 'Extras',
		sort_order: 1,
		recipe: { papas: 0.25 }
	},
	{
		key: 'papas_queso',
		name: 'Papas con Queso',
		description: 'Papas fritas cubiertas con queso',
		price_usd: 3.5,
		cat: 'Extras',
		sort_order: 2,
		recipe: { papas: 0.25, queso: 60 }
	},
	{
		key: 'refresco',
		name: 'Refresco',
		description: 'Refresco en lata frío',
		price_usd: 1.5,
		cat: 'Bebidas',
		sort_order: 1,
		recipe: { refresco_lata: 1 }
	},
	{
		key: 'agua',
		name: 'Agua Mineral',
		description: 'Botella de agua mineral',
		price_usd: 1.0,
		cat: 'Bebidas',
		sort_order: 2,
		recipe: {}
	}
];

const CUSTOMERS = [
	{ name: 'María González', phone: '0414-1234567', source: 'regular', group_tag: 'vip' },
	{
		name: 'Distribuidora El Sabor',
		phone: '0212-5550199',
		source: 'delivery',
		group_tag: 'wholesale'
	},
	{ name: 'Carlos Pérez', phone: '0426-7654321', source: 'referred', group_tag: 'regular' },
	{ name: 'Cliente de paso', phone: null, source: 'walk_in', group_tag: null }
];

/**
 * Resolve a name→id map for a category table. Reuses pre-seeded rows (matched by
 * name) and inserts any that are missing.
 */
async function ensureCategories(table, defs) {
	const existing = unwrap(
		await supabase.from(table).select('id, name').is('deleted_at', null),
		`select ${table}`
	);
	const byName = new Map(existing.map((row) => [row.name, row.id]));

	const toInsert = defs.filter((d) => !byName.has(d.name)).map((d) => ({ id: randomUUID(), ...d }));

	if (toInsert.length > 0) {
		unwrap(await supabase.from(table).insert(toInsert), `insert ${table}`);
		for (const row of toInsert) byName.set(row.name, row.id);
	}

	return byName;
}

async function seedCatalog(ownerId) {
	console.log('→ Step 3: seeding catalog…');

	// Idempotency sentinel: ingredients are NOT pre-seeded by the schema, so they
	// are a reliable signal of a prior bootstrap run. (menu/ingredient categories
	// ARE pre-seeded, so we can't key off those.)
	const existingIngredients = unwrap(
		await supabase.from('ingredients').select('id').limit(1),
		'check ingredients'
	);
	if (existingIngredients.length > 0) {
		console.log('  • Ingredients already present — skipping catalog seed (idempotent).');
		return;
	}

	// Categories (reuse pre-seeded, insert missing).
	const menuCatIds = await ensureCategories('menu_categories', MENU_CATEGORIES);
	console.log(`  ✓ Menu categories ready (${menuCatIds.size})`);

	const ingCatIds = await ensureCategories('ingredient_categories', INGREDIENT_CATEGORIES);
	console.log(`  ✓ Ingredient categories ready (${ingCatIds.size})`);

	// Ingredients.
	const ingredientIds = new Map(); // key → id
	const ingredientRows = INGREDIENTS.map((ing) => {
		const id = randomUUID();
		ingredientIds.set(ing.key, id);
		return {
			id,
			category_id: ingCatIds.get(ing.cat) ?? null,
			name: ing.name,
			unit: ing.unit,
			min_stock: ing.min_stock
		};
	});
	unwrap(await supabase.from('ingredients').insert(ingredientRows), 'insert ingredients');
	console.log(`  ✓ Ingredients (${ingredientRows.length})`);

	// Opening stock: one append-only ledger row per ingredient.
	const ledgerRows = INGREDIENTS.map((ing) => ({
		id: randomUUID(),
		ingredient_id: ingredientIds.get(ing.key),
		order_id: null,
		shift_id: null,
		actor_id: ownerId,
		qty_change: ing.opening,
		reason: 'opening_count',
		note: 'Conteo inicial (bootstrap)'
	}));
	unwrap(await supabase.from('ingredient_ledger').insert(ledgerRows), 'insert ledger');
	console.log(`  ✓ Opening stock ledger (${ledgerRows.length})`);

	// Menu items.
	const menuItemIds = new Map(); // key → id
	const menuItemRows = MENU_ITEMS.map((item) => {
		const id = randomUUID();
		menuItemIds.set(item.key, id);
		return {
			id,
			category_id: menuCatIds.get(item.cat) ?? null,
			name: item.name,
			description: item.description,
			price_usd: item.price_usd,
			is_available: true,
			sort_order: item.sort_order
		};
	});
	unwrap(await supabase.from('menu_items').insert(menuItemRows), 'insert menu_items');
	console.log(`  ✓ Menu items (${menuItemRows.length})`);

	// Recipes (link menu items to ingredients).
	const recipeRows = [];
	for (const item of MENU_ITEMS) {
		for (const [ingKey, qty] of Object.entries(item.recipe)) {
			const ingredientId = ingredientIds.get(ingKey);
			if (!ingredientId) continue;
			recipeRows.push({
				id: randomUUID(),
				menu_item_id: menuItemIds.get(item.key),
				ingredient_id: ingredientId,
				qty_required: qty
			});
		}
	}
	if (recipeRows.length > 0) {
		unwrap(await supabase.from('recipes').insert(recipeRows), 'insert recipes');
	}
	console.log(`  ✓ Recipes (${recipeRows.length})`);

	// Customers.
	const customerRows = CUSTOMERS.map((c) => ({
		id: randomUUID(),
		name: c.name,
		phone: c.phone,
		source: c.source,
		group_tag: c.group_tag
	}));
	unwrap(await supabase.from('customers').insert(customerRows), 'insert customers');
	console.log(`  ✓ Customers (${customerRows.length})`);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
	console.log('🌭 Bulldog CBO — bootstrap');
	console.log(`   Target: ${SUPABASE_URL}`);
	console.log('');

	const ownerId = await ensureOwnerUser();
	await ensureOwnerProfile(ownerId);
	await seedCatalog(ownerId);

	console.log('');
	console.log('✅ Bootstrap complete.');
	console.log('────────────────────────────────────────');
	console.log(`   Log in at /login with:`);
	console.log(`     Email:    ${OWNER_EMAIL}`);
	console.log(`     Password: ${OWNER_PASSWORD}`);
	console.log('────────────────────────────────────────');
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('');
		console.error('✖ Bootstrap failed:', err.message);
		process.exit(1);
	});

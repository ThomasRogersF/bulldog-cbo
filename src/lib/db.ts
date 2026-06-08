// Single abstraction layer for all data operations.
// Components never import supabase.ts directly — they go through here.
//
// Conventions enforced in this file:
//  - Postgres `numeric` arrives as a STRING over PostgREST; every mapper coerces
//    numeric columns with num()/numN() so the app only ever sees `number`.
//  - All errors throw (via ok()/okMaybe()) so callers/toasts handle them.
//  - Client-generated PKs are UUID v7 (uuidv7()), passed explicitly on insert.
//  - Soft delete = update deleted_at = now(); every list() filters deleted_at.
//  - actor_id / worker_id / confirmed_by / shift_id are injected here from the
//    current session + active shift — never passed in by components.
import { supabase } from './supabase';
import { uuidv7 } from './utils/id';
import { computeTotals, expectedCash, round2, variance } from './domain/money';
import { expandRecipesToLedger } from './domain/recipe';
import type {
	ActiveShift,
	AuthSession,
	AuthUser,
	CartLineInput,
	ConfirmInput,
	Customer,
	CustomerStats,
	Ingredient,
	IngredientCategory,
	IngredientLedgerEntry,
	IngredientStock,
	LedgerMovementInput,
	MenuCategory,
	MenuItem,
	NewCustomer,
	NewIngredient,
	NewIngredientCategory,
	NewMenuCategory,
	NewMenuItem,
	NewProfile,
	Order,
	OrderItem,
	OrderStatus,
	OrderType,
	OrderWithItems,
	PaymentMethod,
	Profile,
	RecipeInput,
	RecipeLine,
	Setting,
	Shift,
	Unit
} from './types';

export { supabase };

// ── Internal helpers ────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
type SbResult = { data: unknown; error: { message: string; code?: string } | null };

function ok<T>(res: SbResult): T {
	if (res.error) throw new Error(res.error.message);
	return res.data as T;
}

function okMaybe<T>(res: SbResult): T | null {
	if (res.error) throw new Error(res.error.message);
	return (res.data ?? null) as T | null;
}

function num(v: unknown): number {
	return v == null ? 0 : Number(v);
}
function numN(v: unknown): number | null {
	return v == null ? null : Number(v);
}
function str(v: unknown): string {
	return v == null ? '' : String(v);
}
function strN(v: unknown): string | null {
	return v == null ? null : String(v);
}
function bool(v: unknown): boolean {
	return v === true || v === 'true';
}
function nowIso(): string {
	return new Date().toISOString();
}

async function currentUserId(): Promise<string> {
	const { data } = await supabase.auth.getSession();
	const id = data.session?.user?.id;
	if (!id) throw new Error('No autenticado');
	return id;
}

async function activeShiftId(): Promise<string | null> {
	const row = okMaybe<Row>(await supabase.from('active_shift').select('id').maybeSingle());
	return row ? str(row.id) : null;
}

async function softDeleteRow(table: string, id: string): Promise<void> {
	const { error } = await supabase.from(table).update({ deleted_at: nowIso() }).eq('id', id);
	if (error) throw new Error(error.message);
}

// ── Mappers ─────────────────────────────────────────────────────────────────
function mapProfile(r: Row): Profile {
	return {
		id: str(r.id),
		full_name: str(r.full_name),
		role: str(r.role) === 'owner' ? 'owner' : 'worker',
		pin: strN(r.pin),
		avatar_url: strN(r.avatar_url),
		is_active: bool(r.is_active),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapShift(r: Row): Shift {
	return {
		id: str(r.id),
		shift_number: num(r.shift_number),
		opened_by: str(r.opened_by),
		closed_by: strN(r.closed_by),
		opened_at: str(r.opened_at),
		closed_at: strN(r.closed_at),
		opening_cash_usd: num(r.opening_cash_usd),
		closing_cash_usd: numN(r.closing_cash_usd),
		expected_cash_usd: numN(r.expected_cash_usd),
		variance_usd: numN(r.variance_usd),
		notes: strN(r.notes),
		telegram_report_sent: bool(r.telegram_report_sent),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapActiveShift(r: Row): ActiveShift {
	return {
		...mapShift(r),
		opened_by_name: strN(r.opened_by_name),
		confirmed_orders: num(r.confirmed_orders),
		total_sales_usd: num(r.total_sales_usd)
	};
}

function mapIngredientCategory(r: Row): IngredientCategory {
	return {
		id: str(r.id),
		name: str(r.name),
		color: str(r.color),
		sort_order: num(r.sort_order),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapIngredient(r: Row): Ingredient {
	return {
		id: str(r.id),
		category_id: strN(r.category_id),
		name: str(r.name),
		unit: str(r.unit) as Unit,
		min_stock: num(r.min_stock),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapIngredientStock(r: Row): IngredientStock {
	return {
		id: str(r.id),
		name: str(r.name),
		unit: str(r.unit) as Unit,
		min_stock: num(r.min_stock),
		category_id: strN(r.category_id),
		category_name: strN(r.category_name),
		category_color: strN(r.category_color),
		current_stock: num(r.current_stock),
		is_low_stock: bool(r.is_low_stock),
		is_out_of_stock: bool(r.is_out_of_stock),
		deleted_at: strN(r.deleted_at)
	};
}

function mapLedgerEntry(r: Row): IngredientLedgerEntry {
	const ing = r.ingredients as Row | null;
	const actor = r.profiles as Row | null;
	return {
		id: str(r.id),
		ingredient_id: str(r.ingredient_id),
		order_id: strN(r.order_id),
		shift_id: strN(r.shift_id),
		actor_id: str(r.actor_id),
		qty_change: num(r.qty_change),
		reason: str(r.reason) as IngredientLedgerEntry['reason'],
		note: strN(r.note),
		created_at: str(r.created_at),
		ingredient_name: ing ? strN(ing.name) : null,
		ingredient_unit: ing ? (str(ing.unit) as Unit) : null,
		actor_name: actor ? strN(actor.full_name) : null
	};
}

function mapMenuCategory(r: Row): MenuCategory {
	return {
		id: str(r.id),
		name: str(r.name),
		color: str(r.color),
		emoji: strN(r.emoji),
		sort_order: num(r.sort_order),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapMenuItem(r: Row): MenuItem {
	const cat = r.menu_categories as Row | null;
	return {
		id: str(r.id),
		category_id: strN(r.category_id),
		name: str(r.name),
		description: strN(r.description),
		price_usd: num(r.price_usd),
		is_available: bool(r.is_available),
		image_url: strN(r.image_url),
		sort_order: num(r.sort_order),
		category_name: cat ? strN(cat.name) : null,
		category_color: cat ? strN(cat.color) : null,
		category_emoji: cat ? strN(cat.emoji) : null,
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapRecipeLine(r: Row): RecipeLine {
	const ing = r.ingredients as Row | null;
	return {
		id: str(r.id),
		menu_item_id: str(r.menu_item_id),
		ingredient_id: str(r.ingredient_id),
		qty_required: num(r.qty_required),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		ingredient_name: ing ? str(ing.name) : '',
		unit: ing ? (str(ing.unit) as Unit) : 'unit'
	};
}

function mapCustomer(r: Row): Customer {
	return {
		id: str(r.id),
		name: str(r.name),
		phone: strN(r.phone),
		source: str(r.source) as Customer['source'],
		group_tag: r.group_tag ? (str(r.group_tag) as Customer['group_tag']) : null,
		credit_balance_usd: num(r.credit_balance_usd),
		notes: strN(r.notes),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at)
	};
}

function mapCustomerStats(r: Row): CustomerStats {
	return {
		id: str(r.id),
		name: str(r.name),
		phone: strN(r.phone),
		source: str(r.source) as CustomerStats['source'],
		group_tag: r.group_tag ? (str(r.group_tag) as CustomerStats['group_tag']) : null,
		credit_balance_usd: num(r.credit_balance_usd),
		notes: strN(r.notes),
		created_at: str(r.created_at),
		deleted_at: strN(r.deleted_at),
		purchase_count: num(r.purchase_count),
		total_spent_usd: num(r.total_spent_usd),
		last_purchase_at: strN(r.last_purchase_at)
	};
}

function mapOrderItem(r: Row): OrderItem {
	const snap = (r.menu_item_snapshot ?? {}) as Row;
	return {
		id: str(r.id),
		order_id: str(r.order_id),
		menu_item_id: strN(r.menu_item_id),
		menu_item_snapshot: {
			name: str(snap.name),
			price_usd: num(snap.price_usd),
			category_name: strN(snap.category_name)
		},
		qty: num(r.qty),
		unit_price_usd: num(r.unit_price_usd),
		line_total_usd: num(r.line_total_usd),
		override_reason: strN(r.override_reason),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at)
	};
}

function mapOrder(r: Row): Order {
	const worker = r.profiles as Row | null;
	const customer = r.customers as Row | null;
	return {
		id: str(r.id),
		order_number: num(r.order_number),
		shift_id: strN(r.shift_id),
		customer_id: strN(r.customer_id),
		worker_id: str(r.worker_id),
		order_type: str(r.order_type) as OrderType,
		status: str(r.status) as OrderStatus,
		subtotal_usd: num(r.subtotal_usd),
		discount_usd: num(r.discount_usd),
		total_usd: num(r.total_usd),
		total_bs: numN(r.total_bs),
		usd_rate_used: numN(r.usd_rate_used),
		payment_method: r.payment_method ? (str(r.payment_method) as PaymentMethod) : null,
		paid_at: strN(r.paid_at),
		confirmed_by: strN(r.confirmed_by),
		cancelled_at: strN(r.cancelled_at),
		cancelled_by: strN(r.cancelled_by),
		cancel_reason: strN(r.cancel_reason),
		notes: strN(r.notes),
		created_at: str(r.created_at),
		updated_at: str(r.updated_at),
		deleted_at: strN(r.deleted_at),
		worker_name: worker ? strN(worker.full_name) : null,
		customer_name: customer ? strN(customer.name) : null
	};
}

const ORDER_SELECT = '*, profiles!orders_worker_id_fkey(full_name), customers(name)';

async function recomputeOrderTotals(orderId: string): Promise<void> {
	const items = ok<Row[]>(
		await supabase.from('order_items').select('line_total_usd').eq('order_id', orderId)
	);
	const subtotal = round2(items.reduce((s, r) => s + num(r.line_total_usd), 0));
	const orderRow = okMaybe<Row>(
		await supabase.from('orders').select('discount_usd').eq('id', orderId).maybeSingle()
	);
	const discount = orderRow ? num(orderRow.discount_usd) : 0;
	const total = round2(Math.max(0, subtotal - discount));
	const { error } = await supabase
		.from('orders')
		.update({ subtotal_usd: subtotal, total_usd: total })
		.eq('id', orderId);
	if (error) throw new Error(error.message);
}

async function addLedgerMovement(input: LedgerMovementInput): Promise<IngredientLedgerEntry> {
	const actor = await currentUserId();
	const shift = await activeShiftId();
	const row = ok<Row>(
		await supabase
			.from('ingredient_ledger')
			.insert({
				id: uuidv7(),
				ingredient_id: input.ingredientId,
				qty_change: input.qtyChange,
				reason: input.reason,
				note: input.note ?? null,
				order_id: input.orderId ?? null,
				shift_id: shift,
				actor_id: actor
			})
			.select()
			.single()
	);
	return mapLedgerEntry(row);
}

// ── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
	async signIn(email: string, password: string): Promise<AuthSession> {
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) throw new Error(error.message);
		return { user: { id: data.user.id, email: data.user.email ?? null } };
	},
	async signOut(): Promise<void> {
		const { error } = await supabase.auth.signOut();
		if (error) throw new Error(error.message);
	},
	async getSession(): Promise<AuthSession | null> {
		const { data } = await supabase.auth.getSession();
		const u = data.session?.user;
		return u ? { user: { id: u.id, email: u.email ?? null } } : null;
	},
	async getUser(): Promise<AuthUser | null> {
		const { data } = await supabase.auth.getUser();
		return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
	},
	onAuthStateChange(cb: (user: AuthUser | null) => void): { unsubscribe: () => void } {
		const { data } = supabase.auth.onAuthStateChange((_event, session) => {
			const u = session?.user;
			cb(u ? { id: u.id, email: u.email ?? null } : null);
		});
		return { unsubscribe: () => data.subscription.unsubscribe() };
	}
};

// ── Profiles ────────────────────────────────────────────────────────────────
export const profilesDb = {
	async getById(id: string): Promise<Profile | null> {
		const row = okMaybe<Row>(
			await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
		);
		return row ? mapProfile(row) : null;
	},
	async getCurrent(): Promise<Profile | null> {
		const id = await currentUserId();
		return profilesDb.getById(id);
	},
	async list(): Promise<Profile[]> {
		const rows = ok<Row[]>(
			await supabase.from('profiles').select('*').is('deleted_at', null).order('full_name')
		);
		return rows.map(mapProfile);
	},
	async create(input: NewProfile): Promise<Profile> {
		// id is the auth.users id (FK) — NOT a generated v7.
		const row = ok<Row>(
			await supabase
				.from('profiles')
				.insert({
					id: input.id,
					full_name: input.full_name,
					role: input.role ?? 'worker',
					pin: input.pin ?? null,
					avatar_url: input.avatar_url ?? null
				})
				.select()
				.single()
		);
		return mapProfile(row);
	},
	async update(id: string, patch: Partial<NewProfile>): Promise<Profile> {
		const row = ok<Row>(
			await supabase.from('profiles').update(patch).eq('id', id).select().single()
		);
		return mapProfile(row);
	},
	async softDelete(id: string): Promise<void> {
		await softDeleteRow('profiles', id);
	}
};

// ── Menu ────────────────────────────────────────────────────────────────────
export const menuDb = {
	categories: {
		async list(): Promise<MenuCategory[]> {
			const rows = ok<Row[]>(
				await supabase
					.from('menu_categories')
					.select('*')
					.is('deleted_at', null)
					.order('sort_order')
			);
			return rows.map(mapMenuCategory);
		},
		async create(input: NewMenuCategory): Promise<MenuCategory> {
			const row = ok<Row>(
				await supabase
					.from('menu_categories')
					.insert({
						id: uuidv7(),
						name: input.name,
						color: input.color ?? '#D62828',
						emoji: input.emoji ?? null,
						sort_order: input.sort_order ?? 0
					})
					.select()
					.single()
			);
			return mapMenuCategory(row);
		},
		async update(id: string, patch: Partial<NewMenuCategory>): Promise<MenuCategory> {
			const row = ok<Row>(
				await supabase.from('menu_categories').update(patch).eq('id', id).select().single()
			);
			return mapMenuCategory(row);
		},
		async delete(id: string): Promise<void> {
			await softDeleteRow('menu_categories', id);
		}
	},
	items: {
		async list(opts?: { categoryId?: string; availableOnly?: boolean }): Promise<MenuItem[]> {
			let q = supabase
				.from('menu_items')
				.select('*, menu_categories(name, color, emoji)')
				.is('deleted_at', null);
			if (opts?.categoryId) q = q.eq('category_id', opts.categoryId);
			if (opts?.availableOnly) q = q.eq('is_available', true);
			const rows = ok<Row[]>(await q.order('sort_order').order('name'));
			return rows.map(mapMenuItem);
		},
		async getById(id: string): Promise<MenuItem | null> {
			const row = okMaybe<Row>(
				await supabase
					.from('menu_items')
					.select('*, menu_categories(name, color, emoji)')
					.eq('id', id)
					.maybeSingle()
			);
			return row ? mapMenuItem(row) : null;
		},
		async create(input: NewMenuItem): Promise<MenuItem> {
			const row = ok<Row>(
				await supabase
					.from('menu_items')
					.insert({
						id: uuidv7(),
						name: input.name,
						category_id: input.category_id ?? null,
						description: input.description ?? null,
						price_usd: input.price_usd,
						is_available: input.is_available ?? true,
						image_url: input.image_url ?? null,
						sort_order: input.sort_order ?? 0
					})
					.select('*, menu_categories(name, color, emoji)')
					.single()
			);
			return mapMenuItem(row);
		},
		async update(id: string, patch: Partial<NewMenuItem>): Promise<MenuItem> {
			const row = ok<Row>(
				await supabase
					.from('menu_items')
					.update(patch)
					.eq('id', id)
					.select('*, menu_categories(name, color, emoji)')
					.single()
			);
			return mapMenuItem(row);
		},
		async delete(id: string): Promise<void> {
			await softDeleteRow('menu_items', id);
		}
	},
	recipes: {
		async listForItem(menuItemId: string): Promise<RecipeLine[]> {
			const rows = ok<Row[]>(
				await supabase
					.from('recipes')
					.select('*, ingredients(name, unit)')
					.eq('menu_item_id', menuItemId)
			);
			return rows.map(mapRecipeLine);
		},
		async listAll(): Promise<
			{ menu_item_id: string; ingredient_id: string; qty_required: number }[]
		> {
			const rows = ok<Row[]>(
				await supabase.from('recipes').select('menu_item_id, ingredient_id, qty_required')
			);
			return rows.map((r) => ({
				menu_item_id: str(r.menu_item_id),
				ingredient_id: str(r.ingredient_id),
				qty_required: num(r.qty_required)
			}));
		},
		// Replace-all: recipes has no soft-delete, so wipe then re-insert.
		async setForItem(menuItemId: string, lines: RecipeInput[]): Promise<void> {
			const del = await supabase.from('recipes').delete().eq('menu_item_id', menuItemId);
			if (del.error) throw new Error(del.error.message);
			if (lines.length) {
				const payload = lines.map((l) => ({
					id: uuidv7(),
					menu_item_id: menuItemId,
					ingredient_id: l.ingredient_id,
					qty_required: l.qty_required
				}));
				const ins = await supabase.from('recipes').insert(payload);
				if (ins.error) throw new Error(ins.error.message);
			}
		}
	}
};

// ── Ingredients ─────────────────────────────────────────────────────────────
export const ingredientsDb = {
	categories: {
		async list(): Promise<IngredientCategory[]> {
			const rows = ok<Row[]>(
				await supabase
					.from('ingredient_categories')
					.select('*')
					.is('deleted_at', null)
					.order('sort_order')
			);
			return rows.map(mapIngredientCategory);
		},
		async create(input: NewIngredientCategory): Promise<IngredientCategory> {
			const row = ok<Row>(
				await supabase
					.from('ingredient_categories')
					.insert({
						id: uuidv7(),
						name: input.name,
						color: input.color ?? '#6B7280',
						sort_order: input.sort_order ?? 0
					})
					.select()
					.single()
			);
			return mapIngredientCategory(row);
		},
		async update(id: string, patch: Partial<NewIngredientCategory>): Promise<IngredientCategory> {
			const row = ok<Row>(
				await supabase.from('ingredient_categories').update(patch).eq('id', id).select().single()
			);
			return mapIngredientCategory(row);
		},
		async delete(id: string): Promise<void> {
			await softDeleteRow('ingredient_categories', id);
		}
	},
	items: {
		// Reads the ingredient_stock VIEW so callers get current_stock for free.
		async list(): Promise<IngredientStock[]> {
			const rows = ok<Row[]>(
				await supabase.from('ingredient_stock').select('*').is('deleted_at', null).order('name')
			);
			return rows.map(mapIngredientStock);
		},
		async getById(id: string): Promise<IngredientStock | null> {
			const row = okMaybe<Row>(
				await supabase.from('ingredient_stock').select('*').eq('id', id).maybeSingle()
			);
			return row ? mapIngredientStock(row) : null;
		},
		async create(input: NewIngredient): Promise<Ingredient> {
			const id = uuidv7();
			const row = ok<Row>(
				await supabase
					.from('ingredients')
					.insert({
						id,
						name: input.name,
						category_id: input.category_id ?? null,
						unit: input.unit ?? 'unit',
						min_stock: input.min_stock ?? 0
					})
					.select()
					.single()
			);
			if (input.openingCount && input.openingCount !== 0) {
				await addLedgerMovement({
					ingredientId: id,
					qtyChange: input.openingCount,
					reason: 'opening_count',
					note: 'Conteo inicial'
				});
			}
			return mapIngredient(row);
		},
		async update(id: string, patch: Partial<NewIngredient>): Promise<Ingredient> {
			// openingCount is not a column — strip it before the update.
			const rest: Partial<NewIngredient> = { ...patch };
			delete rest.openingCount;
			const row = ok<Row>(
				await supabase.from('ingredients').update(rest).eq('id', id).select().single()
			);
			return mapIngredient(row);
		},
		async delete(id: string): Promise<void> {
			await softDeleteRow('ingredients', id);
		}
	},
	ledger: {
		async list(opts?: { ingredientId?: string; limit?: number }): Promise<IngredientLedgerEntry[]> {
			let q = supabase
				.from('ingredient_ledger')
				.select('*, ingredients(name, unit), profiles(full_name)');
			if (opts?.ingredientId) q = q.eq('ingredient_id', opts.ingredientId);
			const rows = ok<Row[]>(
				await q.order('created_at', { ascending: false }).limit(opts?.limit ?? 100)
			);
			return rows.map(mapLedgerEntry);
		},
		addMovement: addLedgerMovement
	},
	stock: {
		async getAll(): Promise<IngredientStock[]> {
			return ingredientsDb.items.list();
		},
		async getLowStock(): Promise<IngredientStock[]> {
			const rows = ok<Row[]>(
				await supabase
					.from('ingredient_stock')
					.select('*')
					.eq('is_low_stock', true)
					.is('deleted_at', null)
					.order('name')
			);
			return rows.map(mapIngredientStock);
		}
	}
};

// ── Orders ──────────────────────────────────────────────────────────────────
export const ordersDb = {
	async create(input: {
		orderType: OrderType;
		customerId?: string | null;
		notes?: string | null;
		items: CartLineInput[];
	}): Promise<Order> {
		const worker = await currentUserId();
		const shift = await activeShiftId();
		const id = uuidv7();
		const lineTotals = input.items.map((i) => round2(i.unitPriceUsd * i.qty));
		const subtotal = round2(lineTotals.reduce((a, b) => a + b, 0));
		const orderRow = ok<Row>(
			await supabase
				.from('orders')
				.insert({
					id,
					worker_id: worker,
					shift_id: shift,
					customer_id: input.customerId ?? null,
					order_type: input.orderType,
					status: 'open',
					notes: input.notes ?? null,
					subtotal_usd: subtotal,
					discount_usd: 0,
					total_usd: subtotal
				})
				.select(ORDER_SELECT)
				.single()
		);
		if (input.items.length) {
			const payload = input.items.map((i, idx) => ({
				id: uuidv7(),
				order_id: id,
				menu_item_id: i.menuItemId,
				menu_item_snapshot: i.snapshot,
				qty: i.qty,
				unit_price_usd: i.unitPriceUsd,
				line_total_usd: lineTotals[idx],
				override_reason: i.overrideReason ?? null
			}));
			const ins = await supabase.from('order_items').insert(payload);
			if (ins.error) throw new Error(ins.error.message);
		}
		return mapOrder(orderRow);
	},
	async getById(id: string): Promise<OrderWithItems | null> {
		const orderRow = okMaybe<Row>(
			await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle()
		);
		if (!orderRow) return null;
		const itemRows = ok<Row[]>(
			await supabase.from('order_items').select('*').eq('order_id', id).order('created_at')
		);
		return { ...mapOrder(orderRow), items: itemRows.map(mapOrderItem) };
	},
	async list(opts?: {
		status?: OrderStatus;
		shiftId?: string;
		customerId?: string;
		limit?: number;
	}): Promise<Order[]> {
		let q = supabase.from('orders').select(ORDER_SELECT).is('deleted_at', null);
		if (opts?.status) q = q.eq('status', opts.status);
		if (opts?.shiftId) q = q.eq('shift_id', opts.shiftId);
		if (opts?.customerId) q = q.eq('customer_id', opts.customerId);
		const rows = ok<Row[]>(
			await q.order('created_at', { ascending: false }).limit(opts?.limit ?? 100)
		);
		return rows.map(mapOrder);
	},
	async listOpen(): Promise<OrderWithItems[]> {
		const rows = ok<Row[]>(
			await supabase
				.from('orders')
				.select(`${ORDER_SELECT}, order_items(*)`)
				.eq('status', 'open')
				.is('deleted_at', null)
				.order('created_at', { ascending: false })
		);
		return rows.map((r) => ({
			...mapOrder(r),
			items: ((r.order_items as Row[]) ?? []).map(mapOrderItem)
		}));
	},
	// Confirmed orders (with their items) for a shift — drives the close summary
	// (payment breakdown, Bs total, top items) from a single query.
	async listConfirmedForShift(shiftId: string, limit = 500): Promise<OrderWithItems[]> {
		const rows = ok<Row[]>(
			await supabase
				.from('orders')
				.select(`${ORDER_SELECT}, order_items(*)`)
				.eq('shift_id', shiftId)
				.eq('status', 'confirmed')
				.is('deleted_at', null)
				.order('created_at', { ascending: false })
				.limit(limit)
		);
		return rows.map((r) => ({
			...mapOrder(r),
			items: ((r.order_items as Row[]) ?? []).map(mapOrderItem)
		}));
	},
	async update(
		id: string,
		patch: { orderType?: OrderType; customerId?: string | null; notes?: string | null }
	): Promise<Order> {
		const dbPatch: Row = {};
		if (patch.orderType !== undefined) dbPatch.order_type = patch.orderType;
		if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId;
		if (patch.notes !== undefined) dbPatch.notes = patch.notes;
		const row = ok<Row>(
			await supabase.from('orders').update(dbPatch).eq('id', id).select(ORDER_SELECT).single()
		);
		return mapOrder(row);
	},
	async addItem(orderId: string, line: CartLineInput): Promise<OrderItem> {
		const lt = round2(line.unitPriceUsd * line.qty);
		const row = ok<Row>(
			await supabase
				.from('order_items')
				.insert({
					id: uuidv7(),
					order_id: orderId,
					menu_item_id: line.menuItemId,
					menu_item_snapshot: line.snapshot,
					qty: line.qty,
					unit_price_usd: line.unitPriceUsd,
					line_total_usd: lt,
					override_reason: line.overrideReason ?? null
				})
				.select()
				.single()
		);
		await recomputeOrderTotals(orderId);
		return mapOrderItem(row);
	},
	async removeItem(orderItemId: string): Promise<void> {
		const row = okMaybe<Row>(
			await supabase.from('order_items').select('order_id').eq('id', orderItemId).maybeSingle()
		);
		const { error } = await supabase.from('order_items').delete().eq('id', orderItemId);
		if (error) throw new Error(error.message);
		if (row) await recomputeOrderTotals(str(row.order_id));
	},
	async updateItemQty(orderItemId: string, qty: number): Promise<OrderItem> {
		const cur = ok<Row>(
			await supabase
				.from('order_items')
				.select('order_id, unit_price_usd')
				.eq('id', orderItemId)
				.single()
		);
		const lt = round2(num(cur.unit_price_usd) * qty);
		const row = ok<Row>(
			await supabase
				.from('order_items')
				.update({ qty, line_total_usd: lt })
				.eq('id', orderItemId)
				.select()
				.single()
		);
		await recomputeOrderTotals(str(cur.order_id));
		return mapOrderItem(row);
	},
	// Finalize an open order: set payment + totals, then write 'sale' ledger
	// movements by expanding each item's recipe (no DB trigger does this).
	async confirm(orderId: string, payment: ConfirmInput): Promise<Order> {
		const userId = await currentUserId();
		const order = await ordersDb.getById(orderId);
		if (!order) throw new Error('Pedido no encontrado');
		if (order.status !== 'open') throw new Error('orderNotOpen');
		if (order.items.length === 0) throw new Error('emptyOrder');

		const rate = Number(await settingsDb.get('usd_rate')) || 40;
		const discount = payment.discountUsd ?? order.discount_usd ?? 0;
		const lineTotals = order.items.map((i) => i.line_total_usd);
		const { subtotalUsd, totalUsd, totalBs } = computeTotals(lineTotals, discount, rate);

		const updated = ok<Row>(
			await supabase
				.from('orders')
				.update({
					status: 'confirmed',
					payment_method: payment.method,
					discount_usd: discount,
					subtotal_usd: subtotalUsd,
					total_usd: totalUsd,
					total_bs: totalBs,
					usd_rate_used: rate,
					paid_at: nowIso(),
					confirmed_by: userId
				})
				.eq('id', orderId)
				.eq('status', 'open')
				.select(ORDER_SELECT)
				.single()
		);

		const menuItemIds = order.items.map((i) => i.menu_item_id).filter((x): x is string => !!x);
		if (menuItemIds.length) {
			const recipeRows = ok<Row[]>(
				await supabase
					.from('recipes')
					.select('menu_item_id, ingredient_id, qty_required')
					.in('menu_item_id', menuItemIds)
			);
			const byItem = new Map<string, { ingredient_id: string; qty_required: number }[]>();
			for (const rr of recipeRows) {
				const mid = str(rr.menu_item_id);
				const arr = byItem.get(mid) ?? [];
				arr.push({ ingredient_id: str(rr.ingredient_id), qty_required: num(rr.qty_required) });
				byItem.set(mid, arr);
			}
			const drafts = expandRecipesToLedger(
				order.items.map((i) => ({ menu_item_id: i.menu_item_id, qty: i.qty })),
				byItem
			);
			if (drafts.length) {
				const ledgerPayload = drafts.map((d) => ({
					id: uuidv7(),
					ingredient_id: d.ingredient_id,
					qty_change: d.qty_change,
					reason: 'sale',
					order_id: orderId,
					shift_id: order.shift_id,
					actor_id: userId
				}));
				const ins = await supabase.from('ingredient_ledger').insert(ledgerPayload);
				if (ins.error) throw new Error(ins.error.message);
			}
		}
		return mapOrder(updated);
	},
	async cancel(orderId: string, reason: string): Promise<Order> {
		const userId = await currentUserId();
		const row = ok<Row>(
			await supabase
				.from('orders')
				.update({
					status: 'cancelled',
					cancelled_at: nowIso(),
					cancelled_by: userId,
					cancel_reason: reason
				})
				.eq('id', orderId)
				.select(ORDER_SELECT)
				.single()
		);
		return mapOrder(row);
	}
};

// ── Customers ───────────────────────────────────────────────────────────────
export const customersDb = {
	async list(): Promise<CustomerStats[]> {
		const rows = ok<Row[]>(
			await supabase.from('customer_stats').select('*').is('deleted_at', null).order('name')
		);
		return rows.map(mapCustomerStats);
	},
	async getById(id: string): Promise<CustomerStats | null> {
		const row = okMaybe<Row>(
			await supabase.from('customer_stats').select('*').eq('id', id).maybeSingle()
		);
		return row ? mapCustomerStats(row) : null;
	},
	async search(query: string): Promise<CustomerStats[]> {
		const term = query.replace(/[%,()]/g, ' ').trim();
		if (!term) return customersDb.list();
		const rows = ok<Row[]>(
			await supabase
				.from('customer_stats')
				.select('*')
				.is('deleted_at', null)
				.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
				.order('name')
		);
		return rows.map(mapCustomerStats);
	},
	async create(input: NewCustomer): Promise<Customer> {
		const row = ok<Row>(
			await supabase
				.from('customers')
				.insert({
					id: uuidv7(),
					name: input.name,
					phone: input.phone ?? null,
					source: input.source ?? 'walk_in',
					group_tag: input.group_tag ?? null,
					credit_balance_usd: input.credit_balance_usd ?? 0,
					notes: input.notes ?? null
				})
				.select()
				.single()
		);
		return mapCustomer(row);
	},
	async update(id: string, patch: Partial<NewCustomer>): Promise<Customer> {
		const row = ok<Row>(
			await supabase.from('customers').update(patch).eq('id', id).select().single()
		);
		return mapCustomer(row);
	},
	async softDelete(id: string): Promise<void> {
		await softDeleteRow('customers', id);
	},
	async orderHistory(customerId: string, limit = 10): Promise<Order[]> {
		const rows = ok<Row[]>(
			await supabase
				.from('orders')
				.select(ORDER_SELECT)
				.eq('customer_id', customerId)
				.eq('status', 'confirmed')
				.is('deleted_at', null)
				.order('created_at', { ascending: false })
				.limit(limit)
		);
		return rows.map(mapOrder);
	}
};

// ── Shifts ──────────────────────────────────────────────────────────────────
export const shiftsDb = {
	async getActive(): Promise<ActiveShift | null> {
		const row = okMaybe<Row>(await supabase.from('active_shift').select('*').maybeSingle());
		return row ? mapActiveShift(row) : null;
	},
	async open(openingCashUsd: number, notes?: string): Promise<Shift> {
		const userId = await currentUserId();
		const res = await supabase
			.from('shifts')
			.insert({
				id: uuidv7(),
				opened_by: userId,
				opening_cash_usd: openingCashUsd,
				notes: notes ?? null
			})
			.select()
			.single();
		if (res.error) {
			if (res.error.code === '23505') throw new Error('shiftAlreadyOpen');
			throw new Error(res.error.message);
		}
		return mapShift(res.data as Row);
	},
	async close(id: string, data: { closingCashUsd: number; notes?: string }): Promise<Shift> {
		const userId = await currentUserId();
		const shiftRow = ok<Row>(
			await supabase.from('shifts').select('opening_cash_usd').eq('id', id).single()
		);
		const cashOrders = ok<Row[]>(
			await supabase
				.from('orders')
				.select('total_usd')
				.eq('shift_id', id)
				.eq('status', 'confirmed')
				.eq('payment_method', 'cash_usd')
				.is('deleted_at', null)
		);
		const cashSales = round2(cashOrders.reduce((s, r) => s + num(r.total_usd), 0));
		const expected = expectedCash(num(shiftRow.opening_cash_usd), cashSales);
		const varc = variance(data.closingCashUsd, expected);
		const patch: Row = {
			closed_by: userId,
			closed_at: nowIso(),
			closing_cash_usd: data.closingCashUsd,
			expected_cash_usd: expected,
			variance_usd: varc
		};
		if (data.notes !== undefined) patch.notes = data.notes;
		const row = ok<Row>(await supabase.from('shifts').update(patch).eq('id', id).select().single());
		return mapShift(row);
	},
	async getById(id: string): Promise<Shift | null> {
		const row = okMaybe<Row>(await supabase.from('shifts').select('*').eq('id', id).maybeSingle());
		return row ? mapShift(row) : null;
	},
	async list(limit = 20): Promise<Shift[]> {
		const rows = ok<Row[]>(
			await supabase
				.from('shifts')
				.select('*')
				.is('deleted_at', null)
				.order('opened_at', { ascending: false })
				.limit(limit)
		);
		return rows.map(mapShift);
	}
};

// ── Settings ────────────────────────────────────────────────────────────────
export const settingsDb = {
	async getAll(): Promise<Record<string, string | null>> {
		const rows = ok<Row[]>(await supabase.from('settings').select('key, value'));
		const out: Record<string, string | null> = {};
		for (const r of rows) out[str(r.key)] = strN(r.value);
		return out;
	},
	async get(key: string): Promise<string | null> {
		const row = okMaybe<Row>(
			await supabase.from('settings').select('value').eq('key', key).maybeSingle()
		);
		return row ? strN(row.value) : null;
	},
	async set(key: string, value: string): Promise<void> {
		const userId = await currentUserId();
		const { error } = await supabase
			.from('settings')
			.update({ value, updated_by: userId, updated_at: nowIso() })
			.eq('key', key);
		if (error) throw new Error(error.message);
	}
};

export type { Setting };

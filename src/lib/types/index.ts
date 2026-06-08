// Single source of truth for all row, view, and frontend DTO types.
// Numeric columns are typed `number` here; db.ts coerces the strings PostgREST
// returns for Postgres `numeric` columns into real numbers via its mappers.

// ── Literal unions (match the schema CHECK constraints exactly) ──────────────
export type Role = 'owner' | 'worker';
export type Unit = 'unit' | 'g' | 'ml' | 'kg' | 'l';
export type LedgerReason =
	| 'sale'
	| 'restock'
	| 'adjustment'
	| 'waste'
	| 'manual_override'
	| 'opening_count';
export type OrderStatus = 'open' | 'confirmed' | 'cancelled';
export type OrderType = 'dine_in' | 'takeout';
export type PaymentMethod =
	| 'cash_usd'
	| 'cash_bs'
	| 'card'
	| 'pagomovil'
	| 'transfer'
	| 'zinli'
	| 'binance'
	| 'paypal'
	| 'credit';
export type CustomerSource = 'walk_in' | 'regular' | 'delivery' | 'referred' | 'other';
export type GroupTag = 'vip' | 'regular' | 'crew' | 'wholesale';

// ── Table rows ──────────────────────────────────────────────────────────────
export interface Profile {
	id: string;
	full_name: string;
	role: Role;
	pin: string | null;
	avatar_url: string | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Shift {
	id: string;
	shift_number: number;
	opened_by: string;
	closed_by: string | null;
	opened_at: string;
	closed_at: string | null;
	opening_cash_usd: number;
	closing_cash_usd: number | null;
	expected_cash_usd: number | null;
	variance_usd: number | null;
	notes: string | null;
	telegram_report_sent: boolean;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface ActiveShift extends Shift {
	opened_by_name: string | null;
	confirmed_orders: number;
	total_sales_usd: number;
}

export interface IngredientCategory {
	id: string;
	name: string;
	color: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Ingredient {
	id: string;
	category_id: string | null;
	name: string;
	unit: Unit;
	min_stock: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

// Shape returned by the `ingredient_stock` view (stock computed, never stored).
export interface IngredientStock {
	id: string;
	name: string;
	unit: Unit;
	min_stock: number;
	category_id: string | null;
	category_name: string | null;
	category_color: string | null;
	current_stock: number;
	is_low_stock: boolean;
	is_out_of_stock: boolean;
	deleted_at: string | null;
}

export interface IngredientLedgerEntry {
	id: string;
	ingredient_id: string;
	order_id: string | null;
	shift_id: string | null;
	actor_id: string;
	qty_change: number;
	reason: LedgerReason;
	note: string | null;
	created_at: string;
	// Joined for display (optional)
	ingredient_name?: string | null;
	ingredient_unit?: Unit | null;
	actor_name?: string | null;
}

export interface MenuCategory {
	id: string;
	name: string;
	color: string;
	emoji: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface MenuItem {
	id: string;
	category_id: string | null;
	name: string;
	description: string | null;
	price_usd: number;
	is_available: boolean;
	image_url: string | null;
	sort_order: number;
	// Joined from menu_categories (optional)
	category_name: string | null;
	category_color: string | null;
	category_emoji: string | null;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

export interface Recipe {
	id: string;
	menu_item_id: string;
	ingredient_id: string;
	qty_required: number;
	created_at: string;
	updated_at: string;
}

export interface RecipeLine extends Recipe {
	ingredient_name: string;
	unit: Unit;
}

export interface Customer {
	id: string;
	name: string;
	phone: string | null;
	source: CustomerSource;
	group_tag: GroupTag | null;
	credit_balance_usd: number;
	notes: string | null;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
}

// Shape returned by the `customer_stats` view (totals computed, never stored).
export interface CustomerStats {
	id: string;
	name: string;
	phone: string | null;
	source: CustomerSource;
	group_tag: GroupTag | null;
	credit_balance_usd: number;
	notes: string | null;
	created_at: string;
	deleted_at: string | null;
	purchase_count: number;
	total_spent_usd: number;
	last_purchase_at: string | null;
}

export interface MenuItemSnapshot {
	name: string;
	price_usd: number;
	category_name: string | null;
}

export interface OrderItem {
	id: string;
	order_id: string;
	menu_item_id: string | null;
	menu_item_snapshot: MenuItemSnapshot;
	qty: number;
	unit_price_usd: number;
	line_total_usd: number;
	override_reason: string | null;
	created_at: string;
	updated_at: string;
}

export interface Order {
	id: string;
	order_number: number;
	shift_id: string | null;
	customer_id: string | null;
	worker_id: string;
	order_type: OrderType;
	status: OrderStatus;
	subtotal_usd: number;
	discount_usd: number;
	total_usd: number;
	total_bs: number | null;
	usd_rate_used: number | null;
	payment_method: PaymentMethod | null;
	paid_at: string | null;
	confirmed_by: string | null;
	cancelled_at: string | null;
	cancelled_by: string | null;
	cancel_reason: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
	// Joined for display (optional)
	worker_name?: string | null;
	customer_name?: string | null;
}

export interface OrderWithItems extends Order {
	items: OrderItem[];
}

export interface Setting {
	id: string;
	key: string;
	value: string | null;
	description: string | null;
	updated_by: string | null;
	updated_at: string;
}

// ── Frontend-only DTOs ──────────────────────────────────────────────────────
export interface CartItem {
	menuItem: MenuItem;
	qty: number;
	overrideReason?: string;
}

export interface CartLineInput {
	menuItemId: string | null;
	snapshot: MenuItemSnapshot;
	qty: number;
	unitPriceUsd: number;
	overrideReason?: string;
}

export interface AuthUser {
	id: string;
	email: string | null;
}

export interface AuthSession {
	user: AuthUser;
}

// ── Insert / update payload types ───────────────────────────────────────────
export interface NewProfile {
	id: string;
	full_name: string;
	role?: Role;
	pin?: string | null;
	avatar_url?: string | null;
}

export interface NewMenuCategory {
	name: string;
	color?: string;
	emoji?: string | null;
	sort_order?: number;
}

export interface NewMenuItem {
	name: string;
	category_id?: string | null;
	description?: string | null;
	price_usd: number;
	is_available?: boolean;
	image_url?: string | null;
	sort_order?: number;
}

export interface NewIngredientCategory {
	name: string;
	color?: string;
	sort_order?: number;
}

export interface NewIngredient {
	name: string;
	category_id?: string | null;
	unit?: Unit;
	min_stock?: number;
	openingCount?: number;
}

export interface NewCustomer {
	name: string;
	phone?: string | null;
	source?: CustomerSource;
	group_tag?: GroupTag | null;
	credit_balance_usd?: number;
	notes?: string | null;
}

export interface RecipeInput {
	ingredient_id: string;
	qty_required: number;
}

export interface LedgerMovementInput {
	ingredientId: string;
	qtyChange: number;
	reason: LedgerReason;
	note?: string | null;
	orderId?: string | null;
}

export interface ConfirmInput {
	method: PaymentMethod;
	discountUsd?: number;
}

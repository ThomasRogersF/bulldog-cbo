// Spanish (es-VE) message catalog for Bulldog CBO.
// Every user-facing string lives here and is read via t() — see ../index.ts.
export const es = {
	nav: {
		dashboard: 'Panel',
		pos: 'Punto de venta',
		orders: 'Pedidos',
		menu: 'Menú',
		ingredients: 'Ingredientes',
		customers: 'Clientes',
		shifts: 'Turnos',
		settings: 'Configuración'
	},
	pos: {
		cart: 'Carrito',
		addToOrder: 'Agregar al pedido',
		confirm: 'Confirmar',
		cancel: 'Cancelar',
		total: 'Total',
		subtotal: 'Subtotal',
		paymentMethod: 'Método de pago'
	},
	orderType: {
		dine_in: 'Para aquí',
		takeout: 'Para llevar'
	},
	payment: {
		cash_usd: 'Efectivo (USD)',
		cash_bs: 'Efectivo (Bs)',
		card: 'Tarjeta',
		pagomovil: 'Pago móvil',
		transfer: 'Transferencia',
		zinli: 'Zinli',
		binance: 'Binance'
	},
	status: {
		open: 'Abierto',
		confirmed: 'Confirmado',
		cancelled: 'Cancelado'
	},
	common: {
		save: 'Guardar',
		cancel: 'Cancelar',
		delete: 'Eliminar',
		edit: 'Editar',
		search: 'Buscar',
		loading: 'Cargando…',
		error: 'Error',
		success: 'Listo'
	},
	ingredientReason: {
		sale: 'Venta',
		restock: 'Reabastecimiento',
		adjustment: 'Ajuste',
		waste: 'Merma',
		manual_override: 'Corrección manual'
	},
	customerSource: {
		walk_in: 'Cliente de paso',
		regular: 'Cliente frecuente',
		delivery: 'Delivery',
		referred: 'Referido',
		other: 'Otro'
	},
	customerGroup: {
		vip: 'VIP',
		regular: 'Regular',
		crew: 'Equipo',
		wholesale: 'Mayorista'
	}
} as const;

export type Messages = typeof es;

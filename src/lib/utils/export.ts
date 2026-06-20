import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
	key: string;
	label: string;
	format?: (value: unknown, row: Record<string, unknown>) => string;
}

export interface ExportOptions {
	filename: string;
	title: string;
	subtitle?: string;
	columns: ExportColumn[];
	rows: Record<string, unknown>[];
}

function resolveRow(row: Record<string, unknown>, columns: ExportColumn[]): string[] {
	return columns.map((col) => {
		const raw = row[col.key];
		if (col.format) return col.format(raw, row);
		if (raw === null || raw === undefined) return '';
		return String(raw);
	});
}

export function exportCSV(opts: ExportOptions) {
	const headers = opts.columns.map((c) => c.label);
	const lines = [headers, ...opts.rows.map((r) => resolveRow(r, opts.columns))];

	const csv = lines
		.map((line) =>
			line
				.map((cell) => {
					const str = String(cell ?? '');
					if (/[",\n]/.test(str)) {
						return `"${str.replace(/"/g, '""')}"`;
					}
					return str;
				})
				.join(',')
		)
		.join('\r\n');

	// BOM for proper UTF-8/accent rendering in Excel
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
	downloadBlob(blob, `${opts.filename}.csv`);
}

export function exportExcel(opts: ExportOptions) {
	const headers = opts.columns.map((c) => c.label);
	const data = [headers, ...opts.rows.map((r) => resolveRow(r, opts.columns))];

	const ws = XLSX.utils.aoa_to_sheet(data);

	const colWidths = opts.columns.map((col, i) => {
		const maxLen = Math.max(
			col.label.length,
			...opts.rows.map((r) => String(resolveRow(r, opts.columns)[i] ?? '').length)
		);
		return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
	});
	ws['!cols'] = colWidths;

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, opts.title.slice(0, 31));

	XLSX.writeFile(wb, `${opts.filename}.xlsx`);
}

export function exportPDF(opts: ExportOptions) {
	const doc = new jsPDF({ orientation: opts.columns.length > 5 ? 'landscape' : 'portrait' });

	doc.setFontSize(16);
	doc.setFont('helvetica', 'bold');
	doc.text('Bulldog CBO', 14, 16);

	doc.setFontSize(12);
	doc.setFont('helvetica', 'normal');
	doc.text(opts.title, 14, 24);

	if (opts.subtitle) {
		doc.setFontSize(9);
		doc.setTextColor(120);
		doc.text(opts.subtitle, 14, 30);
		doc.setTextColor(0);
	}

	const headers = opts.columns.map((c) => c.label);
	const body = opts.rows.map((r) => resolveRow(r, opts.columns));

	autoTable(doc, {
		head: [headers],
		body,
		startY: opts.subtitle ? 35 : 30,
		theme: 'grid',
		headStyles: {
			fillColor: [253, 205, 1],
			textColor: [0, 0, 0],
			fontStyle: 'bold'
		},
		styles: {
			fontSize: 8,
			cellPadding: 3
		},
		alternateRowStyles: {
			fillColor: [245, 245, 245]
		},
		margin: { top: 35 }
	});

	const pageCount = doc.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		doc.setFontSize(7);
		doc.setTextColor(150);
		const ts = new Date().toLocaleString('es-VE');
		doc.text(
			`Generado el ${ts} — Página ${i} de ${pageCount}`,
			14,
			doc.internal.pageSize.height - 8
		);
	}

	doc.save(`${opts.filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export function dateFilename(prefix: string): string {
	const today = new Date().toISOString().slice(0, 10);
	return `${prefix}-${today}`;
}

export interface CompressOptions {
	maxWidth?: number;
	maxHeight?: number;
	quality?: number;
	format?: 'image/webp' | 'image/jpeg';
}

export interface CompressResult {
	blob: Blob;
	width: number;
	height: number;
	originalSize: number;
	compressedSize: number;
	compressionRatio: number;
}

/**
 * Compress an image file client-side using Canvas API.
 * Preserves aspect ratio, converts to WebP by default.
 * No dependencies — works in any modern browser.
 */
export async function compressImage(
	file: File,
	options: CompressOptions = {}
): Promise<CompressResult> {
	const { maxWidth = 800, maxHeight = 800, quality = 0.82, format = 'image/webp' } = options;

	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			let { width, height } = img;
			if (width > maxWidth || height > maxHeight) {
				const ratio = Math.min(maxWidth / width, maxHeight / height);
				width = Math.round(width * ratio);
				height = Math.round(height * ratio);
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0, width, height);

			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('Canvas toBlob failed'));
						return;
					}
					resolve({
						blob,
						width,
						height,
						originalSize: file.size,
						compressedSize: blob.size,
						compressionRatio: blob.size / file.size
					});
				},
				format,
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to load image'));
		};

		img.src = objectUrl;
	});
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function menuImagePath(menuItemId: string, format = 'webp'): string {
	const timestamp = Date.now();
	return `menu-items/${menuItemId}/${timestamp}.${format}`;
}

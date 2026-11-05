/**
 * Seção 9 / RNF16 / RF25 — Compressão e Conversão Automática de Imagens no Navegador
 * - Formato alvo: WebP (qualidade inicial 80%, ajustada automaticamente para respeitar limite de peso)
 * - Produtos (1:1): máx 800 x 800 px, mín 600 x 600 px, limite absoluto <= 200 KB (alvo 100-200 KB)
 * - Capa / Banner (16:9): máx 1200 x 675 px, limite <= 300 KB (alvo 100-300 KB)
 */

export interface CompressedImageResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  sizeKB: number;
  originalSizeKB: number;
  format: 'image/webp';
  qualityUsed: number;
}

export async function compressAndConvertToWebP(
  file: File,
  mode: 'product' | 'cover'
): Promise<CompressedImageResult> {
  const originalSizeKB = Math.round((file.size / 1024) * 10) / 10;

  const img = await loadImageFromFile(file);

  // Validação de dimensão mínima para foto de produto (Seção 9: mín 600x600 px)
  if (mode === 'product' && (img.width < 600 || img.height < 600)) {
    throw new Error(
      `Imagem recusada (${img.width}x${img.height} px): as fotos de produtos devem ter no mínimo 600 x 600 px para garantir nitidez no cardápio (Seção 9).`
    );
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível inicializar o processador gráfico do navegador.');
  }

  let targetWidth: number;
  let targetHeight: number;
  let sx = 0;
  let sy = 0;
  let sWidth = img.width;
  let sHeight = img.height;

  if (mode === 'product') {
    // Aspect Ratio 1:1 (Crop central quadrado, redimensionado entre 600x600 e 800x800 px)
    const minSide = Math.min(img.width, img.height);
    sx = Math.floor((img.width - minSide) / 2);
    sy = Math.floor((img.height - minSide) / 2);
    sWidth = minSide;
    sHeight = minSide;

    const finalSide = Math.min(800, Math.max(600, minSide));
    targetWidth = finalSide;
    targetHeight = finalSide;
  } else {
    // Aspect Ratio 16:9 (Máximo 1200 x 675 px)
    const targetRatio = 16 / 9;
    const currentRatio = img.width / img.height;

    if (currentRatio > targetRatio) {
      sWidth = Math.floor(img.height * targetRatio);
      sx = Math.floor((img.width - sWidth) / 2);
    } else {
      sHeight = Math.floor(img.width / targetRatio);
      sy = Math.floor((img.height - sHeight) / 2);
    }

    targetWidth = Math.min(1200, sWidth);
    targetHeight = Math.round(targetWidth / targetRatio);
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  const maxKB = mode === 'product' ? 200 : 300;
  let quality = 0.8; // Padrão inicial: 80% de qualidade
  let blob = await canvasToWebPBlob(canvas, quality);

  // Ajuste automático de qualidade até atingir o limite de peso (máx 200 KB para pratos / 300 KB para capa)
  while (blob.size / 1024 > maxKB && quality > 0.25) {
    quality = Number((quality - 0.08).toFixed(2));
    blob = await canvasToWebPBlob(canvas, quality);
  }

  const dataUrl = await blobToDataUrl(blob);
  const sizeKB = Math.round((blob.size / 1024) * 10) / 10;

  return {
    dataUrl,
    blob,
    width: targetWidth,
    height: targetHeight,
    sizeKB,
    originalSizeKB,
    format: 'image/webp',
    qualityUsed: Math.round(quality * 100),
  };
}

/**
 * Gera um arquivo PNG sintético de ~5 MB em alta resolução (1600x1600 px)
 * para testar diretamente no navegador o Critério de Aceitação 14 (PNG 5MB -> WebP <= 800x800 e <= 200KB).
 */
export async function generateSample5MBPngFile(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d')!;

  // Fundo rico com gradiente gastronômico
  const grad = ctx.createLinearGradient(0, 0, 1600, 1600);
  grad.addColorStop(0, '#14532d');
  grad.addColorStop(0.5, '#15803d');
  grad.addColorStop(1, '#ea580c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1600, 1600);

  // Textura detalhada para atingir ~5 MB em PNG
  for (let i = 0; i < 4500; i++) {
    ctx.fillStyle = `rgba(${(i * 73) % 255}, ${(i * 151) % 255}, ${(i * 37) % 255}, 0.28)`;
    ctx.beginPath();
    ctx.arc((i * 97) % 1600, (i * 53) % 1600, 18 + (i % 45), 0, Math.PI * 2);
    ctx.fill();
  }

  // Prato ilustrativo central
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(800, 800, 460, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#166534';
  ctx.font = 'bold 78px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PedeUmTrem Especial', 800, 770);
  ctx.font = '52px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('Foto Teste Alta Resolução (1600x1600)', 800, 855);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png');
  });

  // Se o PNG comprimido pelo browser ficar menor que 5MB, anexa padding seguro no final do Blob para simular exatamente 5.1 MB
  const targetBytes = 5 * 1024 * 1024 + 102400; // ~5.1 MB
  let finalBlob = pngBlob;
  if (pngBlob.size < targetBytes) {
    const padding = new Uint8Array(targetBytes - pngBlob.size);
    finalBlob = new Blob([pngBlob, padding], { type: 'image/png' });
  }

  return new File([finalBlob], 'prato-alta-resolucao-5mb.png', { type: 'image/png' });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Arquivo de imagem inválido ou corrompido.'));
    };
    img.src = url;
  });
}

function canvasToWebPBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Falha ao converter imagem para WebP.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao gerar pré-visualização da imagem.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler dados da imagem.'));
    reader.readAsDataURL(blob);
  });
}

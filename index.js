import { exec } from 'child_process';
import fs from 'fs';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import path from 'path';

const inputDir = 'input';
const outputDir = 'output';
const CONCURRENCY = 6;

// --- Obtener tamaño de carpeta (recursivo) ---
function getFolderSize(folderPath) {
  let totalSize = 0;

  if (!fs.existsSync(folderPath)) return 0;

  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const fullPath = path.join(folderPath, file);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      totalSize += getFolderSize(fullPath);
    } else {
      totalSize += stats.size;
    }
  }

  return totalSize;
}


// --- Formatear bytes a MB ---
function formatMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}


// --- Limpiar carpeta output ---
function cleanOutputFolder(folderPath) {
  console.log('🧹 Cleaning output folder...');
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}


// --- Nombre desde CLI ---
const newName = process.argv[2];
if (!newName) {
  console.error('❌ Provide name. Example: pnpm convert HM_12');
  process.exit(1);
}

const initialSize = getFolderSize(inputDir);
console.log(`📦 Input size: ${formatMB(initialSize)} MB`);

cleanOutputFolder(outputDir);
fs.mkdirSync(outputDir, { recursive: true });


// --- Detectar subcarpeta ---
let folderPath = null;

const subfolders = fs.existsSync(inputDir)
  ? fs.readdirSync(inputDir).filter(f =>
    fs.lstatSync(path.join(inputDir, f)).isDirectory()
  )
  : [];

if (subfolders.length) {
  folderPath = path.join(inputDir, subfolders[0]);
  console.log(`📂 Processing folder: ${subfolders[0]}`);
}


// --- Optimizar imagen ---
async function optimizeImage(inputFile, outputDestination) {
  try {
    const files = await imagemin([inputFile], {
      destination: outputDestination,
      plugins: [imageminWebp({ quality: 75 })],
    });
    return files.length;
  } catch (err) {
    console.error(`❌ Error optimizing: ${inputFile}`);
    return 0;
  }
}


// --- Extraer número original ---
function extractNumber(filename) {
  const match = filename.match(/-(\d+)(?=\.[^.]+$)/);
  return match ? match[1] : null;
}


// --- Comprimir PDF ---
function compressPDF(inputPath, outputPath, quality = '/ebook') {
  return new Promise((resolve, reject) => {
    const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 \
-dPDFSETTINGS=${quality} -dNOPAUSE -dQUIET -dBATCH \
-sOutputFile="${outputPath}" "${inputPath}"`;

    exec(cmd, (error, _, stderr) => {
      if (error) {
        console.error(`❌ PDF compress error: ${stderr || error.message}`);
        reject(error);
        return;
      }

      const sizeMB =
        fs.statSync(outputPath).size / (1024 * 1024);

      console.log(
        `✅ Compressed PDF → ${path.basename(outputPath)} (${sizeMB.toFixed(2)} MB)`
      );

      resolve();
    });
  });
}


// --- MAIN ---
(async () => {
  console.log('🚀 Starting optimization...');

  if (folderPath && fs.existsSync(folderPath)) {
    const outputSubDir = path.join(outputDir, newName);
    fs.mkdirSync(outputSubDir, { recursive: true });

    // Obtener imágenes ordenadas correctamente
    const images = fs
      .readdirSync(folderPath)
      .filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i))
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

    // Detectar padding automáticamente
    const digits = Math.max(
      ...images
        .map(f => extractNumber(f))
        .filter(Boolean)
        .map(n => n.length),
      3
    );

    // Procesador individual
    const processImage = async file => {
      const inputPath = path.join(folderPath, file);

      const optimized = await optimizeImage(
        inputPath,
        outputSubDir
      );

      if (!optimized) return;

      const originalBase = path.basename(
        file,
        path.extname(file)
      );

      const tempWebp = path.join(
        outputSubDir,
        `${originalBase}.webp`
      );

      if (!fs.existsSync(tempWebp)) return;

      const number =
        extractNumber(file)?.padStart(digits, '0') ||
        path.parse(file).name;

      const finalPath = path.join(
        outputSubDir,
        `${newName}-${number}.webp`
      );

      fs.renameSync(tempWebp, finalPath);
      // console.log(`🖼️ ${path.basename(finalPath)}`);
    };

    // Paralelización con límite
    for (let i = 0; i < images.length; i += CONCURRENCY) {
      await Promise.all(
        images.slice(i, i + CONCURRENCY).map(processImage)
      );
    }
  }


  // PDF + imagen raíz
  const mainFiles = fs.readdirSync(inputDir)
    .filter(f =>
      !fs.lstatSync(path.join(inputDir, f)).isDirectory()
    );

  for (const file of mainFiles) {
    const inputPath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();

    if (ext === '.pdf') {
      const outputPath = path.join(outputDir, `${newName}.pdf`);
      const sizeMB =
        fs.statSync(inputPath).size / (1024 * 1024);

      console.log(`📄 PDF size: ${sizeMB.toFixed(2)} MB`);

      if (sizeMB >= 15) {
        try {
          await compressPDF(inputPath, outputPath);
        } catch {
          fs.copyFileSync(inputPath, outputPath);
        }
      } else {
        fs.copyFileSync(inputPath, outputPath);
      }
    }

    else if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
      const optimized = await optimizeImage(inputPath, outputDir);

      if (!optimized) continue;

      const base = path.basename(file, ext);
      const tempWebp = path.join(outputDir, `${base}.webp`);
      const finalPath = path.join(outputDir, `${newName}.webp`);

      if (fs.existsSync(tempWebp)) {
        fs.renameSync(tempWebp, finalPath);
      }
    }
  }

  const finalSize = getFolderSize(outputDir);

  console.log(`📦 Output size: ${formatMB(finalSize)} MB`);

  const reduction = initialSize - finalSize;
  const reductionPercent = initialSize
    ? ((reduction / initialSize) * 100).toFixed(2)
    : 0;

  console.log(`📉 Reduction: ${formatMB(reduction)} MB (${reductionPercent}%)`);
  console.log('🎉 Done!');
})();

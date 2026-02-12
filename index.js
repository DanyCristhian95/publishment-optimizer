import { exec } from 'child_process';
import fs from 'fs';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import path from 'path';

const inputDir = 'input';
const outputDir = 'output';

// --- Limpiar carpeta output ---
function cleanOutputFolder(folderPath) {
  console.log('🧹 - Cleaning output folder.');
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log('✅ - Output folder empty.');
  }
}

// Nombre nuevo desde CLI
const newName = process.argv[2];
if (!newName) {
  console.error('❌ - Provide name. Example: pnpm convert HM_12');
  process.exit(1);
}

cleanOutputFolder(outputDir);
fs.mkdirSync(outputDir, { recursive: true });


// --- Detectar subcarpeta dentro de input ---
let folderPath = null;
const subfolders = fs.existsSync(inputDir)
  ? fs.readdirSync(inputDir).filter(f =>
    fs.lstatSync(path.join(inputDir, f)).isDirectory()
  )
  : [];

if (subfolders.length > 0) {
  folderPath = path.join(inputDir, subfolders[0]);
  console.log(`📂 - Processing folder: ${subfolders[0]}`);
} else {
  console.log('📁 - No subfolder found.');
}


// --- Optimizar imágenes ---
async function optimizeImages(inputFile, outputDestination) {
  try {
    const files = await imagemin([inputFile], {
      destination: outputDestination,
      plugins: [imageminWebp({ quality: 75 })],
    });
    return files.length;
  } catch {
    return 0;
  }
}


// --- Comprimir PDF ---
function compressPDF(inputPath, outputPath, quality = '/ebook') {
  return new Promise((resolve, reject) => {
    const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${quality} \
-dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;

    exec(command, (error, _, stderr) => {
      if (error) {
        console.error(`❌ PDF compress error: ${stderr || error.message}`);
        reject(error);
      } else {
        const sizeMB =
          fs.statSync(outputPath).size / (1024 * 1024);

        console.log(
          `✅ - Compressed PDF → ${path.basename(outputPath)} (${sizeMB.toFixed(2)} MB)`
        );

        resolve();
      }
    });
  });
}


// --- MAIN ---
(async () => {
  console.log('🚀 - Starting optimization...');

  // 🖼️ IMÁGENES DE SUBCARPETA
  if (folderPath && fs.existsSync(folderPath)) {
    const outputSubDir = path.join(outputDir, newName);
    fs.mkdirSync(outputSubDir, { recursive: true });

    const images = fs.readdirSync(folderPath)
      .filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i));

    let counter = 1;

    for (const file of images) {
      const inputPath = path.join(folderPath, file);

      const optimized = await optimizeImages(
        inputPath,
        outputSubDir
      );

      if (optimized > 0) {
        const originalBase = path.basename(
          file,
          path.extname(file)
        );

        const tempWebp = path.join(
          outputSubDir,
          `${originalBase}.webp`
        );

        const finalName =
          `${newName}-${counter++}.webp`;

        const finalPath = path.join(
          outputSubDir,
          finalName
        );

        if (fs.existsSync(tempWebp)) {
          fs.renameSync(tempWebp, finalPath);
          // console.log(`🖼️ ${finalName}`);
        }
      }
    }
  }


  // 📄 PDF + imagen principal en raíz input
  const mainFiles = fs.readdirSync(inputDir)
    .filter(f =>
      !fs.lstatSync(path.join(inputDir, f)).isDirectory()
    );

  for (const file of mainFiles) {
    const inputPath = path.join(inputDir, file);
    const ext = path.extname(file).toLowerCase();

    // PDF
    if (ext === '.pdf') {
      const outputPath = path.join(outputDir, `${newName}.pdf`);
      const sizeMB =
        fs.statSync(inputPath).size / (1024 * 1024);

      console.log(`📄 - PDF size: ${sizeMB.toFixed(2)} MB`);

      if (sizeMB >= 15) {
        console.log('⚙️ - Compressing PDF...');
        try {
          await compressPDF(inputPath, outputPath);
        } catch {
          fs.copyFileSync(inputPath, outputPath);
        }
      } else {
        fs.copyFileSync(inputPath, outputPath);
        console.log(`✅ - Copied PDF → ${newName}.pdf`);
      }
    }

    // Imagen principal
    else if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
      const optimized = await optimizeImages(inputPath, outputDir);

      if (optimized > 0) {
        const base = path.basename(file, ext);
        const tempWebp = path.join(outputDir, `${base}.webp`);
        const finalPath = path.join(outputDir, `${newName}.webp`);

        if (fs.existsSync(tempWebp)) {
          fs.renameSync(tempWebp, finalPath);
          // console.log(`🖼️ Main image → ${newName}.webp`);
        }
      }
    }
  }

  console.log('🎉 - Done!');
})();

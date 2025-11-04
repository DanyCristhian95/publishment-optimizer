import { exec } from 'child_process';
import fs from 'fs';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import path from 'path';

const inputDir = "input";
const outputDir = "output";

// --- 0. Limpiar la carpeta de salida ---
function cleanOutputFolder(folderPath) {
  console.log('🧹 - Cleaning output folder.');
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log('✅ - Output folder empty.');
  }
}

// Get new name from command argument
const newName = process.argv[2];
if (!newName) {
  console.error("❌ - Please provide a new name. Example: pnpm convert HM_12");
  process.exit(1);
}

// Clean output folder
cleanOutputFolder(outputDir);

// --- Setup and Folder Identification ---

let folderName = null;
let folderPath = null;
let outputSubDir = null;

const subfolders = fs.existsSync(inputDir)
  ? fs.readdirSync(inputDir).filter((f) => fs.lstatSync(path.join(inputDir, f)).isDirectory())
  : [];

if (subfolders.length > 0) {
  folderName = subfolders[0];
  folderPath = path.join(inputDir, folderName);
  outputSubDir = path.join(outputDir, newName);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  if (!fs.existsSync(outputSubDir)) fs.mkdirSync(outputSubDir);
  console.log(`📂 - Processing folder: ${folderName}`);
} else {
  console.log('📁 - No subfolder found. Skipping inner images.');
}

// --- Optimization Functions ---

async function optimizeImages(inputGlob, outputDestination) {
  try {
    const files = await imagemin([inputGlob], {
      destination: outputDestination,
      plugins: [imageminWebp({ quality: 75 })],
    });
    return files.length;
  } catch {
    return 0;
  }
}

function compressPDF(inputPath, outputPath, quality = '/screen') {
  return new Promise((resolve, reject) => {
    const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${quality} \
-dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
    exec(command, (error, _, stderr) => {
      if (error) {
        console.error(`❌ - Error compressing PDF: ${stderr || error.message}`);
        reject(error);
      } else {
        console.log(`✅ - Compressed PDF → ${path.basename(outputPath)}`);
        resolve();
      }
    });
  });
}

// --- Main Processing Logic ---
(async () => {
  console.log('🚀 - Starting optimization and renaming...');

  // 1️⃣ Process inner images if folder exists
  if (folderPath && fs.existsSync(folderPath)) {
    const innerFiles = fs.readdirSync(folderPath).filter((f) => f.match(/\.(webp|jpg|jpeg|png)$/i));
    for (const file of innerFiles) {
      const number = file.match(/\d+/)?.[0];
      if (!number) continue;

      const finalNewFileName = `${newName}-${number}.webp`;
      const tempInputPath = path.join(folderPath, file);
      const finalOutputPath = path.join(outputSubDir, finalNewFileName);

      const optimized = await optimizeImages(tempInputPath, path.dirname(finalOutputPath));
      if (optimized > 0) {
        const originalBasename = path.basename(file, path.extname(file));
        const imageminCreatedFile = path.join(outputSubDir, `${originalBasename}.webp`);
        if (fs.existsSync(imageminCreatedFile)) fs.renameSync(imageminCreatedFile, finalOutputPath);
      }
    }
  }

  // 2️⃣ Process main image and PDF in input folder (optional)
  if (fs.existsSync(inputDir)) {
    const mainFiles = fs.readdirSync(inputDir).filter((f) => !fs.lstatSync(path.join(inputDir, f)).isDirectory());
    for (const file of mainFiles) {
      const ext = path.extname(file).toLowerCase();
      const inputPath = path.join(inputDir, file);

      if (ext === '.pdf') {
        const outputPath = path.join(outputDir, `${newName}${ext}`);
        const stats = fs.statSync(inputPath);
        const sizeInMB = stats.size / (1024 * 1024);

        console.log(`📄 - PDF size: ${sizeInMB.toFixed(2)} MB`);

        if (sizeInMB >= 15) {
          console.log('⚙️ - File >= 15 MB → optimizing...');
          await compressPDF(inputPath, outputPath);
        } else {
          console.log('📋 - File < 15 MB → copying directly...');
          fs.copyFileSync(inputPath, outputPath);
          console.log(`✅ - Copied PDF → ${path.basename(outputPath)}`);
        }
      } else if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
        const finalOutputPath = path.join(outputDir, `${newName}.webp`);
        const optimized = await optimizeImages(inputPath, outputDir);
        if (optimized > 0) {
          const originalBasename = path.basename(file, path.extname(file));
          const imageminCreatedFile = path.join(outputDir, `${originalBasename}.webp`);
          if (fs.existsSync(imageminCreatedFile)) fs.renameSync(imageminCreatedFile, finalOutputPath);
        }
      }
    }
  }

  console.log("🎉 - Done!");
})();

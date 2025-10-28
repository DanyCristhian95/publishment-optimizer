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
    // Elimina el directorio y su contenido de forma recursiva
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

// Llama a la función de limpieza antes de cualquier otra operación
cleanOutputFolder(outputDir);

// --- Setup and Folder Identification ---

// Get the first subfolder inside 'input' (e.g., BHM-22)
const subfolders = fs
  .readdirSync(inputDir)
  .filter((f) => fs.lstatSync(path.join(inputDir, f)).isDirectory());

if (subfolders.length === 0) {
  console.error("❌ - No folder found inside 'input'.");
  process.exit(1);
}

const folderName = subfolders[0]; // The name of the folder to process (e.g., BHM-22)
const folderPath = path.join(inputDir, folderName); // Path to the folder
const outputSubDir = path.join(outputDir, newName); // The new output folder (e.g., output/HM_12)

// Create output folder structure if not exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(outputSubDir)) fs.mkdirSync(outputSubDir); // Create the renamed subfolder

console.log(`📁 - Processing folder: ${folderName}`);

// --- Optimization Functions ---

/**
 * Converts and optimizes images to WebP using imagemin.
 * @param {string} inputGlob The glob pattern for input files.
 * @param {string} outputDestination The destination folder for output.
 * @returns {Promise<number>} The number of files converted.
 */
async function optimizeImages(inputGlob, outputDestination) {
  try {
    const files = await imagemin(
      [inputGlob],
      {
        destination: outputDestination,
        plugins: [
          imageminWebp({
            quality: 75, // Medium quality for weight reduction
          }),
        ],
      }
    );
    return files.length;
  } catch (error) {
    // console.error('❌ - Error optimizing images:', error.message); // Uncomment for detailed debugging
    return 0;
  }
}

/**
 * Compresses a PDF using Ghostscript (requires Ghostscript to be installed).
 * @param {string} inputPath Path to the input PDF.
 * @param {string} outputPath Path for the compressed output PDF.
 * @param {string} quality Ghostscript quality setting (e.g., '/ebook').
 * @returns {Promise<void>}
 */
function compressPDF(inputPath, outputPath, quality = '/ebook') {
  return new Promise((resolve, reject) => {
    // NOTE: This command requires Ghostscript to be installed on the system.
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

  // 1️⃣ Process inner images (e.g., 001.webp, 002.webp, ...) and rename them
  const innerFiles = fs.readdirSync(folderPath).filter((f) => f.match(/\.(webp|jpg|jpeg|png)$/i));

  for (const file of innerFiles) {
    const number = file.match(/\d+/)?.[0]; // extract number
    if (!number) {
      console.warn(`- ⚠️ Skipping ${file} (no number found)`);
      continue;
    }

    const finalNewFileName = `${newName}-${number}.webp`;
    const tempInputPath = path.join(folderPath, file); // Source image
    const finalOutputPath = path.join(outputSubDir, finalNewFileName); // Final destination path

    const optimized = await optimizeImages(tempInputPath, path.dirname(finalOutputPath));

    if (optimized > 0) {
      // imagemin creates a file with the original basename (e.g., '001.webp')
      const originalBasename = path.basename(file, path.extname(file));
      const imageminCreatedFile = path.join(outputSubDir, `${originalBasename}.webp`);

      // Rename the created file to the final desired name (e.g., 'HM_12-001.webp')
      if (fs.existsSync(imageminCreatedFile)) {
        fs.renameSync(imageminCreatedFile, finalOutputPath);
        console.log(`✅ - Optimized and renamed ${file} → ${finalNewFileName}`);
      } else {
        console.error(`❌ - Optimization succeeded, but output file ${imageminCreatedFile} not found for ${file}.`);
      }
    } else {
      console.warn(`⚠️ - Could not optimize ${file}. Skipping.`);
    }
  }

  // 2️⃣ Process main image and pdf outside subfolder
  // CORRECCIÓN CLAVE: Aseguramos que solo se procesen ARCHIVOS y no el directorio principal (evita EISDIR).
  const mainFiles = fs.readdirSync(inputDir)
    .filter((f) => f.startsWith(folderName))
    .filter((f) => !fs.lstatSync(path.join(inputDir, f)).isDirectory());

  for (const file of mainFiles) {
    const ext = path.extname(file);
    const inputPath = path.join(inputDir, file);

    if (ext.toLowerCase() === '.pdf') {
      // Compress PDF
      const newFileName = `${newName}${ext}`;
      const outputPath = path.join(outputDir, newFileName);
      await compressPDF(inputPath, outputPath, '/ebook');
    } else if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
      // Optimize main image and convert to WebP
      const finalNewFileName = `${newName}.webp`;
      const finalOutputPath = path.join(outputDir, finalNewFileName);

      const optimized = await optimizeImages(inputPath, path.dirname(finalOutputPath));

      if (optimized > 0) {
        // Find the file created by imagemin (e.g., BHM-22.webp)
        const originalBasename = path.basename(file, path.extname(file));
        const imageminCreatedFile = path.join(outputDir, `${originalBasename}.webp`);

        // Rename the created file to the final desired name (e.g., HM_12.webp)
        if (fs.existsSync(imageminCreatedFile)) {
          fs.renameSync(imageminCreatedFile, finalOutputPath);
          console.log(`✅ - Optimized and renamed main image ${file} → ${finalNewFileName}`);
        } else {
          console.error(`❌ - Optimization succeeded, but output file ${imageminCreatedFile} not found for main image ${file}.`);
        }
      } else {
        console.warn(`- ⚠️ Could not optimize main image ${file}. Skipping.`);
      }
    } else {
      // Copy other files (like TXT, JSON, etc.)
      const outputPath = path.join(outputDir, `${newName}${ext}`);
      fs.copyFileSync(inputPath, outputPath);
      console.log(`✅ - Copied non-image file ${file} → ${path.basename(outputPath)}`);
    }
  }

  console.log("🎉 - Done!")
})()
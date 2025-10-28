# Convert to WebP & PDF Compressor

Este proyecto se utiliza para optimizar imágenes y comprimir PDFs, renombrando los archivos según un nombre proporcionado, automatizando el flujo de procesamiento de carpetas y archivos.

## 🛠️ Tecnologías utilizadas

- Node.js ≥ 18
- pnpm para gestión de dependencias
- imagemin para optimización de imágenes
- imagemin-webp para conversión a WebP
- Ghostscript para compresión de PDFs

## 📦 Instalación

1. Clona este repositorio: `git clone <repo-url>` y entra al directorio: `cd <repo-folder>`
2. Instala las dependencias: `pnpm install`

## 🚀 Comandos disponibles

- `pnpm convert <nombre>`: Optimiza imágenes y comprime PDFs, renombrando todo según `<nombre>`

## 🧹 Estructura del proyecto

```
project-root/
├── input/             # Carpeta con archivos y subcarpetas a procesar
│ └── SUBFOLDER/       # Subcarpeta con imágenes numeradas (001.jpg, 002.png, ...)
│ └── FILE.pdf         # PDF principal (opcional)
│ └── FILE.webp        # Imagen principal (opcional)
├── output/            # Carpeta generada automáticamente con archivos optimizados
├── index.js           # Script principal de procesamiento
├── package.json       # Dependencias y scripts del proyecto
└── README.md          # Documentación del proyecto
```

## ✅ Buenas prácticas

- Mantener Ghostscript instalado y accesible en PATH para compresión de PDFs.
- Solo se procesa la primera subcarpeta dentro de input/.
- Los archivos que no sean imágenes o PDFs se copian tal cual al directorio de salida.
- Ejecutar `pnpm convert <nombre>` proporcionando siempre un nombre para evitar errores.

## 📄 Licencia

Este proyecto es privado y no cuenta con una licencia pública.

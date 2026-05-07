# Player Platform (`/_audios`)

Plataforma de reproducción de audiolibros y videos construida como sitio estático.

- URL pública: `/_audios/player/`
- Código fuente frontend: `/_spotify_astro/`
- Build generado: `player/`
- Entrada web principal: `index.php` (redirige a `/_audios/player/`)

## 1. Qué hace el sistema

Este proyecto indexa carpetas locales con archivos multimedia (`.mp3`, `.mp4`) y genera una interfaz web tipo biblioteca/reproductor:

- Catálogo de álbumes (carpetas)
- Listado de pistas por álbum
- Reproductor audio/video
- Búsqueda y cola de reproducción
- Persistencia de estado del player en `localStorage`

## 2. Arquitectura

### 2.1 Vista general

- **Frontend**: Astro + React + Tailwind + Zustand
- **Backend (ligero)**:
  - PHP para redirección (`index.php`)
  - Endpoint estático generado por Astro: `api/get-info-playlist.json`
- **Fuente de verdad del contenido**: estructura de carpetas en disco dentro de `/_audios`

### 2.2 Flujo de datos

1. En build, `src/lib/data.ts` recorre el filesystem local.
2. Cada carpeta válida se convierte en un `Playlist`.
3. Cada archivo `.mp3/.mp4` se convierte en `Song`.
4. Astro genera `player/api/get-info-playlist.json`.
5. En runtime, el frontend consulta ese JSON y renderiza catálogo/reproductor.

## 3. Backend

## 3.1 Redirección web

Archivo: `index.php`

- Redirige tráfico de `/_audios/` a `/_audios/player/` con HTTP 302.

## 3.2 Endpoint de datos

Archivo: `_spotify_astro/src/pages/api/get-info-playlist.json.js`

- Entrega JSON con:
  - `playlists`
  - `songs`

No hay base de datos obligatoria para el runtime del player; la data se resuelve en build.

## 4. Frontend

## 4.1 Stack

- Astro `4.x`
- React `18.x`
- Zustand `4.x`
- Tailwind CSS `3.x`
- Svelte (usado puntualmente en componentes)

## 4.2 Componentes clave

- `src/components/Player.jsx`: reproducción audio/video, estado principal del player.
- `src/components/AlbumBrowser.tsx`: navegación y búsqueda de catálogo.
- `src/components/MusicsTable.tsx`: listado de pistas.
- `src/components/PlayerSoundControl.jsx`: barra de progreso/seek.
- `src/store/playerStore.ts`: estado global (cola, reproducción, volumen, etc.).

## 4.3 Persistencia del usuario

Se usa `localStorage` para conservar estado de sesión:

- `player-store-v1`
- `player:state`
- `player:activeAlbum`
- `player:activeSong`
- `player:volume`

## 5. Estructura de carpetas

```text
_audios/
├─ _spotify_astro/          # código fuente Astro/React
├─ player/                  # build estático publicado
├─ index.php                # redirección a /_audios/player/
└─ [carpetas de contenido]  # álbumes con mp3/mp4 y portada
```

## 6. Convención de contenido

Para mejores resultados de catálogo:

- Carpeta de álbum: preferiblemente `Autor - Título`
- Portadas sugeridas:
  - `cover.jpg`
  - `cover.jpeg`
  - `cover.png`
  - `folder.jpg`
- Extensiones detectadas:
  - Audio: `.mp3`
  - Video: `.mp4`

## 7. Desarrollo local

Desde `/_audios/_spotify_astro`:

```bash
npm install
npm run dev
```

Comandos útiles:

- `npm run dev`: servidor local de desarrollo
- `npm run build`: build de producción
- `npm run preview`: vista previa del build

## 8. Deploy

## 8.1 Deploy estándar

```bash
cd /var/www/vhosts/patchamama.com/httpdocs/_audios/_spotify_astro
bash build-prod.sh
```

Actualmente la compilación sale directamente a:

- `/var/www/vhosts/patchamama.com/httpdocs/_audios/player/`

No se requiere copia manual adicional.

## 8.2 Verificación post-deploy

1. Abrir `/_audios/player/`
2. Validar carga de portada y pistas
3. Reproducir audio y video
4. Confirmar endpoint:
   - `/_audios/player/api/get-info-playlist.json`

## 9. Configuración crítica

Archivo: `_spotify_astro/astro.config.mjs`

- `base: '/_audios/player'`
- `outDir: '../player'`
- `output: 'static'`

Esto asegura rutas correctas y publicación en carpeta final.

## 10. Troubleshooting rápido

- **No aparecen álbumes**:
  - Revisar permisos de lectura en carpetas dentro de `/_audios`.
  - Confirmar que contienen `.mp3` o `.mp4`.
- **Portadas por defecto**:
  - Verificar nombres de archivo de cover.
- **Cambios no visibles tras deploy**:
  - Hard refresh del navegador / limpiar caché.
- **Rutas rotas de assets**:
  - Confirmar `base` en `astro.config.mjs` y recompilar.

## 11. Estado del proyecto

- Build estático sin SSR.
- Sin suite formal de tests automáticos.
- Orientado a despliegue simple en hosting tradicional (PHP + archivos estáticos).

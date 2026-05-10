<?php
declare(strict_types=1);

ini_set('memory_limit', '256M');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=1800, must-revalidate');

$MEDIA_ROOT = __DIR__;
$MEDIA_BASE = '/_audios';
$DEFAULT_COVER = '/_audios/player/default-cover.svg';
$IGNORE = [
    '.git', '.agents', '_spotify_astro', 'node_modules', 'dist',
    'config', 'css', 'img', 'font', 'lib', 'backend.patchamama.com',
    'player', '_getid3', '_epubjs-reader-master',
];
$COVER_CANDIDATES = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'Folder.jpg', 'AlbumArtSmall.jpg'];
$AUDIO_EXTS = ['.mp3', '.mp4'];
$CATEGORIES = [
    ['id' => 'chess', 'label' => 'Ajedrez', 'icon' => '♟', 'terms' => ['chess', 'ajedrez']],
    ['id' => 'audible', 'label' => 'Audible', 'icon' => '🎧', 'terms' => ['audible']],
    ['id' => 'novelas', 'label' => 'Novelas', 'icon' => '📖', 'terms' => [
        'padura', 'vargas llosa', 'garcia marquez', 'garcía márquez', 'marquez',
        'cervantes', 'shakespeare', 'dickens', 'tolstoy', 'dostoevsky', 'hugo', 'flaubert',
        'balzac', 'hemingway', 'fitzgerald', 'orwell', 'kafka', 'joyce', 'proust', 'woolf',
        'faulkner', 'camus', 'eco', 'murakami', 'rowling', 'coelho', 'austen', 'twain',
        'steinbeck', 'saramago', 'cabrera infante', 'posteguillo', 'rivera de la cruz',
    ]],
    ['id' => 'ciclismo', 'label' => 'Ciclismo', 'icon' => '🚴', 'terms' => ['ciclismo']],
    ['id' => 'historia', 'label' => 'Historia', 'icon' => '🏛', 'terms' => ['historia', 'diana uribe']],
    ['id' => 'youtube', 'label' => 'Youtube', 'icon' => '▶', 'terms' => ['mp3-youtube']],
    ['id' => 'tts', 'label' => 'TTS', 'icon' => '🔊', 'terms' => ['tts']],
    ['id' => 'deutsch', 'label' => 'Deutsch', 'icon' => '🇩🇪', 'terms' => ['deutsch', 'german', 'aleman', 'alemán']],
    ['id' => 'english', 'label' => 'English', 'icon' => '🇬🇧', 'terms' => ['charlysway', 'englisch', 'english']],
];

$COLORS = [
    ['accent' => '#da2735', 'dark' => '#7f1d1d'],
    ['accent' => '#cc5400', 'dark' => '#7c2d12'],
    ['accent' => '#ffae00', 'dark' => '#78350f'],
    ['accent' => '#21c872', 'dark' => '#14532d'],
    ['accent' => '#2ee9d7', 'dark' => '#134e4a'],
    ['accent' => '#1e3a8a', 'dark' => '#1e3a8a'],
    ['accent' => '#394bd5', 'dark' => '#312e81'],
    ['accent' => '#df24ff', 'dark' => '#581c87'],
    ['accent' => '#f33b73', 'dark' => '#831843'],
    ['accent' => '#0c6e54', 'dark' => '#064e3b'],
    ['accent' => '#ed2377', 'dark' => '#871b48'],
    ['accent' => '#555555', 'dark' => '#27272a'],
];

// Playlists-only cache — ~300 KB vs the old 25 MB full-catalog cache.
// Songs are never cached to disk; they are built on demand per album or in a
// single pass for the full-catalog endpoint, avoiding the json_decode OOM that
// happened when reading a 25 MB file into a 128 MB PHP process.
$CACHE_PLAYLISTS = sys_get_temp_dir() . '/audios_playlists_v6.json';
$CACHE_TTL = 1800;

function extractYoutubeIdFromBaseName(string $baseName): ?string {
    if (preg_match('/-([A-Za-z0-9_-]{11})$/', $baseName, $m)) return $m[1];
    if (preg_match('/\[([A-Za-z0-9_-]{11})\]$/', $baseName, $m)) return $m[1];
    return null;
}

function stripYoutubeIdSuffix(string $baseName): string {
    $clean = preg_replace('/-([A-Za-z0-9_-]{11})$/', '', $baseName);
    $clean = preg_replace('/\s*\[([A-Za-z0-9_-]{11})\]$/', '', (string)$clean);
    $clean = trim((string)$clean);
    return $clean !== '' ? $clean : $baseName;
}

function countPlayableFiles(string $dir, array $exts): array {
    $entries = @scandir($dir);
    if (!$entries) return ['count' => 0, 'youtubeCount' => 0];
    $count = 0;
    $youtubeCount = 0;
    foreach ($entries as $e) {
        if ($e === '.' || $e === '..') continue;
        $ext = '.' . strtolower(pathinfo($e, PATHINFO_EXTENSION));
        if (!in_array($ext, $exts) || !is_file($dir . DIRECTORY_SEPARATOR . $e)) continue;
        $count++;
        $baseName = stripExt($e);
        if (extractYoutubeIdFromBaseName($baseName) !== null) $youtubeCount++;
    }
    return ['count' => $count, 'youtubeCount' => $youtubeCount];
}

function findCover(string $albumPath, string $albumName, string $mediaBase, string $defaultCover, array $candidates): string {
    foreach ($candidates as $c) {
        if (file_exists($albumPath . DIRECTORY_SEPARATOR . $c)) {
            return $mediaBase . '/' . rawurlencode($albumName) . '/' . rawurlencode($c);
        }
    }
    $entries = @scandir($albumPath);
    if ($entries) {
        foreach ($entries as $e) {
            if ($e === '.' || $e === '..') continue;
            if (preg_match('/\.(jpg|jpeg|png|webp)$/i', $e) && is_file($albumPath . DIRECTORY_SEPARATOR . $e)) {
                return $mediaBase . '/' . rawurlencode($albumName) . '/' . rawurlencode($e);
            }
        }
    }
    return $defaultCover;
}

function splitAuthorTitle(string $name): array {
    if (preg_match('/^\s*(.*?)\s*-\s*(.+)$/', $name, $m)) {
        $author = trim($m[1]) !== '' ? trim($m[1]) : 'Unknown';
        $title  = trim($m[2]) !== '' ? trim($m[2]) : trim($name);
        return ['author' => $author, 'title' => $title];
    }
    return ['author' => 'Unknown', 'title' => trim($name)];
}

function stripExt(string $fileName): string {
    return preg_replace('/\.(mp3|mp4|m4a|webm|ogg)$/i', '', $fileName);
}

function normalizeSearch(string $str): string {
    $str = mb_strtolower($str, 'UTF-8');
    $from = ['á','é','í','ó','ú','ü','ñ','à','è','ì','ò','ù','â','ê','î','ô','û','ä','ë','ï','ö','ã','õ','ç','ý'];
    $to   = ['a','e','i','o','u','u','n','a','e','i','o','u','a','e','i','o','u','a','e','i','o','a','o','c','y'];
    return str_replace($from, $to, $str);
}

// Build playlists-only array (no songs) from filesystem.
function buildPlaylists(): array {
    global $MEDIA_ROOT, $MEDIA_BASE, $DEFAULT_COVER, $IGNORE, $COVER_CANDIDATES, $AUDIO_EXTS, $COLORS;

    $rawEntries = @scandir($MEDIA_ROOT);
    if (!$rawEntries) return [];

    $albumDirs = [];
    $countMap  = [];
    foreach ($rawEntries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (str_starts_with($entry, '.')) continue;
        if (in_array($entry, $IGNORE)) continue;
        $fullPath = $MEDIA_ROOT . DIRECTORY_SEPARATOR . $entry;
        if (!is_dir($fullPath)) continue;
        $counts = countPlayableFiles($fullPath, $AUDIO_EXTS);
        $count = (int)($counts['count'] ?? 0);
        if ($count === 0) continue;
        $albumDirs[] = $entry;
        $countMap[$entry] = $counts;
    }

    if (class_exists('Collator')) {
        $col = collator_create('es');
        usort($albumDirs, fn($a, $b) => collator_compare($col, $a, $b));
    } else {
        usort($albumDirs, fn($a, $b) => strcmp($a, $b));
    }

    $playlists  = [];
    $colorCount = count($COLORS);

    foreach ($albumDirs as $idx => $album) {
        $albumPath = $MEDIA_ROOT . DIRECTORY_SEPARATOR . $album;
        $parsed    = splitAuthorTitle($album);
        $albumId   = $idx + 1;
        $cover     = findCover($albumPath, $album, $MEDIA_BASE, $DEFAULT_COVER, $COVER_CANDIDATES);
        $color     = $COLORS[$idx % $colorCount];

        $playlists[] = [
            'id'         => 'album-' . $albumId,
            'albumId'    => $albumId,
            'folderName' => $album,
            'title'      => $parsed['title'],
            'color'      => $color,
            'cover'      => $cover,
            'artists'    => [$parsed['author']],
            'songCount'  => (int)($countMap[$album]['count'] ?? 0),
            'youtubeCount' => (int)($countMap[$album]['youtubeCount'] ?? 0),
            'hasYoutube' => ((int)($countMap[$album]['youtubeCount'] ?? 0) > 0),
        ];
    }

    return $playlists;
}

// Load playlists from cache file, rebuild if stale or missing.
function getPlaylistsCached(): array {
    global $CACHE_PLAYLISTS, $CACHE_TTL;
    if (file_exists($CACHE_PLAYLISTS) && (time() - filemtime($CACHE_PLAYLISTS)) < $CACHE_TTL) {
        $data = @json_decode(file_get_contents($CACHE_PLAYLISTS), true);
        if (is_array($data) && count($data) > 0) return $data;
    }
    $playlists = buildPlaylists();
    @file_put_contents($CACHE_PLAYLISTS, json_encode($playlists, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $playlists;
}

// Build songs for a single album by scanning its folder directly.
function buildSongsForAlbum(string $folderName, int $albumId, string $title, string $author, string $cover): array {
    global $MEDIA_ROOT, $MEDIA_BASE, $AUDIO_EXTS;

    $albumPath = $MEDIA_ROOT . DIRECTORY_SEPARATOR . $folderName;
    $files = @scandir($albumPath);
    if (!$files) return [];

    $audioFiles = [];
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $ext = '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, $AUDIO_EXTS)) continue;
        if (!is_file($albumPath . DIRECTORY_SEPARATOR . $file)) continue;
        $audioFiles[] = $file;
    }

    if (class_exists('Collator')) {
        $col = collator_create('es');
        usort($audioFiles, fn($a, $b) => collator_compare($col, $a, $b));
    } else {
        sort($audioFiles);
    }

    $songs = [];
    foreach ($audioFiles as $i => $file) {
        $ext = '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $baseName = stripExt($file);
        $youtubeId = extractYoutubeIdFromBaseName($baseName);
        $cleanTitle = stripYoutubeIdSuffix($baseName);
        $songs[] = [
            'id'        => $i + 1,
            'albumId'   => $albumId,
            'title'     => $cleanTitle,
            'mediaType' => $ext === '.mp4' ? 'video' : 'audio',
            'youtubeId' => $youtubeId,
            'image'     => $cover,
            'artists'   => [$author],
            'album'     => $title,
            'duration'  => '--:--',
            'url'       => $MEDIA_BASE . '/' . rawurlencode($folderName) . '/' . rawurlencode($file),
        ];
    }
    return $songs;
}

// --- Route dispatch ---

$page    = isset($_GET['page'])    ? max(1, (int)$_GET['page'])    : null;
$limit   = isset($_GET['limit'])   ? min(200, max(1, (int)$_GET['limit'])) : 48;
// Accept both "21" and "album-21" formats
$albumId = null;
if (isset($_GET['albumId'])) {
    $raw = $_GET['albumId'];
    if (preg_match('/(\d+)/', (string)$raw, $m)) {
        $albumId = (int)$m[1];
    }
}

$playlists = getPlaylistsCached();

// GET ?categories=1 — returns server category filters
if (isset($_GET['categories'])) {
    echo json_encode(['categories' => $CATEGORIES], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// GET ?search=q — search playlists by album/author and songs by song title only
$search = isset($_GET['search']) ? trim($_GET['search']) : null;
if ($search !== null && strlen($search) > 0) {
    $normQuery = normalizeSearch($search);
    $tokens = array_values(array_filter(preg_split('/\s+/u', $normQuery)));

    $matchedPlaylists = [];
    foreach ($playlists as $p) {
        $haystack = normalizeSearch(
            $p['folderName'] . ' ' . $p['title'] . ' ' . implode(' ', $p['artists'])
        );
        $match = true;
        foreach ($tokens as $t) {
            if (mb_strpos($haystack, $t) === false) { $match = false; break; }
        }
        if ($match) $matchedPlaylists[] = $p;
    }

    $matchedSongs = [];
    foreach ($playlists as $p) {
        $albumSongs = buildSongsForAlbum(
            $p['folderName'], (int)$p['albumId'],
            $p['title'], $p['artists'][0] ?? 'Unknown', $p['cover']
        );
        foreach ($albumSongs as $s) {
            $songHaystack = normalizeSearch($s['title']);
            $songMatch = true;
            foreach ($tokens as $t) {
                if (mb_strpos($songHaystack, $t) === false) { $songMatch = false; break; }
            }
            if ($songMatch) $matchedSongs[] = $s;
        }
    }

    echo json_encode([
        'playlists' => array_values($matchedPlaylists),
        'songs'     => $matchedSongs,
        'query'     => $search,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// GET ?albumId=X — single album + its songs
if ($albumId !== null) {
    $playlist = null;
    foreach ($playlists as $p) {
        if ((int)$p['albumId'] === $albumId) { $playlist = $p; break; }
    }
    if (!$playlist) {
        http_response_code(404);
        echo json_encode(['error' => 'Album not found'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $songs = buildSongsForAlbum(
        $playlist['folderName'],
        $albumId,
        $playlist['title'],
        $playlist['artists'][0] ?? 'Unknown',
        $playlist['cover']
    );
    echo json_encode(['playlist' => $playlist, 'songs' => $songs], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// GET ?page=N&limit=X — paginated playlists only (no songs)
if ($page !== null) {
    $total      = count($playlists);
    $totalPages = (int)ceil($total / $limit);
    $offset     = ($page - 1) * $limit;
    $slice      = array_values(array_slice($playlists, $offset, $limit));
    echo json_encode([
        'playlists'  => $slice,
        'total'      => $total,
        'page'       => $page,
        'limit'      => $limit,
        'totalPages' => $totalPages,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// No params — full catalog used by content search (fetchAllData).
// Songs built in one pass without loading from disk, avoiding the json_decode
// OOM that hit when reading the old 25 MB catalog cache file.
$allSongs = [];
foreach ($playlists as $p) {
    $albumSongs = buildSongsForAlbum(
        $p['folderName'],
        (int)$p['albumId'],
        $p['title'],
        $p['artists'][0] ?? 'Unknown',
        $p['cover']
    );
    foreach ($albumSongs as $s) {
        $allSongs[] = $s;
    }
}
echo json_encode(
    ['playlists' => $playlists, 'songs' => $allSongs],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);

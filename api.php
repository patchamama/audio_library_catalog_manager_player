<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, must-revalidate');

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

function hasPlayableFiles(string $dir, array $exts): bool {
    $entries = @scandir($dir);
    if (!$entries) return false;
    foreach ($entries as $e) {
        if ($e === '.' || $e === '..') continue;
        $ext = '.' . strtolower(pathinfo($e, PATHINFO_EXTENSION));
        if (in_array($ext, $exts) && is_file($dir . DIRECTORY_SEPARATOR . $e)) return true;
    }
    return false;
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

$rawEntries = @scandir($MEDIA_ROOT);
if (!$rawEntries) {
    echo json_encode(['playlists' => [], 'songs' => []], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$albumDirs = [];
foreach ($rawEntries as $entry) {
    if ($entry === '.' || $entry === '..') continue;
    if (str_starts_with($entry, '.')) continue;
    if (in_array($entry, $IGNORE)) continue;
    $fullPath = $MEDIA_ROOT . DIRECTORY_SEPARATOR . $entry;
    if (!is_dir($fullPath)) continue;
    if (!hasPlayableFiles($fullPath, $AUDIO_EXTS)) continue;
    $albumDirs[] = $entry;
}

// Sort matching TypeScript's localeCompare('es') — use Collator when available
if (class_exists('Collator')) {
    $col = collator_create('es');
    usort($albumDirs, fn($a, $b) => collator_compare($col, $a, $b));
} else {
    usort($albumDirs, fn($a, $b) => strcmp($a, $b));
}

$playlists = [];
$songs     = [];
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
    ];

    $files = @scandir($albumPath);
    if (!$files) continue;
    $audioFiles = [];
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        $ext = '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (!in_array($ext, $AUDIO_EXTS)) continue;
        if (!is_file($albumPath . DIRECTORY_SEPARATOR . $file)) continue;
        $audioFiles[] = $file;
    }

    if (class_exists('Collator')) {
        $col2 = collator_create('es');
        usort($audioFiles, fn($a, $b) => collator_compare($col2, $a, $b));
    } else {
        sort($audioFiles);
    }

    foreach ($audioFiles as $i => $file) {
        $ext = '.' . strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $songs[] = [
            'id'        => $i + 1,
            'albumId'   => $albumId,
            'title'     => stripExt($file),
            'mediaType' => $ext === '.mp4' ? 'video' : 'audio',
            'image'     => $cover,
            'artists'   => [$parsed['author']],
            'album'     => $parsed['title'],
            'duration'  => '--:--',
            'url'       => $MEDIA_BASE . '/' . rawurlencode($album) . '/' . rawurlencode($file),
        ];
    }
}

echo json_encode(
    ['playlists' => $playlists, 'songs' => $songs],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
);

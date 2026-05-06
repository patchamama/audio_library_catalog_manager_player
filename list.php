<?php
echo "Hola";

header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json');

// Obtener todos los archivos MP3 y la portada en el directorio actual
$files = glob("*.mp3");
$cover = file_exists("cover.jpg") ? "cover.jpg" : null;

// Construir respuesta JSON
$response = [
    "files" => $files,
    "cover" => $cover
];

echo json_encode($response, JSON_PRETTY_PRINT);

?>
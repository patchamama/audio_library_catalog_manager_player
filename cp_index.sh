#!/bin/bash

# Recorre todos los subdirectorios desde el directorio actual
find . -type f -name 'index.html' | while read filepath; do
    # Obtener el directorio que contiene el archivo
    dir=$(dirname "$filepath")
    
    # Definir el nuevo nombre del archivo
    newfile="$dir/index01.html"
    
    # Crear la copia del archivo
    cp "$filepath" "$newfile"
    
    echo "Copiado $filepath a $newfile"
done
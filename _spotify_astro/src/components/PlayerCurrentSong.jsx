export const PlayerCurrentSong = ({image, title, artists, playlistPath}) => {
  return (
    <div className="flex items-center gap-5 relative overflow-hidden">
      { image &&
      (playlistPath ? (
        <a href={playlistPath} title="Ir al álbum" className="shrink-0 w-16 h-16 rounded-md overflow-hidden shadow-lg hover:opacity-80 transition-opacity">
          <img src={image} alt={title} className="w-full h-full object-cover"/>
        </a>
      ) : (
        <picture className="shrink-0 w-16 h-16 bg-zinc-800 rounded-md shadow-lg overflow-hidden">
          <img src={image} alt={title}/>
        </picture>
      ))
      }
      <div className="flex flex-col min-w-0">
        <h3 className="font-semibold text-sm block truncate">
          {title}
        </h3>
        <span className="text-xs opacity-80 truncate">
            {artists?.join(', ')}
          </span>
      </div>

    </div>
  )
}

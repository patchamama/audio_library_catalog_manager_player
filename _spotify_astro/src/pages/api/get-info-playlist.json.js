import { allPlaylists, songs as allSongs } from "@/lib/data";

export async function GET({ params, request }) {
  return new Response(JSON.stringify({ playlists: allPlaylists, songs: allSongs }), {
    headers: { "content-type": "application/json" },
  })
}

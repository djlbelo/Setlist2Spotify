from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.responses import JSONResponse

from scripts import *

app = FastAPI()

origins = [
    "http://localhost:8000",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/authentication")
async def authenticate():
    """Endpoint to authenticate with Spotify."""
    try:
        return authenticate_spotify()
    except Exception as e:
        # Log the error for debugging
        print(f"Authentication error: {str(e)}")
        # Return a proper error response
        return JSONResponse(
            status_code=500,
            content={"message": f"Authentication failed: {str(e)}"}
        )


class SetlistsRequestBody(BaseModel):
    artist_name: str

@app.post("/setlists")
async def get_setlists(body: SetlistsRequestBody):
    """Endpoint to get the latest setlists for an artist."""
    setlists = get_latest_setlists(body.artist_name)
    if not setlists:
        return {"message": "No setlists found for this artist."}
    return {"setlists": setlists}

class TracksRequestBody(BaseModel):
    artist_name: str
    songs: list

@app.post("/spotify/search/tracks")
async def search_tracks(body: TracksRequestBody):
    """Endpoint to search for tracks on Spotify."""
    sp = get_spotify_client()
    result = search_spotify_tracks(sp, body.songs, body.artist_name)
    if not result["track_ids"]:
        return {"message": "No tracks found on Spotify."}
    return {"track_ids": result["track_ids"], "not_found": result["not_found"]}

class PlaylistRequestBody(BaseModel):
    artist_name: str
    venue_name: str
    user_id: str

@app.post("/spotify/create/playlist")
async def create_playlist(body: PlaylistRequestBody):
    """Endpoint to create a Spotify playlist."""
    sp = get_spotify_client()
    playlist_id = create_spotify_playlist(sp, body.user_id, body.artist_name, body.venue_name)
    if not playlist_id:
        return {"message": "Failed to create playlist."}
    return {"playlist_id": playlist_id}

class GetPlaylistRequestBody(BaseModel):
    user_id: str
    playlist_name: str


@app.post("/spotify/get/playlist")
async def get_playlist_by_name(body: GetPlaylistRequestBody):
    """Endpoint to get a Spotify playlist ID by name."""
    try:
        sp = get_spotify_client()
        playlist_id = get_playlist_id(sp, body.user_id, body.playlist_name)

        if not playlist_id:
            return JSONResponse(
                status_code=404,
                content={"message": f"No playlist found with name '{body.playlist_name}'"}
            )

        return {"playlist_id": playlist_id}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error finding playlist: {str(e)}"}
        )

class AddTracksRequestBody(BaseModel):
    playlist_id: str
    track_ids: list

@app.post("/spotify/add/tracks")
async def add_tracks(body: AddTracksRequestBody):
    """Endpoint to add tracks to a Spotify playlist."""
    sp = get_spotify_client()
    add_tracks_to_playlist(sp, body.playlist_id, body.track_ids)
    return {"message": "Tracks added to playlist successfully."}
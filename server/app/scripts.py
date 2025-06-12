import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
import requests
import time
import difflib
from version import VERSION
from dotenv import load_dotenv

# ======= CONFIGURATION =======

# Load environment variables from .env file
load_dotenv()

# Spotify Credentials (Replace with your own)
# Spotify Credentials
SPOTIPY_CLIENT_ID = os.environ.get("SPOTIPY_CLIENT_ID")
SPOTIPY_CLIENT_SECRET = os.environ.get("SPOTIPY_CLIENT_SECRET")
SPOTIPY_REDIRECT_URI = os.environ.get("SPOTIPY_REDIRECT_URI")

# Setlist.fm API Key
SETLISTFM_API_KEY = os.environ.get("SETLISTFM_API_KEY")

# Spotify Scope for playlist modification
SCOPE = "playlist-modify-public"

# ======= VERSIONING =======
def get_app_version():
    """Return the current application version."""
    return VERSION

# ======= FETCH SETLISTS =======
def get_artist_match(artist_name):
    """Find the best match for an artist name using fuzzy matching."""
    artist_url = f"https://api.setlist.fm/rest/1.0/search/artists?artistName={artist_name}&sort=relevance"
    headers = {"x-api-key": SETLISTFM_API_KEY, "Accept": "application/json"}
    best_match = artist_name  # Default to original input if no match found

    try:
        response = requests.get(artist_url, headers=headers)
        if response.status_code == 200:
            artist_data = response.json()
            if "artist" in artist_data and artist_data["artist"]:
                # Extract artist names from results
                artist_names = {artist["name"]: artist["name"] for artist in artist_data["artist"]}

                # Find the closest match using difflib
                if artist_name.lower() in map(str.lower, artist_names.keys()):
                    # Direct case-insensitive match
                    for key in artist_names.keys():
                        if key.lower() == artist_name.lower():
                            best_match = key
                            break
                else:
                    # Use fuzzy matching
                    close_matches = difflib.get_close_matches(
                        artist_name.lower(),
                        [name.lower() for name in artist_names.keys()],
                        n=1,
                        cutoff=0.6
                    )

                    if close_matches:
                        # Find the original case for the matched name
                        for key in artist_names.keys():
                            if key.lower() == close_matches[0]:
                                best_match = key
                                break
            else:
                print("No artists found. Using original input.")
        else:
            print(f"Error searching for artist: {response.status_code}, {response.text}")
    except Exception as e:
        print(f"Error during artist search: {str(e)}")

    return best_match

def get_latest_setlists(artist_name):
    """Fetch the latest setlists with songs for the given artist from Setlist.fm, including pages 1 and 2."""
    # First find the best artist match
    artist_name = get_artist_match(artist_name)

    all_setlists = []

    # Fetch both pages
    for page in [1, 2]:
        url = f"https://api.setlist.fm/rest/1.0/search/setlists?artistName={artist_name}&p={page}"
        headers = {"x-api-key": SETLISTFM_API_KEY, "Accept": "application/json"}

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(f"Error fetching page {page}: {response.status_code}, {response.text}")
            if response.status_code == 429 and page > 1 and all_setlists:
                break
            continue

        data = response.json()
        if "setlist" not in data or not data["setlist"]:
            print(f"No setlist found on page {page} for this artist.")
            continue

        all_setlists.extend(data["setlist"])

        # Delay between requests to avoid rate limiting
        if page < 2:
            time.sleep(1.5)

        if not all_setlists:
            print("No setlists found for this artist.")
            return []

        # Process all setlists and structure them in the requested format
        result = []

        for setlist in all_setlists:
            sets = setlist.get("sets", {})
            set_items = sets.get("set", [])
            songs = []

            for s in set_items:
                if "song" in s:
                    songs.extend([song["name"] for song in s["song"]])

            # Only include setlists that have songs
            if songs:
                # Extract venue information
                venue = setlist.get("venue", {})
                venue_name = venue.get("name", "Unknown Venue")

                # Extract event date
                event_date = setlist.get("eventDate", "Unknown Date")

                # Extract artist name for concert name
                artist_info = setlist.get("artist", {})
                concert_name = artist_info.get("name", "Regular Concert") if artist_info else "Regular Concert"

                # Extract city information for venue details
                city = venue.get("city", {})
                city_name = city.get("name", "Unknown City")
                state = city.get("state", "")
                country = city.get("country", {}).get("name", "Unknown Country")

                # Format venue information for reference
                location = f"{city_name}"
                if state:
                    location += f", {state}"
                if country:
                    location += f", {country}"

                result.append({
                    "concertName": concert_name,
                    "venue": venue_name,
                    "eventDate": event_date,
                    "location": location,
                    "songs": songs
                })

        return result

# ======= SPOTIFY AUTHENTICATION =======
def authenticate_spotify():
    """Authenticate with Spotify API."""
    sp = spotipy.Spotify(auth_manager=SpotifyOAuth(
        client_id=SPOTIPY_CLIENT_ID,
        client_secret=SPOTIPY_CLIENT_SECRET,
        redirect_uri=SPOTIPY_REDIRECT_URI,
        scope=SCOPE
    ))

    user_info = sp.current_user()
    return user_info

def get_spotify_client():
    """Get a Spotify client instance."""
    return spotipy.Spotify(auth_manager=SpotifyOAuth(
        client_id=SPOTIPY_CLIENT_ID,
        client_secret=SPOTIPY_CLIENT_SECRET,
        redirect_uri=SPOTIPY_REDIRECT_URI,
        scope=SCOPE
    ))

# ======= SEARCH SONGS ON SPOTIFY =======
def search_spotify_tracks(sp, songs, artist_name):
    """Search for songs on Spotify and return track IDs."""
    track_ids = []
    not_found = []

    for song in songs:
        query = f"track:{song} artist:{artist_name}"
        results = sp.search(q=query, type="track", limit=1)

        if results["tracks"]["items"]:
            track_ids.append(results["tracks"]["items"][0]["id"])
        else:
            not_found.append(song)

    return {"track_ids": track_ids, "not_found": not_found}

# ======= CREATE SPOTIFY PLAYLIST =======
def create_spotify_playlist(sp, user_id, artist_name, venue_name):
    """Create a Spotify playlist for the artist's setlist."""
    try:
        playlist_name = f"{get_artist_match(artist_name)} Setlist @ {venue_name}"
        description = "Generated by Setlist2Spotify© - An open-source tool that transforms live concert setlists into Spotify playlists. Created by @djlbelo on GitHub."

        playlist = sp.user_playlist_create(
            user=user_id,
            name=playlist_name,
            public=True,
            description=description
        )
        print(f"Created playlist: {playlist_name}")
        return playlist["id"]
    except Exception as e:
        print(f"Error creating playlist: {str(e)}")
        # Try a more basic version if the first attempt failed
        try:
            playlist = sp.user_playlist_create(
                user=user_id,
                name=playlist_name,
                public=True
            )
            return playlist["id"]
        except Exception as e:
            print(f"Failed to create playlist: {str(e)}")
            return None

# ======= GET PLAYLIST DETAILS =======
def get_playlist(sp, playlist_id):
    """Get details of the created playlist."""
    return sp.playlist(playlist_id)

def get_playlist_id(sp, user_id, playlist_name):
    """Get the ID of a playlist by name, accounting for capitalization, errors, or misspellings."""

    playlists = sp.user_playlists(user_id)
    playlist_names = {playlist["name"].lower(): playlist["id"] for playlist in playlists["items"]}

    # Try exact match first (case insensitive)
    if playlist_name.lower() in playlist_names:
        return playlist_names[playlist_name.lower()]

    # If no exact match, try to find closest match
    if playlist_names:
        close_matches = difflib.get_close_matches(
            playlist_name.lower(),
            playlist_names.keys(),
            n=1,
            cutoff=0.6
        )

        if close_matches:
            best_match = close_matches[0]
            return playlist_names[best_match]

    return None

# ======= ADD SONGS TO PLAYLIST =======
def add_tracks_to_playlist(sp, playlist_id, track_ids):
    """Add tracks to the created playlist."""
    sp.playlist_add_items(playlist_id, track_ids)

# ======= MAIN FUNCTION =======
def main():
    artist_name = get_artist_match(input("Enter the artist name: "))

    # Authenticate with Spotify
    sp = authenticate_spotify()
    user_id = sp.current_user()["id"]
    print(f"Authenticated as {user_id}")

    # Fetch latest setlists
    songs = get_latest_setlists(artist_name)[0].get("songs", []) if get_latest_setlists(artist_name) else []
    if not songs:
        print("No songs found in the setlist.")
        return

    print(f"Found {len(songs)} songs in the setlist: {', '.join(songs)}")

    # Search songs on Spotify
    track_ids = search_spotify_tracks(sp, songs, artist_name)
    if not track_ids:
        print("No songs found on Spotify.")
        return

    # Create a new Spotify playlist
    playlist_id = create_spotify_playlist(sp, user_id, artist_name)
    print(f"Playlist created successfully!")

    # Add songs to the playlist
    add_tracks_to_playlist(sp, playlist_id, track_ids)
    print(f"Added {len(track_ids)} songs to the playlist.")

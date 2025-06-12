# 🎵 Setlist2Spotify

**Setlist2Spotify** is a web app that lets you search for an artist's recent concerts (via Setlist.fm) and instantly convert their setlists into Spotify playlists.

> Turn live shows into real playlists ⚡

---

## 📸 Preview

![Setlist2Spotify Preview](https://raw.githubusercontent.com/djlbelo/Setlist2Spotify/refs/heads/master/screenshots/Setlist2Spotify_Demo.gif)

---

## 🚀 Features

- 🔍 **Search Artists's Setlists** – via Setlist.fm API
- 📅 **View Setlists** – for each concert  
- 💚 **Create Spotify Playlist** – from a full setlist  
- ➕ **Add to Existing Playlist** – type in your playlist name 

---

## 🧰 Tech Stack

| Tech             | Description                          |
|------------------|--------------------------------------|
| [React](https://reactjs.org/) | Frontend Framework          |
| [Chakra UI](https://chakra-ui.com/) | Accessible UI Components  |
| [Spotify Web API](https://developer.spotify.com/) | Playlist + track handling |
| [Setlist.fm API](https://api.setlist.fm/docs/) | Concert & setlist data   |           |

---

## 🛠️ Installation

### 1. Clone the Repo

```bash
git clone https://github.com/djlbelo/setlist2spotify.git
cd setlist2spotify
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Dev Server

```bash
npm start
```

The app will be running at [http://localhost:3000](http://localhost:3000)

---

## 🔌 Backend API (Expected Routes)

Make sure your backend (Node, Python, etc.) exposes the following routes:

| Endpoint                             | Purpose                          |
|--------------------------------------|----------------------------------|
| `POST /setlists`                     | Get concerts from Setlist.fm     |
| `POST /spotify/search/tracks`       | Match tracks from setlist        |
| `POST /authentication`              | Get authenticated Spotify user   |
| `POST /spotify/create/playlist`     | Create new playlist              |
| `POST /spotify/add/tracks`          | Add tracks to new playlist       |
| `POST /spotify/add/tracks-to-existing` | Add tracks to existing playlist by name |

---

## 🧪 Environment Variables (Frontend)

If needed, configure the backend URL in a `.env` file:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

And access via:

```js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
```

---

## 🤘 Credits

- [Setlist.fm API](https://api.setlist.fm/docs/)
- [Spotify Web API](https://developer.spotify.com/)

---

## 📄 License

MIT © [djlbelo](https://github.com/djlbelo)

import * as React from "react";
import {
    ChakraProvider,
    Container,
    Box,
    Flex,
    Text,
    Heading,
    Input,
    InputGroup,
    InputLeftElement,
    Button,
    VStack,
    useDisclosure,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    ModalCloseButton,
    useToast,
    Alert,
    AlertIcon,
    AlertDescription
} from "@chakra-ui/react";
import {extendTheme, Link} from "@chakra-ui/react";
import {
    MagnifyingGlassIcon,
    SpotifyLogoIcon,
    CalendarBlankIcon
} from "@phosphor-icons/react";

export const theme = extendTheme({
    config: {
        initialColorMode: "dark",
        useSystemColorMode: false,
    },
    styles: {
        global: {
            body: {
                bg: "gray.900",
                color: "white"
            }
        }
    }
});

// API base URL
const API_BASE_URL = "http://localhost:8000";

function App() {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [concerts, setConcerts] = React.useState([]);
    const [selectedConcert, setSelectedConcert] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [playlistLoading, setPlaylistLoading] = React.useState(false);
    const [existingPlaylistModalOpen, setExistingPlaylistModalOpen] = React.useState(false);
    const [playlistName, setPlaylistName] = React.useState("");
    const [notFoundSongs, setNotFoundSongs] = React.useState([]);
    const [showNotFoundModal, setShowNotFoundModal] = React.useState(false);
    const [error, setError] = React.useState(null);
    const toast = useToast();

    const {isOpen, onOpen, onClose} = useDisclosure();

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setError(null);
        setConcerts([]);

        try {
            const response = await fetch(`${API_BASE_URL}/setlists`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({artist_name: searchQuery})
            });

            const data = await response.json();

            if (response.ok) {
                if (data.setlists && Array.isArray(data.setlists)) {
                    // Format each concert for display
                    console.log("Fetched setlists:", data.setlists);
                    const formattedConcerts = data.setlists.map((setlist, index) => ({
                        id: index,
                        date: setlist.eventDate,
                        venue: `${setlist.venue} - ${setlist.location}`,
                        concertName: setlist.concertName,
                        setlist: setlist.songs
                    }));
                    setConcerts(formattedConcerts);
                } else {
                    setError("No setlists found for this artist");
                }
            } else {
                setError(data.message || "Failed to fetch setlists");
            }
        } catch (err) {
            setError(`Failed to fetch concerts: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const createPlaylist = async (setlist) => {
        if (!selectedConcert) return;

        setPlaylistLoading(true);
        setNotFoundSongs([]);

        try {
            // Step 1: Search for tracks
            const searchResponse = await fetch(`${API_BASE_URL}/spotify/search/tracks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    artist_name: searchQuery,
                    songs: setlist
                })
            });

            const trackData = await searchResponse.json();
            if (!searchResponse.ok) throw new Error(trackData.message || "Failed to find tracks");

            const trackIds = trackData.track_ids;
            const notFound = trackData.not_found || [];

            if (!trackIds || trackIds.length === 0) {
                throw new Error("No tracks found on Spotify");
            }

            // Step 2: Get user info from authentication endpoint
            const authResponse = await fetch(`${API_BASE_URL}/authentication`, {
                method: "POST"
            });

            if (!authResponse.ok) {
                const errorData = await authResponse.json();
                throw new Error(errorData.message || "Authentication failed");
            }

            const userData = await authResponse.json();
            const userId = userData.id;

            // Step 3: Create a playlist
            const playlistResponse = await fetch(`${API_BASE_URL}/spotify/create/playlist`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    artist_name: `${searchQuery}`,
                    venue_name: selectedConcert.venue,
                    user_id: userId
                })
            });

            const playlistData = await playlistResponse.json();
            if (!playlistResponse.ok) throw new Error(playlistData.message || "Failed to create playlist");

            const playlistId = playlistData.playlist_id;

            // Step 4: Add tracks to playlist
            const addTracksResponse = await fetch(`${API_BASE_URL}/spotify/add/tracks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    playlist_id: playlistId,
                    track_ids: trackIds
                })
            });

            if (!addTracksResponse.ok) {
                const errorData = await addTracksResponse.json();
                throw new Error(errorData.message || "Failed to add tracks to playlist");
            }

            let description = `Created playlist with ${trackIds.length} songs`;
            if (notFound.length > 0) {
                description += `\n\nCouldn't find: ${notFound.slice(0, 3).join(", ")}${
                    notFound.length > 3 ? ` and ${notFound.length - 3} more` : ""
                }`;
            }

            toast({
                title: "Playlist Created!",
                description: description,
                status: "success",
                duration: 7000,
                isClosable: true
            });

            onClose();
        } catch (err) {
            toast({
                title: "Failed to create playlist",
                description: err.message || "Please try again",
                status: "error",
                duration: 5000,
                isClosable: true
            });
            console.error(err);
        } finally {
            setPlaylistLoading(false);
        }
    };

    const handleAddToExisting = async () => {
        if (!selectedConcert || !playlistName.trim()) return;

        setPlaylistLoading(true);
        setExistingPlaylistModalOpen(false);

        try {
            // Step 1: Search for tracks
            const searchResponse = await fetch(`${API_BASE_URL}/spotify/search/tracks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    artist_name: searchQuery,
                    songs: selectedConcert.setlist
                })
            });

            const trackData = await searchResponse.json();
            if (!searchResponse.ok) throw new Error(trackData.message || "Failed to find tracks");

            const trackIds = trackData.track_ids;
            const notFound = trackData.not_found || [];

            if (!trackIds || trackIds.length === 0) {
                throw new Error("No tracks found on Spotify");
            }

            // Step 2: Get user info from authentication endpoint
            const authResponse = await fetch(`${API_BASE_URL}/authentication`, {
                method: "POST"
            });

            if (!authResponse.ok) {
                const errorData = await authResponse.json();
                throw new Error(errorData.message || "Authentication failed");
            }

            const userData = await authResponse.json();
            const userId = userData.id;

            // Debug information
            console.log("Calling playlist endpoint with:", {
                user_id: userId,
                playlist_name: playlistName.trim()
            });

            // Step 3: Get existing playlist ID
            const playlistResponse = await fetch(`${API_BASE_URL}/spotify/get/playlist`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: userId,
                    playlist_name: playlistName.trim()
                })
            });

            // Debug response status
            console.log("Playlist endpoint response status:", playlistResponse.status);
            const playlistData = await playlistResponse.json();
            console.log("Playlist endpoint response data:", playlistData);

            if (!playlistResponse.ok) throw new Error(playlistData.message || "Failed to find playlist");

            const playlistId = playlistData.playlist_id;

            // Step 4: Add tracks to existing playlist
            const addTracksResponse = await fetch(`${API_BASE_URL}/spotify/add/tracks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    playlist_id: playlistId,
                    track_ids: trackIds
                })
            });

            if (!addTracksResponse.ok) {
                const errorData = await addTracksResponse.json();
                throw new Error(errorData.message || "Failed to add tracks to playlist");
            }

            let description = `Created playlist with ${trackIds.length} songs`;
            if (notFound.length > 0) {
                description += `\n\nCouldn't find: ${notFound.slice(0, 3).join(", ")}${
                    notFound.length > 3 ? ` and ${notFound.length - 3} more` : ""
                }`;
            }

            toast({
                title: "Songs Added!",
                description: description,
                status: "success",
                duration: 7000,
                isClosable: true
            });
        } catch (err) {
            toast({
                title: "Failed to add songs",
                description: err.message || "Please try again",
                status: "error",
                duration: 5000,
                isClosable: true
            });
            console.error(err);

        } finally {
            setPlaylistLoading(false);
        }
    };
    return (
        <ChakraProvider theme={theme}>
            <Container maxW="container.md" pt={10}>
                {/* Header */}
                <Flex align="center" justify="center" flexDirection="column" gap={1} mb={6}>
                    <Flex align="center" justify="center" gap={2}>
                        <SpotifyLogoIcon size={32} color="#1DB954" weight="fill"/>
                        <Heading size="lg">Setlist2Spotify</Heading>
                    </Flex>
                    <Text fontSize="md" color="gray.400" mt={-1}>Turn concerts into your Spotify playlists</Text>
                </Flex>
                {/* Search */}
                <form onSubmit={handleSearch}>
                    <InputGroup mb={6}>
                        <InputLeftElement pointerEvents="none">
                            <MagnifyingGlassIcon/>
                        </InputLeftElement>
                        <Input
                            placeholder="Enter artist name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            isDisabled={loading}
                        />
                        <Button ml={2} type="submit" colorScheme="green" isLoading={loading}>
                            Search
                        </Button>
                    </InputGroup>
                </form>

                {/* Error Message */}
                {error && (
                    <Alert status="error" mb={4} rounded="md">
                        <AlertIcon/>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Empty State */}
                {!loading && !error && concerts.length === 0 && (
                    <Box textAlign="center" py={10}>
                        <Text color="gray.500">Search for an artist to see their recent setlists</Text>
                        <Text color="gray.600" fontSize="xs">The artists' query results are directly from Setlist.fm
                            API</Text>
                    </Box>
                )}

                {/* Concert Cards */}
                <VStack spacing={4} align="stretch">
                    {concerts.map((concert) => (
                        <Box key={concert.id} p={4} borderWidth="1px" rounded="md" bg="gray.800" color="white">
                            <Flex justify="space-between" align="start">
                                <Box>
                                    <Flex align="center" gap={2} mb={2}>
                                        <CalendarBlankIcon/>
                                        <Text fontWeight="bold">{concert.date}</Text>
                                    </Flex>
                                    <Text fontSize="md" fontWeight="semibold">{concert.concertName}</Text>
                                    <Text fontSize="sm" color="gray.400">{concert.venue}</Text>
                                </Box>
                                <Button
                                    colorScheme="blue"
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedConcert(concert);
                                        onOpen();
                                    }}
                                >
                                    View Setlist
                                </Button>
                            </Flex>
                        </Box>
                    ))}
                </VStack>

                {/* Modal */}
                {selectedConcert && (
                    <>
                        <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
                            <ModalOverlay/>
                            <ModalContent bg="gray.800" color="white" borderColor="gray.700">
                                <ModalHeader>{selectedConcert.concertName}</ModalHeader>
                                <ModalCloseButton color="white"/>
                                <ModalBody>
                                    <Text mb={2} fontWeight="bold">
                                        {selectedConcert.date}
                                    </Text>
                                    <Text mb={4} color="gray.400">
                                        {selectedConcert.venue}
                                    </Text>
                                    {selectedConcert.setlist.length > 0 ? (
                                        selectedConcert.setlist.map((song, index) => (
                                            <Box key={index} py={2} borderBottom="1px solid" borderColor="gray.700">
                                                {index + 1}. {song}
                                            </Box>
                                        ))
                                    ) : (
                                        <Text color="gray.500">No songs available for this setlist</Text>
                                    )}
                                </ModalBody>
                                <ModalFooter borderTop="1px solid" borderColor="gray.700">
                                    <Button
                                        variant="outline"
                                        onClick={onClose}
                                        mr={3}
                                        color="white"
                                        borderColor="white"
                                        _hover={{bg: "whiteAlpha.200"}}
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        colorScheme="green"
                                        leftIcon={<SpotifyLogoIcon weight="fill"/>}
                                        onClick={() => createPlaylist(selectedConcert.setlist)}
                                        mr={3}
                                        isLoading={playlistLoading}
                                        isDisabled={selectedConcert.setlist.length === 0}
                                    >
                                        Create Playlist
                                    </Button>
                                    <Button
                                        colorScheme="green"
                                        leftIcon={<SpotifyLogoIcon weight="fill"/>}
                                        onClick={() => setExistingPlaylistModalOpen(true)}
                                        isLoading={playlistLoading}
                                        isDisabled={selectedConcert.setlist.length === 0}
                                    >
                                        Add to Playlist
                                    </Button>
                                </ModalFooter>
                            </ModalContent>
                        </Modal>
                        <Modal isOpen={existingPlaylistModalOpen} onClose={() => setExistingPlaylistModalOpen(false)}
                               isCentered>
                            <ModalOverlay/>
                            <ModalContent bg="gray.800" color="white">
                                <ModalHeader>Add to Existing Playlist</ModalHeader>
                                <ModalCloseButton/>
                                <ModalBody>
                                    <Text mb={2}>Enter the name of the Spotify playlist you want to add these songs
                                        to:</Text>
                                    <Input
                                        placeholder="Enter the name of your playlist"
                                        value={playlistName}
                                        onChange={(e) => setPlaylistName(e.target.value)}
                                        bg="gray.700"
                                        borderColor="gray.600"
                                        _placeholder={{color: "gray.400"}}
                                    />
                                </ModalBody>
                                <ModalFooter>
                                    <Button variant="ghost" mr={3} onClick={() => setExistingPlaylistModalOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        colorScheme="green"
                                        onClick={handleAddToExisting}
                                        isLoading={playlistLoading}
                                        isDisabled={!playlistName.trim()}
                                    >
                                        Add Songs
                                    </Button>
                                </ModalFooter>
                            </ModalContent>
                        </Modal>
                    </>
                )}
                {/* Footer */}
                <Box as="footer" mt={20} py={6} textAlign="center" borderTop="1px solid" borderColor="gray.700">
                    <Text fontSize="sm" color="gray.500">
                        Imagined and built by Duarte Belo
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                        © {new Date().getFullYear()} Setlist2Spotify. All rights reserved.
                    </Text>
                    <Flex mt={2} justify="center" gap={4}>
                        <Link href="https://github.com/djlbelo/setlist2spotify" isExternal color="green.300"
                              fontSize="sm">
                            GitHub
                        </Link>
                        <Link href="https://www.linkedin.com/in/duarte-belo-165ba2222/" isExternal color="green.300"
                              fontSize="sm">
                            LinkedIn
                        </Link>
                    </Flex>
                </Box>

            </Container>
        </ChakraProvider>
    );
}

export default App;
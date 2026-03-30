# Ambient Sounds

Pliki audio do funkcji dźwięków skupienia. Szumy (biały, różowy, brązowy) są generowane
przez Web Audio API i nie wymagają plików. Dźwięki natury wymagają pobrania poniżej.

## Wymagane pliki

| Plik | Dźwięk | Źródło (CC0) |
|------|--------|--------------|
| `rain.mp3` | Deszcz | https://freesound.org/people/felix.blume/sounds/217506/ |
| `forest.mp3` | Las / ptaki | https://freesound.org/people/Benboncan/sounds/91926/ |
| `cafe.mp3` | Kawiarnia | https://freesound.org/people/Kagateni/sounds/493322/ |

## Jak przygotować pliki

Po pobraniu WAV/MP3 ze strony, przekonwertuj do małego pliku pętlowego:

```bash
# Deszcz (~300 KB)
ffmpeg -i downloaded_rain.wav -ac 1 -b:a 64k -t 60 rain.mp3

# Las (~300 KB)
ffmpeg -i downloaded_forest.wav -ac 1 -b:a 64k -t 60 forest.mp3

# Kawiarnia (~300 KB)
ffmpeg -i downloaded_cafe.wav -ac 1 -b:a 64k -t 60 cafe.mp3
```

Parametry: `-ac 1` = mono, `-b:a 64k` = 64 kbps, `-t 60` = 60 sekund.

## Alternatywne źródła CC0

- https://freesound.org (filtr: Creative Commons 0)
- https://pixabay.com/sound-effects/ (bezpłatne do użytku komercyjnego)
- https://soundbible.com (sekcja Public Domain)

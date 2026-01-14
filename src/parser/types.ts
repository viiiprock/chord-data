import type { Chord } from "@tonaljs/chord";

export type ChordQuality =
    | "major"
    | "minor"
    | "diminished"
    | "augmented"
    | "dominant"
    | "suspended"
    | "major-seventh"
    | "minor-seventh"
    | "half-diminished"
    | "diminished-seventh"
    | "augmented-seventh"
    | "major-ninth"
    | "minor-ninth"
    | "dominant-ninth"
    | "suspended-second"
    | "suspended-fourth"
    | "suspended-2-4"
    | "power"
    | "sixth"
    | "six-nine"
    | "dominant-eleventh"
    | "dominant-thirteenth"
    | "major-eleventh"
    | "major-thirteenth"
    | "minor-sixth"
    | "minor-7-flat-5"
    | "minor-major-seventh"
    | "minor-major-ninth"
    | "minor-major-eleventh"
    | "add-ninth"
    | "minor-add-ninth"
    | "add-eleventh"
    | "altered";

export interface GuitarChord
    extends Omit<Chord, "empty" | "chroma" | "normalized" | "setNum" | "quality"> {
    // base properties from Tonal Chord
    // check https://tonaljs.github.io/tonal/docs/groups/chords
    id: string;
    symbol: string;
    name: string;
    tonic: string;
    aliases: string[];
    intervals: string[];
    notes: string[];
    quality: ChordQuality;
    // Guitar-specific properties
    fingerings: GuitarFingering[];
    difficulty: number; // 1-5
    commonProgressions: string[];
    tags: string[];
    genreTags: string[]; // ['rock', 'jazz', 'pop', ...]
}

export interface GuitarFingering {
    id: string;
    name: string;
    // Fret data
    frets: number[]; // [-1, 0, 2, 2, 1, 0]
    fingers: number[]; // [-1, 0, 2, 3, 1, 0]
    baseFret: number;
    mutedStrings: number[];
    barre?: BarreInfo;
    capo?: boolean;
    // Music data
    midi: number[]; // MIDI notes numbers [60, 64, 67]
    notes: string[]; // Note names ['C4', 'E4', 'G4']
    intervals: string[]; // ['1P', '3M', '5P']
    // Metadata
    difficulty: number;
}

export type BarreInfo = {
    fromString: number; // e.g. 6 for low E string
    toString: number; // e.g. 1 for high E string
    fret: number; // e.g. 1 for first fret
};

// Input types from chord-db
export interface RawPosition {
    frets: number[];
    fingers: number[];
    baseFret: number;
    barres?: number[];
    capo?: boolean;
    midi: number[];
}

export interface RawChord {
    key: string;
    suffix: string;
    positions: RawPosition[];
}

export interface ChordDatabase {
    chords: {
        [key: string]: RawChord[];
    };
}

import type { Chord as ChordType } from "@tonaljs/chord";
import { Chord } from "@tonaljs/tonal";
import { Interval, Note } from "tonal";

import type {
    BarreInfo,
    ChordDatabase,
    ChordQuality,
    GuitarChord,
    GuitarFingering,
    RawChord,
    RawPosition,
} from "./types.js";

const SUFFIX_MAP: Record<string, string> = {
    major: "",
    minor: "m",
    dim: "dim",
    dim7: "dim7",
    sus: "sus4",
    sus2: "sus2",
    sus4: "sus4",
    sus2sus4: "sus2sus4",
    "7sus4": "7sus4",
    alt: "alt",
    aug: "aug",
    "5": "5",
    "6": "6",
    "69": "69",
    "7": "7",
    "7b5": "7b5",
    aug7: "7#5",
    "9": "9",
    "9b5": "9b5",
    aug9: "9#5",
    "7b9": "7b9",
    "7#9": "7#9",
    "11": "11",
    "9#11": "9#11",
    "13": "13",
    maj7: "maj7",
    maj7b5: "maj7b5",
    "maj7#5": "maj7#5",
    maj7sus2: "maj7sus2",
    maj9: "maj9",
    maj11: "maj11",
    maj13: "maj13",
    m6: "m6",
    m69: "m69",
    m7: "m7",
    m7b5: "m7b5",
    m9: "m9",
    m11: "m11",
    mmaj7: "m(maj7)",
    mmaj7b5: "m7b5(maj7)",
    mmaj9: "m9(maj7)",
    mmaj11: "m11(maj7)",
    add9: "add9",
    madd9: "madd9",
    add11: "add11",
};

export class ChordParser {
    constructor(private database: ChordDatabase) {}

    parseAllChords(): Record<string, Record<string, GuitarChord>> {
        const chordsMap: Record<string, Record<string, GuitarChord>> = {};

        for (const [key, chordList] of Object.entries(this.database.chords)) {
            // Convert key format: Csharp -> C#, Fsharp -> F#
            const normalizedKey = this.normalizeKey(key);

            if (!chordsMap[normalizedKey]) {
                chordsMap[normalizedKey] = {};
            }

            for (const rawChord of chordList) {
                try {
                    const parsedChord = this.parseChord(normalizedKey, rawChord);
                    if (parsedChord) {
                        const suffixKey = rawChord.suffix || "major";
                        chordsMap[normalizedKey][suffixKey] = parsedChord;
                    }
                } catch (error) {
                    console.warn(`Failed to parse ${normalizedKey} ${rawChord.suffix}:`, error);
                }
            }
        }

        return chordsMap;
    }

    private normalizeKey(key: string): string {
        return key.replace(/sharp/gi, "#").replace(/flat/gi, "b");
    }

    parseChord(key: string, rawChord: RawChord): GuitarChord | null {
        const { suffix, positions } = rawChord;

        const symbol = this.buildChordSymbol(key, suffix);
        const chordInfo = Chord.get(symbol);

        // if (chordInfo.empty) {
        //     console.warn(`Tonal can't parse: ${symbol}`);
        //     return null;
        // }

        const chordId = this.generateChordId(key, suffix);
        const quality = this.determineQuality(suffix);
        const fingerings = positions.map((pos) =>
            this.parseFingering(pos, suffix, chordInfo.notes[0]),
        );
        const difficulty = this.calculateChordDifficulty(fingerings);
        const tags = this.generateTags(suffix, fingerings);
        const genreTags = this.generateGenreTags(suffix);
        const commonProgressions = this.findCommonProgressions(suffix);

        return {
            ...chordInfo,
            quality,
            id: chordId,
            fingerings,
            difficulty,
            commonProgressions,
            tags,
            genreTags,
            tonic: chordInfo.tonic || key,
        };
    }

    private buildChordSymbol(key: string, suffix: string): string {
        if (suffix.includes("/")) {
            const [baseSuffix, bass] = suffix.split("/");
            const tonalSuffix = SUFFIX_MAP[baseSuffix] || baseSuffix;
            const baseSymbol = tonalSuffix ? `${key}${tonalSuffix}` : key;
            return `${baseSymbol}/${bass}`;
        }

        const tonalSuffix = SUFFIX_MAP[suffix] || suffix;
        return tonalSuffix ? `${key}${tonalSuffix}` : key;
    }

    private determineQuality(suffix: string): ChordQuality {
        // Simple mapping based on suffix
        if (suffix.includes("maj7")) return "major-seventh";
        if (suffix.includes("m7")) return "minor-seventh";
        if (suffix.includes("dim7")) return "diminished-seventh";
        if (suffix.includes("aug7")) return "augmented-seventh";
        if (suffix.includes("m9")) return "minor-ninth";
        if (suffix.includes("maj9")) return "major-ninth";
        if (suffix.includes("9") && !suffix.includes("maj")) return "dominant-ninth";
        if (suffix.includes("dim")) return "diminished";
        if (suffix.includes("aug")) return "augmented";
        if (suffix.includes("sus")) return "suspended";
        if (suffix.includes("m")) return "minor";
        if (suffix === "5") return "power";
        if (suffix === "6") return "sixth";
        if (suffix === "69") return "six-nine";

        return "major";
    }

    private parseFingering(
        position: RawPosition,
        suffix: string,
        rootNote: string,
    ): GuitarFingering {
        const { baseFret, frets, fingers, midi, capo } = position;

        const mutedStrings = frets
            .map((fret, idx) => (fret === -1 ? idx : -1))
            .filter((idx) => idx !== -1)
            .map((idx) => 6 - idx);

        const barre = this.parseBarre(position);

        const notes = midi
            .map((midi) => {
                const note = Note.fromMidi(midi);
                return note ? note.replace(/[0-9]/g, "") : "";
            })
            .filter((n) => n);

        const name = this.generateFingeringName(position, barre);
        const intervals = this.calculateIntervals(notes, rootNote);
        const difficulty = this.calculateFingeringDifficulty(position, barre);

        return {
            id: `${rootNote}-${suffix}-${baseFret}`,
            name,
            frets,
            fingers,
            baseFret,
            mutedStrings,
            barre,
            intervals,
            difficulty,
            capo,
            midi,
            notes,
        };
    }

    private parseBarre(position: RawPosition): BarreInfo | undefined {
        const { barres, frets } = position;
        if (!barres || barres.length === 0) return undefined;

        const barreFret = barres[0];

        const barreStrings: number[] = [];
        frets.forEach((fret, idx) => {
            if (fret === barreFret) {
                barreStrings.push(6 - idx);
            }
        });

        if (barreStrings.length === 0) return undefined;

        return {
            fromString: Math.max(...barreStrings),
            toString: Math.min(...barreStrings),
            fret: barreFret,
        };
    }

    private calculateIntervals(notes: string[], rootNote: string): string[] {
        const rootPitch = Note.get(rootNote).pc;
        return notes.map((note) => Interval.distance(rootPitch, note) || "").filter((i) => i);
    }

    private calculateFingeringDifficulty(position: RawPosition, barre?: BarreInfo): number {
        let difficulty = 1.0;

        // Factor 1: Increase difficulty for barre chords
        if (barre) {
            difficulty += 1.5;
            if (barre.fret > 5) difficulty += 0.5;
        }

        // Factor 2: Base fret position
        if (position.baseFret > 7) difficulty += 1.0;
        else if (position.baseFret > 3) difficulty += 0.5;

        // Factor 3: Stretch between frets
        const activeFrets = position.frets.filter((f) => f > 0);
        if (activeFrets.length > 0) {
            const maxFret = Math.max(...activeFrets);
            const minFret = Math.min(...activeFrets);
            const stretch = maxFret - minFret;
            if (stretch > 4) difficulty += 1.0;
            else if (stretch > 2) difficulty += 0.5;
        }

        // Factor 4: Capo usage reduces difficulty
        if (position.capo) difficulty = Math.max(1, difficulty - 0.5);

        return Math.min(5, Math.max(1, Math.round(difficulty * 2) / 2));
    }

    private calculateChordDifficulty(fingerings: GuitarFingering[]): number {
        if (fingerings.length === 0) return 3;
        const avg = fingerings.reduce((sum, f) => sum + f.difficulty, 0) / fingerings.length;
        return Math.round(avg * 10) / 10;
    }

    private generateFingeringName(position: RawPosition, barre?: BarreInfo): string {
        const isOpenPosition = position.baseFret === 1 && position.frets.some((f) => f === 0);
        const hasOpenStrings = position.frets.includes(0);

        if (isOpenPosition) {
            return "Open Position";
        }

        if (barre) {
            if (hasOpenStrings) {
                return `Open - ${this.getOrdinal(barre.fret)} fret`;
            }
            return `Barre - ${this.getOrdinal(barre.fret)} fret`;
        }

        if (hasOpenStrings) {
            return `Open - ${this.getOrdinal(position.baseFret)} fret`;
        }

        return `${this.getOrdinal(position.baseFret)} fret`;
    }

    private getOrdinal(n: number): string {
        const suffixes = ["th", "st", "nd", "rd"];
        const value = n % 100;
        return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
    }

    private generateTags(suffix: string, fingerings: GuitarFingering[]): string[] {
        const tags: string[] = [];

        if (suffix.includes("maj")) tags.push("major-type");
        if (suffix.includes("m7")) tags.push("minor-7th");
        if (suffix.includes("9")) tags.push("extended");
        if (suffix.includes("sus")) tags.push("suspended");
        if (suffix.includes("dim")) tags.push("diminished");
        if (suffix.includes("aug")) tags.push("augmented");
        if (suffix.includes("add")) tags.push("added-tone");
        if (suffix === "5") tags.push("power-chord");

        if (fingerings.some((f) => f.barre)) tags.push("barre");
        if (fingerings.some((f) => f.frets.some((fret) => fret === 0))) tags.push("open-chord");
        if (fingerings.some((f) => f.capo)) tags.push("capo");

        const avgDiff = this.calculateChordDifficulty(fingerings);
        if (avgDiff <= 2) tags.push("beginner");
        if (avgDiff >= 4) tags.push("advanced");

        return [...new Set(tags)];
    }

    private generateGenreTags(suffix: string): string[] {
        const tags: string[] = [];

        if (suffix.includes("7") || suffix.includes("9")) {
            tags.push("blues", "jazz", "funk");
        }
        if (suffix.includes("sus")) {
            tags.push("pop", "rock", "folk");
        }
        if (suffix.includes("maj7") || suffix.includes("m9")) {
            tags.push("jazz", "bossa-nova", "r&b");
        }
        if (suffix === "5") {
            tags.push("rock", "metal", "punk");
        }
        if (suffix === "major" || suffix === "minor") {
            tags.push("all-genres", "essential");
        }

        return [...new Set(tags)];
    }

    private findCommonProgressions(suffix: string): string[] {
        const progressions: string[] = [];

        if (suffix === "major") {
            progressions.push("I-IV-V", "I-V-vi-IV", "ii-V-I");
        } else if (suffix === "minor") {
            progressions.push("i-iv-v", "i-VI-III-VII", "ii°-V-i");
        } else if (suffix.includes("7")) {
            progressions.push("I7-IV7-V7", "ii7-V7-I7");
        } else if (suffix.includes("m7")) {
            progressions.push("i7-iv7-v7", "ii7b5-V7-i7");
        }

        return progressions;
    }

    private generateChordId(key: string, suffix: string): string {
        return `${key.toLowerCase()}-${suffix.toLowerCase()}`
            .replace(/#/g, "sharp")
            .replace(/b/g, "flat")
            .replace(/\//g, "-over-");
    }
}

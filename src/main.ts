import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ChordParser } from "./parser/parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
    // Import the JSON data (assuming chord-db.json is in src/data/)
    const chordDb = await import("./source/chord-db.json", {
        assert: { type: "json" },
    }).then((module) => module.default);

    console.log("🎸 Starting guitar chord parser...\n");

    const startTime = performance.now();
    const parser = new ChordParser(chordDb);
    const chords = parser.parseAllChords();

    const output = {
        meta: {
            generatedAt: new Date().toISOString(),
            version: "1.0.0",
            totalChords: Object.keys(chords).length,
            keys: [...new Set(Object.keys(chords))],
            dataSource: "chord-db.json",
        },
        chords,
    };

    const distDir = join(__dirname, "../dist");
    mkdirSync(distDir, { recursive: true });

    // Write pretty JSON
    writeFileSync(join(distDir, "chords.json"), JSON.stringify(output, null, 2), "utf-8");

    // Write minified version
    writeFileSync(join(distDir, "chords.min.json"), JSON.stringify(output), "utf-8");

    const endTime = performance.now();
    const fileSize = Math.round(JSON.stringify(output).length / 1024);

    console.log(`✅ Successfully parsed ${chords.length} chords`);
    console.log(`📊 Unique keys: ${output.meta.keys.length}`);
    console.log(`📁 Output: dist/chords.json (${fileSize}KB)`);
    console.log(`⏱️  Time: ${Math.round(endTime - startTime)}ms\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

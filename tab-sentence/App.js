// App.js — Tab Sentence
// Syntax change in this version:
//   🎸 String disambiguation is now OCTAVE-FIRST: 3D5 (not D35)
//      The octave digit comes before the note letter when you need to
//      pick a specific string in tunings with duplicate note names.
//      e.g. Drop D ["4e","3B","3G","3D","2A","2D"]:
//        3D5  → fret 5 on the 3D string
//        2D5  → fret 5 on the 2D string
//        D5   → fret 5 on the first D string (no disambiguation needed)
//   🎸 Tuning strings now display as octave-first: 4e, 3B, 3G, 3D, 2A, 2E
//   🎸 Glossary updated with cleaner disambiguation instructions

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Share,
  SafeAreaView,
  Platform,
  useColorScheme,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MONO = Platform.select({
  android: "monospace",
  ios:     "Courier New",
  default: "monospace",
});

const STORAGE_INPUT    = "@tabsentence_input";
const STORAGE_TUNING   = "@tabsentence_tuning";
const STORAGE_SAVED    = "@tabsentence_saved";
const STORAGE_DARKMODE = "@tabsentence_darkmode";
const STORAGE_WRAP     = "@tabsentence_wrap";

const DEFAULT_WRAP = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Tuning string display helper
//
// Internally strings are stored as letter+octave: "e4", "B3", "D2"
// They are displayed as octave+letter: "4e", "3B", "2D"
// ─────────────────────────────────────────────────────────────────────────────

function displayString(s) {
  // s is e.g. "e4", "B3", "D2", "G3"
  // Return "4e", "3B", "2D", "3G"
  if (s.length >= 2 && /[0-9]/.test(s[s.length - 1])) {
    return s[s.length - 1] + s.slice(0, s.length - 1);
  }
  return s; // fallback for any unusual format
}

function displayTuning(strings) {
  return strings.map(displayString).join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOSSARY
// ─────────────────────────────────────────────────────────────────────────────

const GLOSSARY_ENTRIES = [
  ["~",  "Vibrato / bend & release — e.g. A2~"],
  ["h",  "Hammer-on — e.g. E1h2"],
  ["p",  "Pull-off — e.g. E2p1"],
  ["x",  "Muted / dead note — e.g. Ax"],
  ["^",  "Trill — rapid hammer/pull — e.g. E1^3"],
  ["/",  "Slide up — e.g. G2/5"],
  ["\\", "Slide down — e.g. G5\\2"],
  ["b",  "Bend — e.g. A7b"],
  ["()", "Chord — notes played together — e.g. (G2B3e2)"],
  ["-",  "Space / sustain — adds width between notes"],
  [
    "Octave prefix",
    "Only needed when your tuning has more than one string on the same note " +
    "(e.g. Drop D, Open G, DADGAD).\n\n" +
    "Put the octave number before the note letter to choose the exact string:\n\n" +
    "  Drop D  [4e · 3B · 3G · 3D · 2A · 2D]\n" +
    "    3D5  → fret 5 on the 3D string\n" +
    "    2D5  → fret 5 on the 2D string\n" +
    "    D5   → fret 5 on the highest D (no prefix needed)\n\n" +
    "  Open G  [4D · 3B · 3G · 3D · 2G · 2D]\n" +
    "    4D7  → fret 7 on the 4D string\n" +
    "    3D7  → fret 7 on the 3D string\n" +
    "    2G7  → fret 7 on the 2G string\n\n" +
    "Works inside chords too: (4D7 3B3 3G0)\n\n" +
    "For standard tunings where every note letter is unique, " +
    "you never need the octave prefix at all.",
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS  (stored internally as letter+octave: "e4", "B3", etc.)
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = {
  "Standard Guitar":  ["e4","B3","G3","D3","A2","E2"],
  "Drop D":           ["e4","B3","G3","D3","A2","D2"],
  "Open G":           ["D4","B3","G3","D3","G2","D2"],
  "DADGAD":           ["D4","A3","G3","D3","A2","D2"],
  Bass:               ["G2","D2","A1","E1"],
  "5-String Bass":    ["G2","D2","A1","E1","B0"],
  Ukulele:            ["A4","E4","C4","G4"],
  "Baritone Ukulele": ["E3","B2","G2","D2"],
};

// ─────────────────────────────────────────────────────────────────────────────
// resolveString
//
// Given a note letter (e.g. "D") and an optional octave (e.g. "3"),
// return the best matching internal string key from the tuning array.
//
// Internal keys are stored letter+octave ("D3"), so we construct that
// from the caller's (letter, octave) and look it up.
// ─────────────────────────────────────────────────────────────────────────────

function resolveString(letter, octave, strings) {
  if (octave) {
    // Internal storage is letter+octave, e.g. "D3"
    const key = letter + octave;
    const m1 = strings.find(t => t === key);
    if (m1) return m1;
    const m2 = strings.find(t => t.toLowerCase() === key.toLowerCase());
    if (m2) return m2;
  }
  // No octave — first letter match
  const m3 = strings.find(t => t[0] === letter);
  if (m3) return m3;
  const m4 = strings.find(t => t[0].toLowerCase() === letter.toLowerCase());
  return m4 || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// hasDuplicateLetter
// Returns true if the same note letter appears on more than one string.
// ─────────────────────────────────────────────────────────────────────────────

function hasDuplicateLetter(letter, strings) {
  return strings.filter(t => t[0].toLowerCase() === letter.toLowerCase()).length > 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseEvents(input, strings)
//
// OCTAVE-FIRST SYNTAX:
//   A leading digit before a note letter selects a specific string.
//   e.g.  3D5  → octave=3, letter=D, fret=5  → resolves to internal key "D3"
//         2D5  → octave=2, letter=D, fret=5  → resolves to internal key "D2"
//         D5   → no octave, letter=D, fret=5 → first D string
//
// The octave digit is consumed ONLY when ALL of these are true:
//   (a) the digit is immediately followed by a note letter (A-G/a-g)
//   (b) that letter has duplicates in the tuning
//   (c) digit+letter matches an actual tuning string (e.g. "3D" matches "D3")
//
// This keeps standard tuning completely unchanged — a bare digit at the start
// of a token that is NOT followed by a matching duplicate-letter note is left
// alone and the parser skips forward as normal.
// ─────────────────────────────────────────────────────────────────────────────

function parseEvents(input, strings) {
  const events = [];
  let i = 0;
  let currentStringKey = null;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) { i++; continue; }

    // ── Chord  e.g. (3D5 3B3 4e2) or (G2B3e2) ──────────────────────────────
    if (ch === "(") {
      let j = i + 1, buf = "";
      while (j < input.length && input[j] !== ")") { buf += input[j]; j++; }
      i = j + 1;

      // Each chord token: optional-octave + letter + fret-digits
      // Regex: optional digit prefix, then letter, then digits/x
      const rawNotes = buf.match(/[0-9]?[A-Ga-g][0-9x]*/g) || [];
      const notes = rawNotes.map(n => {
        let octave = "";
        let letter, fret;

        if (/^[0-9]/.test(n) && n.length >= 2 && /[A-Ga-g]/.test(n[1])) {
          // octave-first format: "3D5"
          octave = n[0];
          letter = n[1];
          fret   = n.slice(2);
        } else {
          // plain format: "D5" or legacy "e2"
          letter = n[0];
          fret   = n.slice(1);
        }

        // Only consume the octave if it actually disambiguates a duplicate
        if (octave && !hasDuplicateLetter(letter, strings)) {
          // Not a duplicate-letter tuning for this note — put octave back into fret
          fret   = octave + fret;
          octave = "";
        }

        const key = resolveString(letter, octave, strings);
        return { string: key || letter, fret };
      });

      events.push({ type: "chord", notes });
      continue;
    }

    // ── Dashes → space ───────────────────────────────────────────────────────
    if (ch === "-") {
      let j = i;
      while (j < input.length && input[j] === "-") j++;
      events.push({ type: "space", count: j - i });
      i = j;
      continue;
    }

    // ── Octave-first note: digit immediately followed by a note letter ────────
    // e.g. "3D5" — check if input[i] is a digit and input[i+1] is a letter
    if (
      /[0-9]/.test(ch) &&
      i + 1 < input.length &&
      /[A-Ga-g]/.test(input[i + 1])
    ) {
      const octaveCandidate = ch;
      const letterCandidate = input[i + 1];

      // Only treat as octave-prefix if:
      //   (a) this letter is duplicated in the tuning
      //   (b) octaveCandidate+letterCandidate resolves to a real string
      if (hasDuplicateLetter(letterCandidate, strings)) {
        const resolved = resolveString(letterCandidate, octaveCandidate, strings);
        if (resolved) {
          // Confirmed octave-first note
          const letter    = letterCandidate;
          const octave    = octaveCandidate;
          const stringKey = resolved;
          currentStringKey = stringKey;
          let j = i + 2; // skip past the octave digit and the letter

          // Dead / muted note  e.g. 3Dx
          if (j < input.length && input[j] === "x" && !/[0-9]/.test(input[j + 1] || "")) {
            events.push({ type: "note", string: stringKey, sequence: [{ fret: "x" }] });
            i = j + 1;
            continue;
          }

          // Read fret digits
          let num = "";
          while (j < input.length && /[0-9]/.test(input[j])) { num += input[j]; j++; }

          // Technique chain
          const sequence = [{ fret: num }];
          let k = j;
          while (k < input.length) {
            const op = input[k];
            if (!"hp/~b\\^x".includes(op)) break;
            if (op === "~" || op === "b") { sequence.push({ op, fret: "" }); k++; continue; }
            let m = k + 1, f = "";
            while (m < input.length && /[0-9x]/.test(input[m])) { f += input[m]; m++; }
            if (!f) break;
            sequence.push({ op, fret: f });
            k = m;
          }

          events.push({ type: "note", string: stringKey, sequence });
          i = k;
          continue;
        }
      }
      // Not a valid octave-prefix — fall through to skip this character
      i++;
      continue;
    }

    // ── Standard note starting with a letter ─────────────────────────────────
    if (/[A-Ga-g]/.test(ch)) {
      const letter = ch;
      let j = i + 1;

      const stringKey = resolveString(letter, "", strings) || letter;
      currentStringKey = stringKey;

      // Dead / muted note  e.g. Ax
      if (j < input.length && input[j] === "x" && !/[0-9]/.test(input[j + 1] || "")) {
        events.push({ type: "note", string: stringKey, sequence: [{ fret: "x" }] });
        i = j + 1;
        continue;
      }

      // Read fret digits
      let num = "";
      while (j < input.length && /[0-9]/.test(input[j])) { num += input[j]; j++; }

      // Technique chain
      const sequence = [{ fret: num }];
      let k = j;
      while (k < input.length) {
        const op = input[k];
        if (!"hp/~b\\^x".includes(op)) break;
        if (op === "~" || op === "b") { sequence.push({ op, fret: "" }); k++; continue; }
        let m = k + 1, f = "";
        while (m < input.length && /[0-9x]/.test(input[m])) { f += input[m]; m++; }
        if (!f) break;
        sequence.push({ op, fret: f });
        k = m;
      }

      events.push({ type: "note", string: stringKey, sequence });
      i = k;
      continue;
    }

    i++;
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// renderGrid
// ─────────────────────────────────────────────────────────────────────────────

function renderGrid(events, strings) {
  const grid = {};
  strings.forEach(s => (grid[s] = []));

  const pushColumn = () => strings.forEach(s => grid[s].push("-"));

  const write = (stringKey, val) => {
    let match = strings.find(t => t === stringKey);
    if (!match) match = strings.find(t => t.toLowerCase() === stringKey.toLowerCase());
    if (!match) match = strings.find(t => t[0] === stringKey[0]);
    if (!match) match = strings.find(t => t[0].toLowerCase() === stringKey[0].toLowerCase());
    if (match) grid[match][grid[match].length - 1] = val;
  };

  events.forEach(ev => {
    if (ev.type === "space") {
      for (let i = 0; i < ev.count; i++) pushColumn();
      return;
    }
    if (ev.type === "chord") {
      pushColumn();
      ev.notes.forEach(n => write(n.string, n.fret));
      return;
    }
    if (ev.type === "note") {
      ev.sequence.forEach(step => {
        pushColumn();
        write(ev.string, step.op ? step.op + step.fret : step.fret);
      });
    }
  });

  const maxLen = Math.max(...strings.map(s => grid[s].length), 0);
  strings.forEach(s => { while (grid[s].length < maxLen) grid[s].push("-"); });

  return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// normaliseColumns — pads every cell in a column to the width of the widest
// value in that column, so all strings stay in alignment.
// ─────────────────────────────────────────────────────────────────────────────

function normaliseColumns(grid, strings) {
  if (!strings.length) return grid;
  const numCols = grid[strings[0]].length;
  for (let col = 0; col < numCols; col++) {
    let maxW = 1;
    strings.forEach(s => { const v = grid[s][col]; if (v && v.length > maxW) maxW = v.length; });
    strings.forEach(s => {
      const v = grid[s][col] || "-";
      if (v.length < maxW) grid[s][col] = v + "-".repeat(maxW - v.length);
    });
  }
  return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTabLines
// Full pipeline: text → parseEvents → renderGrid → normaliseColumns → lines
// ─────────────────────────────────────────────────────────────────────────────

function buildTabLines(text, tuning, wrapAt) {
  if (typeof text !== "string") text = "";
  text = text.replace(/–|—|−/g, "-");

  const parts    = text.split("\n").filter(p => p.trim() !== "");
  const allLines = [];

  parts.forEach((part, partIdx) => {
    const events = parseEvents(part, tuning);
    const grid   = renderGrid(events, tuning);

    const maxLen = Math.max(...tuning.map(s => grid[s].length), 0);
    tuning.forEach(s => {
      while (grid[s].length < maxLen) grid[s].push("-");
      grid[s].push("-", "-", "-");
    });

    normaliseColumns(grid, tuning);

    // Row labels always use just the note letter (e.g. "e|", "D|") so every
    // row is exactly 2 characters wide and alignment is never broken.
    // The octave-first syntax (3D5) is only for input disambiguation —
    // it does not appear in the rendered tab output.
    const rows = tuning.map(s => ({
      label: s[0] + "|",
      cols:  grid[s],
    }));

    if (wrapAt && wrapAt > 0) {
      const totalCols = rows[0].cols.length;
      let colStart = 0;
      while (colStart < totalCols) {
        rows.forEach(row =>
          allLines.push(row.label + row.cols.slice(colStart, colStart + wrapAt).join(""))
        );
        colStart += wrapAt;
        if (colStart < totalCols) allLines.push("");
      }
    } else {
      rows.forEach(row => allLines.push(row.label + row.cols.join("")));
    }

    if (partIdx < parts.length - 1) allLines.push("");
  });

  return allLines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────

function makeTheme(dark) {
  return {
    dark,
    bg:          dark ? "#1a1a1a" : "#ffffff",
    bgSecond:    dark ? "#2a2a2a" : "#fafafa",
    bgInput:     dark ? "#2a2a2a" : "#ffffff",
    bgModal:     dark ? "#1a1a1a" : "#ffffff",
    border:      dark ? "#444444" : "#dddddd",
    borderInput: dark ? "#555555" : "#bbbbbb",
    text:        dark ? "#f0f0f0" : "#111111",
    textSecond:  dark ? "#aaaaaa" : "#555555",
    textHint:    dark ? "#666666" : "#aaaaaa",
    green:       "#0a6",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const systemScheme                    = useColorScheme();
  const [darkOverride, setDarkOverride] = useState(null);
  const isDark = darkOverride !== null ? darkOverride : systemScheme === "dark";
  const T      = useMemo(() => makeTheme(isDark), [isDark]);

  const [input, setInput]               = useState("(G2B3e2)G2/5----E1A2-D3A2~--E1h2p1-Ax");
  const [outputLines, setOutputLines]   = useState([]);
  const [tuning, setTuning]             = useState(PRESETS["Standard Guitar"]);
  const [wrapAt, setWrapAt]             = useState(DEFAULT_WRAP);

  const [showGlossary, setShowGlossary]     = useState(false);
  const [showTuning, setShowTuning]         = useState(false);
  const [showSaved, setShowSaved]           = useState(false);
  const [showSettings, setShowSettings]     = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const [tuningMode, setTuningMode]     = useState("presets");
  const [customTuning, setCustomTuning] = useState("");

  const [savedTabs, setSavedTabs] = useState([]);
  const [saveName, setSaveName]   = useState("");

  const [copyMsg, setCopyMsg] = useState("");

  // ── Restore persisted state ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [si, st, ss, sdm, sw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_INPUT),
          AsyncStorage.getItem(STORAGE_TUNING),
          AsyncStorage.getItem(STORAGE_SAVED),
          AsyncStorage.getItem(STORAGE_DARKMODE),
          AsyncStorage.getItem(STORAGE_WRAP),
        ]);
        if (si  !== null) setInput(si);
        if (st  !== null) setTuning(JSON.parse(st));
        if (ss  !== null) setSavedTabs(JSON.parse(ss));
        if (sdm !== null) setDarkOverride(JSON.parse(sdm));
        if (sw  !== null) setWrapAt(JSON.parse(sw));
      } catch (_e) { /* storage unavailable — use defaults */ }
    })();
  }, []);

  // ── Persist on change ─────────────────────────────────────────────────────
  useEffect(() => { AsyncStorage.setItem(STORAGE_INPUT,  input).catch(_e => {}); }, [input]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_TUNING, JSON.stringify(tuning)).catch(_e => {}); }, [tuning]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_SAVED,  JSON.stringify(savedTabs)).catch(_e => {}); }, [savedTabs]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_WRAP,   JSON.stringify(wrapAt)).catch(_e => {}); }, [wrapAt]);

  // ── Reparse ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setOutputLines(buildTabLines(input, tuning, wrapAt));
  }, [input, tuning, wrapAt]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getTabText = () => outputLines.join("\n");

  const flashMsg = (msg) => { setCopyMsg(msg); setTimeout(() => setCopyMsg(""), 2000); };

  const copyToClipboard = async () => {
    const text = getTabText();
    if (!text) return;
    try { await Clipboard.setStringAsync(text); flashMsg("✓ Copied!"); }
    catch (_e) { flashMsg("Copy failed"); }
  };

  const shareTab = async () => {
    const text = getTabText();
    if (!text) return;
    try { await Share.share({ message: text, title: "Guitar Tab" }); }
    catch (e) { if (e.message !== "The user did not share") Alert.alert("Share failed", e.message); }
  };

  const applyCustomTuning = () => {
    // Custom tuning can be entered as octave-first ("4e 3B") or letter-first ("e4 B3")
    // Normalise to internal letter+octave format
    const raw = customTuning.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    const strings = raw.map(s => {
      // If starts with digit then letter: octave-first — convert to letter+octave
      if (s.length >= 2 && /[0-9]/.test(s[0]) && /[A-Ga-g]/.test(s[1])) {
        return s[1] + s[0] + s.slice(2); // "4e" → "e4"
      }
      return s; // already letter+octave or letter-only
    });
    if (!strings.length) return;
    setTuning(strings);
    setShowTuning(false);
  };

  const setDarkMode = (val) => {
    setDarkOverride(val);
    AsyncStorage.setItem(STORAGE_DARKMODE, JSON.stringify(val)).catch(_e => {});
  };

  const toggleDark = () => setDarkMode(!isDark);

  // ── Saved tabs ─────────────────────────────────────────────────────────────
  const saveCurrentTab = () => {
    if (!saveName.trim()) return;
    setSavedTabs(prev => [
      { id: Date.now().toString(), name: saveName.trim(), input, tuning },
      ...prev,
    ]);
    setSaveName("");
    setShowSaveDialog(false);
    flashMsg("✓ Saved!");
  };

  const loadTab = (entry) => { setInput(entry.input); setTuning(entry.tuning); setShowSaved(false); };

  const deleteTab = (id) => {
    Alert.alert("Delete Tab", "Remove this saved tab?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive",
        onPress: () => setSavedTabs(prev => prev.filter(t => t.id !== id)) },
    ]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const s = useMemo(() => makeStyles(T), [T]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>🎸 Tab Sentence</Text>
          <View style={s.row}>
            <TouchableOpacity onPress={toggleDark} style={s.iconBtn}>
              <Text style={s.iconTxt}>{isDark ? "☀️" : "🌙"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettings(true)} style={s.iconBtn}>
              <Text style={s.iconTxt}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Example */}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: "#555" }]}
          onPress={() => setInput("(G2B3e2)G2/5----E1A2-D3A2~--E1h2p1-Ax")}>
          <Text style={s.btnTxt}>Try Example</Text>
        </TouchableOpacity>

        {/* Input */}
        <TextInput
          style={s.input}
          multiline
          value={input}
          onChangeText={setInput}
          placeholder="Type or paste a tab sentence…"
          placeholderTextColor={T.textHint}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />

        {/* Top action row */}
        <View style={s.row}>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: "#444" }]}
            onPress={() => setShowGlossary(true)}>
            <Text style={s.btnTxt}>Glossary</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.green }]}
            onPress={() => { setCustomTuning(displayTuning(tuning).replace(/ · /g, ", ")); setShowTuning(true); }}>
            <Text style={s.btnTxt}>Tuning</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: "#57a" }]}
            onPress={() => setShowSaved(true)}>
            <Text style={s.btnTxt}>Saved</Text>
          </TouchableOpacity>
        </View>

        {/* Tuning label — octave-first display */}
        <Text style={s.tuningLabel}>Tuning: {displayTuning(tuning)}</Text>

        {/* Tab output */}
        <ScrollView style={[s.outputBox, { backgroundColor: T.bgSecond, borderColor: T.border }]}>
          {outputLines.length === 0 ? (
            <Text style={s.hint}>Parsed output will appear here</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {outputLines.map((L, i) => (
                  <Text key={i} style={s.tabOutput}>{L}</Text>
                ))}
              </View>
            </ScrollView>
          )}
        </ScrollView>

        {/* Bottom action row */}
        <View style={[s.row, { marginTop: 10 }]}>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: "#2a7" }]}
            onPress={copyToClipboard}>
            <Text style={s.btnTxt}>{copyMsg || "📋 Copy"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: "#27a" }]}
            onPress={shareTab}>
            <Text style={s.btnTxt}>↑ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: "#a72" }]}
            onPress={() => setShowSaveDialog(true)}>
            <Text style={s.btnTxt}>💾 Save</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* GLOSSARY MODAL                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showGlossary} animationType="slide">
        <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
          <Text style={s.modalTitle}>Glossary</Text>
          <ScrollView>
            {GLOSSARY_ENTRIES.map(([k, v]) => (
              <View key={k} style={[s.glossaryRow, { borderColor: T.border }]}>
                <Text style={[s.glossaryKey, { color: T.green }]}>{k}</Text>
                <Text style={[s.glossaryVal, { color: T.text }]}>{v}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[s.btn, { backgroundColor: "#555", marginTop: 10 }]}
            onPress={() => setShowGlossary(false)}>
            <Text style={s.btnTxt}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TUNING MODAL                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showTuning} animationType="slide">
        <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
          <Text style={s.modalTitle}>Select Tuning</Text>

          <View style={[s.modeToggle, { borderColor: T.green }]}>
            {["presets", "custom"].map(mode => (
              <TouchableOpacity key={mode}
                style={[s.modeBtn, tuningMode === mode && { backgroundColor: T.green }]}
                onPress={() => setTuningMode(mode)}>
                <Text style={[s.modeBtnTxt, tuningMode === mode && { color: "#fff" }]}>
                  {mode === "presets" ? "Presets" : "Custom"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tuningMode === "presets" ? (
            <ScrollView>
              {Object.entries(PRESETS).map(([name, strings]) => (
                <TouchableOpacity key={name}
                  style={[s.presetRow, { borderColor: T.border }]}
                  onPress={() => { setTuning(strings); setShowTuning(false); }}>
                  <Text style={[s.presetName, { color: T.text }]}>{name}</Text>
                  {/* Strings displayed octave-first */}
                  <Text style={[s.presetStrings, { color: T.textSecond }]}>
                    {displayTuning(strings)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={[s.customHint, { color: T.textSecond }]}>
                Enter strings from highest to lowest, separated by spaces or commas.{"\n"}
                Use octave-first format: 4e, 3B, 3G, 3D, 2A, 2E
              </Text>
              <TextInput
                style={s.input}
                value={customTuning}
                onChangeText={setCustomTuning}
                placeholder="4e, 3B, 3G, 3D, 2A, 2E"
                placeholderTextColor={T.textHint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={[s.btn, { backgroundColor: T.green }]}
                onPress={applyCustomTuning}>
                <Text style={s.btnTxt}>Apply Custom Tuning</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={[s.btn, { backgroundColor: "#555" }]}
            onPress={() => setShowTuning(false)}>
            <Text style={s.btnTxt}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SAVED TABS MODAL                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showSaved} animationType="slide">
        <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
          <Text style={s.modalTitle}>Saved Tabs</Text>
          {savedTabs.length === 0 ? (
            <Text style={[s.hint, { marginTop: 20, color: T.textHint }]}>
              No saved tabs yet.{"\n"}Tap 💾 Save on the main screen to save a tab.
            </Text>
          ) : (
            <ScrollView style={{ flex: 1 }}>
              {savedTabs.map(tab => (
                <View key={tab.id}
                  style={[s.savedRow, { borderColor: T.border, backgroundColor: T.bgSecond }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.savedName, { color: T.text }]}>{tab.name}</Text>
                    <Text style={[s.savedPreview, { color: T.textSecond }]} numberOfLines={1}>
                      {displayTuning(tab.tuning)}  ·  {tab.input.slice(0, 40)}{tab.input.length > 40 ? "…" : ""}
                    </Text>
                  </View>
                  <View style={s.savedActions}>
                    <TouchableOpacity style={[s.savedBtn, { backgroundColor: T.green }]}
                      onPress={() => loadTab(tab)}>
                      <Text style={s.savedBtnTxt}>Load</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.savedBtn, { backgroundColor: "#a33" }]}
                      onPress={() => deleteTab(tab.id)}>
                      <Text style={s.savedBtnTxt}>Del</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
          <TouchableOpacity style={[s.btn, { backgroundColor: "#555", marginTop: 10 }]}
            onPress={() => setShowSaved(false)}>
            <Text style={s.btnTxt}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SAVE DIALOG                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showSaveDialog} transparent animationType="fade">
        <View style={s.dialogOverlay}>
          <View style={[s.dialogBox, { backgroundColor: T.bgModal, borderColor: T.border }]}>
            <Text style={[s.modalTitle, { fontSize: 17, marginBottom: 12 }]}>Name this tab</Text>
            <TextInput
              style={[s.input, { minHeight: 44, marginBottom: 12 }]}
              value={saveName}
              onChangeText={setSaveName}
              placeholder="e.g. Intro Riff"
              placeholderTextColor={T.textHint}
              autoFocus
            />
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: "#666" }]}
                onPress={() => { setShowSaveDialog(false); setSaveName(""); }}>
                <Text style={s.btnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.green }]}
                onPress={saveCurrentTab}>
                <Text style={s.btnTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SETTINGS MODAL                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showSettings} animationType="slide">
        <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
          <Text style={s.modalTitle}>Settings</Text>
          <ScrollView>

            {/* Dark mode */}
            <View style={[s.settingRow, { borderColor: T.border }]}>
              <Text style={[s.settingLabel, { color: T.text }]}>Dark Mode</Text>
              <Text style={[s.settingHint, { color: T.textSecond }]}>
                {darkOverride === null
                  ? "Following system (" + (systemScheme ?? "unknown") + ")"
                  : isDark ? "Forced on" : "Forced off"}
              </Text>
              <View style={[s.row, { marginTop: 8 }]}>
                {[
                  { label: "System", val: null  },
                  { label: "Light",  val: false  },
                  { label: "Dark",   val: true   },
                ].map(opt => (
                  <TouchableOpacity key={String(opt.val)}
                    style={[s.segBtn, { borderColor: T.border },
                      darkOverride === opt.val && { backgroundColor: T.green }]}
                    onPress={() => setDarkMode(opt.val)}>
                    <Text style={[s.segBtnTxt,
                      { color: darkOverride === opt.val ? "#fff" : T.text }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Line wrap */}
            <View style={[s.settingRow, { borderColor: T.border }]}>
              <Text style={[s.settingLabel, { color: T.text }]}>Line Wrap</Text>
              <Text style={[s.settingHint, { color: T.textSecond }]}>
                {wrapAt === 0 ? "Off — single long line" : `Wrap every ${wrapAt} columns`}
              </Text>
              <View style={[s.row, { marginTop: 8, flexWrap: "wrap" }]}>
                {[
                  { label: "Off", val: 0  },
                  { label: "40",  val: 40 },
                  { label: "60",  val: 60 },
                  { label: "80",  val: 80 },
                ].map(opt => (
                  <TouchableOpacity key={opt.val}
                    style={[s.segBtn, { borderColor: T.border },
                      wrapAt === opt.val && { backgroundColor: T.green }]}
                    onPress={() => setWrapAt(opt.val)}>
                    <Text style={[s.segBtnTxt,
                      { color: wrapAt === opt.val ? "#fff" : T.text }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </ScrollView>
          <TouchableOpacity style={[s.btn, { backgroundColor: "#555", marginTop: 10 }]}
            onPress={() => setShowSettings(false)}>
            <Text style={s.btnTxt}>Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(T) {
  return StyleSheet.create({
    safe:      { flex: 1 },
    container: { flex: 1, padding: 18, backgroundColor: T.bg },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    title:   { fontSize: 20, fontWeight: "700", color: T.text },
    iconBtn: { padding: 6 },
    iconTxt: { fontSize: 20 },
    input: {
      minHeight: 80,
      borderWidth: 1,
      borderColor: T.borderInput,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      fontFamily: MONO,
      fontSize: 13,
      color: T.text,
      backgroundColor: T.bgInput,
      textAlignVertical: "top",
    },
    btn:    { paddingVertical: 10, borderRadius: 8, alignItems: "center", marginBottom: 12 },
    btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
    flex:   { flex: 1 },
    row:    { flexDirection: "row", gap: 8 },
    tuningLabel: {
      fontSize: 12,
      color: T.textSecond,
      marginBottom: 6,
      fontFamily: MONO,
    },
    outputBox: {
      borderWidth: 1,
      padding: 12,
      borderRadius: 8,
      minHeight: 200,
      marginTop: 4,
    },
    tabOutput: {
      fontFamily: MONO,
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
      color: T.text,
    },
    hint: { fontFamily: MONO, color: T.textHint },
    modalSafe:  { flex: 1, padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16, color: T.text },
    glossaryRow: {
      marginBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      paddingBottom: 8,
    },
    glossaryKey:    { fontFamily: MONO, fontWeight: "700", fontSize: 15 },
    glossaryVal:    { fontSize: 14, marginTop: 2, lineHeight: 20 },
    modeToggle: {
      flexDirection: "row",
      borderWidth: 1,
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: 16,
    },
    modeBtn:       { flex: 1, paddingVertical: 8, alignItems: "center" },
    modeBtnTxt:    { fontWeight: "700", color: T.text },
    presetRow:     { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    presetName:    { fontWeight: "700", fontSize: 15 },
    presetStrings: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
    customHint:    { fontSize: 13, marginBottom: 10, lineHeight: 20 },
    savedRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
    },
    savedName:    { fontWeight: "700", fontSize: 15 },
    savedPreview: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
    savedActions: { flexDirection: "row", gap: 6 },
    savedBtn:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    savedBtnTxt:  { color: "#fff", fontWeight: "700", fontSize: 13 },
    dialogOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      padding: 24,
    },
    dialogBox:    { borderRadius: 12, padding: 20, borderWidth: 1 },
    settingRow:   { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    settingLabel: { fontWeight: "700", fontSize: 15 },
    settingHint:  { fontSize: 12, marginTop: 2 },
    segBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: 1,
      marginRight: 6,
      marginBottom: 4,
    },
    segBtnTxt: { fontWeight: "600", fontSize: 13 },
  });
}
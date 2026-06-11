// App.js — Tab Sentence v2
// Full rebuild: button-based input, bottom nav, improved preview, web-compatible

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Linking,
  SafeAreaView,
  Platform,
  useColorScheme,
  Dimensions,
  Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MONO = Platform.select({ android: "monospace", ios: "Courier New", default: "monospace" });
const BMAC_URL = "https://buymeacoffee.com/Bullfrog";

const STORAGE_INPUT    = "@tabsentence_input";
const STORAGE_TUNING   = "@tabsentence_tuning_key";
const STORAGE_SAVED    = "@tabsentence_saved";
const STORAGE_DARKMODE = "@tabsentence_darkmode";
const STORAGE_WRAP     = "@tabsentence_wrap";

// ─────────────────────────────────────────────────────────────────────────────
// Tuning Presets
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = {
  "Standard Guitar":   { strings: ["e4","B3","G3","D3","A2","E2"] },
  "Drop D":            { strings: ["e4","B3","G3","D3","A2","D2"] },
  "Open G":            { strings: ["D4","B3","G3","D3","G2","D2"] },
  "DADGAD":            { strings: ["D4","A3","G3","D3","A2","D2"] },
  "Bass":              { strings: ["G2","D2","A1","E1"] },
  "5-String Bass":     { strings: ["G2","D2","A1","E1","B0"] },
  "Ukulele":           { strings: ["A4","E4","C4","G4"] },
  "Baritone Ukulele":  { strings: ["E3","B2","G2","D2"] },
};

const PRESET_KEYS = Object.keys(PRESETS);

const STYLE_SYMBOLS = [
  { label: "-",   token: "-",   desc: "Blank beat / space" },
  { label: "/",   token: "/",   desc: "Slide Up" },
  { label: "\\",  token: "\\",  desc: "Slide Down" },
  { label: "h",   token: "h",   desc: "Hammer-on" },
  { label: "p",   token: "p",   desc: "Pull-off" },
  { label: "~",   token: "~",   desc: "Vibrato" },
  { label: "x",   token: "x",   desc: "Mute" },
  { label: "^",   token: "^",   desc: "Trill" },
  { label: "b",   token: "b",   desc: "Bend" },
  { label: "(",   token: "(",   desc: "Chord open" },
  { label: ")",   token: ")",   desc: "Chord close" },
];

const FRETS = ["0","1","2","3","4","5","6","7","8","9","10","11","12"];

const WRAP_OPTIONS = [
  { label: "No Limit", value: 0 },
  { label: "40 chars",  value: 40 },
  { label: "60 chars",  value: 60 },
  { label: "80 chars",  value: 80 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────────────────────────────────────

function makeTheme(dark) {
  if (dark) return {
    dark: true,
    bg:           "#1c1710",
    bgCard:       "#2e2619",
    bgInput:      "#2a2318",
    bgModal:      "#1c1710",
    border:       "#3d3426",
    borderAccent: "#c8922a",
    text:         "#f0e6d0",
    textSecond:   "#a8916e",
    textHint:     "#5c4e38",
    amber:        "#c8922a",
    amberDark:    "#9e7020",
    amberText:    "#1c1710",
    green:        "#2e6644",
    greenLight:   "#4a9e6a",
    greenText:    "#f0e6d0",
    red:          "#8b3a3a",
    tabBg:        "#140D07",
    tabBorder:    "#2E2217",
    tabText:      "#9acd9a",
    navBg:        "#231e14",
    navActive:    "#c8922a",
    navInactive:  "#5c4e38",
    btnPending:   "#4a3e31",
  };
  return {
    dark: false,
    bg:           "#faf6ee",
    bgCard:       "#f0e8d8",
    bgInput:      "#ffffff",
    bgModal:      "#faf6ee",
    border:       "#d4c4a8",
    borderAccent: "#b07d2a",
    text:         "#2a1f0e",
    textSecond:   "#7a5c38",
    textHint:     "#b09878",
    amber:        "#b07d2a",
    amberDark:    "#8a6020",
    amberText:    "#ffffff",
    green:        "#2d5c3a",
    greenLight:   "#3d8a55",
    greenText:    "#ffffff",
    red:          "#8b3a3a",
    tabBg:        "#f5edd8",
    tabBorder:    "#e9dec4",
    tabText:      "#2a4a2a",
    navBg:        "#f0e8d8",
    navActive:    "#b07d2a",
    navInactive:  "#b09878",
    btnPending:   "#e0d0b0",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// String label helpers (differentiated labels for duplicate note names)
// ─────────────────────────────────────────────────────────────────────────────

function parseStringEntry(s) {
  // s like "e4", "B3", "D2"
  const trimmed = s.trim();
  const octaveMatch = trimmed.match(/^([A-Ga-g]+)(\d+)$/);
  if (octaveMatch) {
    return { name: octaveMatch[1], octave: parseInt(octaveMatch[2]), full: trimmed };
  }
  return { name: trimmed, octave: 0, full: trimmed };
}

function getDifferentiatedLabels(strings) {
  // Returns map of full string key -> display label
  const parsed = strings.map(parseStringEntry);
  const groups = {};
  parsed.forEach(p => {
    const key = p.name.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });
  const labels = {};
  parsed.forEach(p => {
    const key = p.name.toLowerCase();
    const group = groups[key];
    if (group.length === 1) {
      labels[p.full] = p.name;
    } else if (group.length === 2) {
      // Sort by octave: highest pitch = lowercase, lowest = uppercase
      const sorted = [...group].sort((a, b) => b.octave - a.octave);
      labels[sorted[0].full] = sorted[0].name.toLowerCase();
      labels[sorted[1].full] = sorted[1].name.toUpperCase();
    } else {
      // Multiple — prefix octave
      group.forEach(g => {
        labels[g.full] = `${g.octave}${g.name.toLowerCase()}`;
      });
    }
  });
  return labels;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Parser (ported from App.js original, enhanced)
// ─────────────────────────────────────────────────────────────────────────────

function resolveString(label, strings, labelsMap) {
  // Try exact match on differentiated label first
  for (const s of strings) {
    if (labelsMap[s] === label) return s;
  }
  // Case-insensitive on differentiated label
  for (const s of strings) {
    if ((labelsMap[s] || "").toLowerCase() === label.toLowerCase()) return s;
  }
  // Fall back to first char match
  const letter = label[0];
  for (const s of strings) {
    if (s[0].toLowerCase() === letter.toLowerCase()) return s;
  }
  return null;
}

function parseEvents(input, strings, labelsMap) {
  const events = [];
  let i = 0;
  const n = input.length;

  // Build sorted label list (longest first to avoid prefix issues)
  const labelsSorted = strings
    .map(s => ({ string: s, label: labelsMap[s] || s[0] }))
    .sort((a, b) => b.label.length - a.label.length);

  function getMatchingString(pos) {
    for (const { string, label } of labelsSorted) {
      if (input.slice(pos, pos + label.length).toLowerCase() === label.toLowerCase()) {
        return { string, labelLen: label.length };
      }
    }
    return null;
  }

  function readFret(pos) {
    let j = pos;
    if (j < n && input[j] === "x") return { fret: "x", end: j + 1 };
    let num = "";
    while (j < n && /[0-9]/.test(input[j])) { num += input[j]; j++; }
    return { fret: num, end: j };
  }

  function readTechniques(pos, fret) {
    // Returns sequence of {op, fret} steps
    const seq = [{ op: "", fret }];
    let k = pos;
    while (k < n) {
      const op = input[k];
      if (!"hp/~b\\^x".includes(op)) break;
      if (op === "~" || op === "b") { seq.push({ op, fret: "" }); k++; continue; }
      const { fret: f, end } = readFret(k + 1);
      if (!f) break;
      seq.push({ op, fret: f }); k = end;
    }
    return { seq, end: k };
  }

  while (i < n) {
    const ch = input[i];
    if (/\s/.test(ch)) { i++; continue; }

    // Dash — space/beat
    if (ch === "-") {
      let j = i;
      while (j < n && input[j] === "-") j++;
      events.push({ type: "space", count: j - i });
      i = j; continue;
    }

    // Chord
    if (ch === "(") {
      let j = i + 1, buf = "";
      while (j < n && input[j] !== ")") { buf += input[j]; j++; }
      i = j + 1;
      const notes = [];
      let ci = 0;
      while (ci < buf.length) {
        if (/\s/.test(buf[ci])) { ci++; continue; }
        // Try to match a string label
        let matched = null;
        for (const { string, label } of labelsSorted) {
          if (buf.slice(ci, ci + label.length).toLowerCase() === label.toLowerCase()) {
            matched = { string, labelLen: label.length }; break;
          }
        }
        if (matched) {
          ci += matched.labelLen;
          const { fret, end } = readFret(ci);
          ci = end;
          notes.push({ string: matched.string, fret });
        } else { ci++; }
      }
      events.push({ type: "chord", notes }); continue;
    }

    // Style prefix before a string
    let stylePrefix = "";
    while (i < n && "hp/~b\\^".includes(input[i]) && !getMatchingString(i)) {
      stylePrefix += input[i]; i++;
    }

    // String note
    const match = getMatchingString(i);
    if (match) {
      i += match.labelLen;
      const { fret, end } = readFret(i);
      i = end;
      const { seq, end: end2 } = readTechniques(i, (stylePrefix || "") + fret);
      i = end2;
      seq.forEach(step => {
        events.push({ type: "note", string: match.string, fret: step.op ? step.op + step.fret : step.fret });
      }); continue;
    }

    i++;
  }
  return events;
}

function renderGrid(events, strings) {
  const grid = {};
  strings.forEach(s => (grid[s] = []));

  const pushColumn = () => strings.forEach(s => grid[s].push("-"));

  const write = (stringKey, val) => {
    if (grid[stringKey]) grid[stringKey][grid[stringKey].length - 1] = val;
  };

  events.forEach(ev => {
    if (ev.type === "space") {
      for (let i = 0; i < ev.count; i++) pushColumn();
    } else if (ev.type === "chord") {
      pushColumn();
      ev.notes.forEach(n => write(n.string, n.fret));
    } else if (ev.type === "note") {
      pushColumn();
      write(ev.string, ev.fret);
    }
  });

  const maxLen = Math.max(...strings.map(s => grid[s].length), 0);
  strings.forEach(s => { while (grid[s].length < maxLen) grid[s].push("-"); });
  return grid;
}

function normaliseColumns(grid, strings) {
  if (!strings.length) return grid;
  const numCols = grid[strings[0]].length;
  for (let col = 0; col < numCols; col++) {
    let maxW = 1;
    strings.forEach(s => { if (grid[s][col] && grid[s][col].length > maxW) maxW = grid[s][col].length; });
    strings.forEach(s => {
      const v = grid[s][col] || "-";
      grid[s][col] = v.length < maxW ? v + "-".repeat(maxW - v.length) : v;
    });
  }
  return grid;
}

function buildTabLines(text, strings, labelsMap, wrapAt) {
  if (!text || !strings.length) return [];
  text = text.replace(/[–—−]/g, "-");
  const parts = text.split("\n").filter(p => p.trim() !== "");
  const allLines = [];

  parts.forEach((part, partIdx) => {
    const events = parseEvents(part, strings, labelsMap);
    const grid = renderGrid(events, strings);
    strings.forEach(s => { grid[s].push("-", "-", "-"); });
    normaliseColumns(grid, strings);

    // Max label length for prefix alignment
    const maxLabelLen = Math.max(...strings.map(s => (labelsMap[s] || s[0]).length));
    const rows = strings.map(s => {
      const lbl = (labelsMap[s] || s[0]);
      const prefix = lbl.padEnd(maxLabelLen, " ") + "|";
      return { prefix, cols: grid[s] };
    });

    if (wrapAt && wrapAt > 0) {
      const totalCols = rows[0].cols.length;
      let colStart = 0;
      while (colStart < totalCols) {
        rows.forEach(row => allLines.push(row.prefix + row.cols.slice(colStart, colStart + wrapAt).join("")));
        colStart += wrapAt;
        if (colStart < totalCols) allLines.push("");
      }
    } else {
      rows.forEach(row => allLines.push(row.prefix + row.cols.join("")));
    }
    if (partIdx < parts.length - 1) allLines.push("");
  });
  return allLines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Glossary data
// ─────────────────────────────────────────────────────────────────────────────

const GLOSSARY = [
  { sym: "E5",    desc: "Play string E on fret 5. Type the string label then the fret number." },
  { sym: "()",    desc: "Chord — wrap notes played together. e.g. (G2B3e2) strums all three strings simultaneously." },
  { sym: "-",     desc: "Space or beat separator. Adds blank column width between notes." },
  { sym: "/",     desc: "Slide Up — shift to a higher pitch. e.g. G2/5" },
  { sym: "\\",    desc: "Slide Down — shift to a lower pitch. e.g. G5\\2" },
  { sym: "h",     desc: "Hammer-on — fret note with a tap-down motion. e.g. E1h2" },
  { sym: "p",     desc: "Pull-off — fret note by pulling the finger away. e.g. E2p1" },
  { sym: "~",     desc: "Vibrato — shake string for pitch variation. e.g. A2~" },
  { sym: "x",     desc: "Dead note — muted string strike. e.g. Ax" },
  { sym: "^",     desc: "Trill — rapid hammer/pull alternation. e.g. E1^3" },
  { sym: "b",     desc: "Bend — push string to raise pitch. e.g. A7b" },
  { sym: "Prefix",desc: "Style symbols before a note apply to that note. e.g. hE2 = hammer onto E string fret 2. The - clears any pending prefix." },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const systemScheme = useColorScheme();
  const [darkOverride, setDarkOverride] = useState(null);
  const isDark = darkOverride !== null ? darkOverride : systemScheme !== "light";
  const T = useMemo(() => makeTheme(isDark), [isDark]);
  const s = useMemo(() => makeStyles(T), [T]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [input, setInput]               = useState("- (E2A2D0G0B0e3)--(ExAxD0G2B3e2)he3-/B5\\3---E2-E3-E5-A3-A5-/E7-E5p3p2");
  const [tuningKey, setTuningKey]       = useState("Standard Guitar");
  const [wrapAt, setWrapAt]             = useState(40);
  const [savedTabs, setSavedTabs]       = useState([]);
  const [copyMsg, setCopyMsg]           = useState("");

  // Input cursor tracking
  const inputRef = useRef(null);
  const [selection, setSelection]       = useState({ start: 0, end: 0 });

// Button input state
const [pendingStyle, setPendingStyle] = useState("");
const [pendingString, setPendingString] = useState(null);
const [lastString, setLastString] = useState(null); // Option A chain memory
const [chordMode, setChordMode] = useState(false);  // chord mode active
const [chordBuffer, setChordBuffer] = useState(""); // building chord content

  // Navigation: 0=Studio, 1=Library, 2=Glossary
  const [activeTab, setActiveTab]       = useState(0);

  // Modal states
  const [showSaveModal, setShowSaveModal]       = useState(false);
  const [showTuningModal, setShowTuningModal]   = useState(false);
  const [showWrapModal, setShowWrapModal]       = useState(false);
  const [saveName, setSaveName]                 = useState("");
  const [saveNotes, setSaveNotes]               = useState("");

  // Preview expand
  const [previewExpanded, setPreviewExpanded]   = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const currentStrings = useMemo(() => PRESETS[tuningKey]?.strings || PRESETS["Standard Guitar"].strings, [tuningKey]);
  const labelsMap = useMemo(() => getDifferentiatedLabels(currentStrings), [currentStrings]);
  const outputLines = useMemo(() => buildTabLines(input, currentStrings, labelsMap, wrapAt), [input, currentStrings, labelsMap, wrapAt]);
  const tabText = useMemo(() => outputLines.join("\n"), [outputLines]);

  // ── Persistence ───────────────────────────────────────────────────────────
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
        if (st  !== null && PRESETS[st]) setTuningKey(st);
        if (ss  !== null) setSavedTabs(JSON.parse(ss));
        if (sdm !== null) setDarkOverride(JSON.parse(sdm));
        if (sw  !== null) setWrapAt(JSON.parse(sw));
      } catch (_) {}
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem(STORAGE_INPUT,    input).catch(() => {}); }, [input]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_TUNING,   tuningKey).catch(() => {}); }, [tuningKey]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_SAVED,    JSON.stringify(savedTabs)).catch(() => {}); }, [savedTabs]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_WRAP,     JSON.stringify(wrapAt)).catch(() => {}); }, [wrapAt]);

  const setDarkMode = useCallback((val) => {
    setDarkOverride(val);
    AsyncStorage.setItem(STORAGE_DARKMODE, JSON.stringify(val)).catch(() => {});
  }, []);

  // ── Insert token at cursor ─────────────────────────────────────────────────
  const insertToken = useCallback((token) => {
    const start = selection.start;
    const end = selection.end;
    const newText = input.substring(0, start) + token + input.substring(end);
    setInput(newText);
    const newPos = start + token.length;
    setSelection({ start: newPos, end: newPos });
  }, [input, selection]);

  // ── Button handlers ───────────────────────────────────────────────────────

  const handleStyleBtn = useCallback((token) => {
  if (chordMode) return; // blocked in chord mode

  if (token === "(") {
    setChordMode(true);
    setChordBuffer("");
    setPendingStyle("");
    setPendingString(null);
    return;
  }
  if (token === ")") {
    // Should not appear as active in chord mode, but safety catch
    return;
  }
  if (token === "-") {
    setPendingStyle("");
    setPendingString(null);
    setLastString(null); // dash clears chain memory
    insertToken("-");
    return;
  }
  // Style prefix — toggle
  setPendingStyle(prev => prev === token ? "" : token);
  setPendingString(null);
}, [chordMode, insertToken]);

  const handleStringBtn = useCallback((stringKey) => {
  if (chordMode) {
    // In chord mode, selecting a string just sets pending for fret
    setPendingString(stringKey);
    return;
  }
  if (pendingString === stringKey) {
    setPendingString(null);
  } else {
    setPendingString(stringKey);
  }
}, [chordMode, pendingString]);

 const handleChordClose = useCallback(() => {
  if (!chordMode) return;
  const token = "(" + chordBuffer + ")";
  insertToken(token);
  setChordMode(false);
  setChordBuffer("");
  setPendingString(null);
}, [chordMode, chordBuffer, insertToken]);

  // ── Clipboard / Share ─────────────────────────────────────────────────────
  const flashMsg = (msg) => { setCopyMsg(msg); setTimeout(() => setCopyMsg(""), 2000); };

  const copyToClipboard = useCallback(async () => {
    if (!tabText) return;
    try { await Clipboard.setStringAsync(tabText); flashMsg("✓ Copied!"); }
    catch (_) { flashMsg("Copy failed"); }
  }, [tabText]);

  const shareTab = useCallback(async () => {
    if (!tabText) return;
    try { await Share.share({ message: tabText, title: "Guitar Tab — Tab Sentence" }); }
    catch (e) { if (e.message !== "The user did not share") Alert.alert("Share failed", e.message); }
  }, [tabText]);

  // ── Save / Load ───────────────────────────────────────────────────────────
  const saveCurrentTab = useCallback(() => {
    if (!saveName.trim()) return;
    const entry = {
      id: Date.now().toString(),
      name: saveName.trim(),
      notes: saveNotes.trim(),
      input,
      tuningKey,
      wrapAt,
    };
    setSavedTabs(prev => [entry, ...prev]);
    setSaveName(""); setSaveNotes(""); setShowSaveModal(false);
    flashMsg("✓ Saved!");
  }, [saveName, saveNotes, input, tuningKey, wrapAt]);

  const loadTab = useCallback((entry) => {
    setInput(entry.input);
    if (PRESETS[entry.tuningKey]) setTuningKey(entry.tuningKey);
    if (entry.wrapAt !== undefined) setWrapAt(entry.wrapAt);
    setActiveTab(0);
    flashMsg("✓ Loaded!");
  }, []);

  const deleteTab = useCallback((id) => {
    Alert.alert("Delete Tab", "Remove this saved tab?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setSavedTabs(prev => prev.filter(t => t.id !== id)) },
    ]);
  }, []);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={s.header}>
      <View style={s.headerLeft}>
        <Text style={s.headerTitle}>🐸 Tab Sentence</Text>
        <Text style={s.headerSub}>by Jeremiah Bullfrog</Text>
      </View>
      <TouchableOpacity onPress={() => setDarkMode(!isDark)} style={s.darkBtn}>
        <Text style={s.darkBtnTxt}>{isDark ? "☀️" : "🌙"}</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Tab Studio ────────────────────────────────────────────────────────────
  const renderStudio = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">

      {/* ── Input card ── */}
      <View style={s.card}>
        <View style={s.cardRow}>
          <Text style={[s.cardLabel, { color: T.amber }]}>Shorthand Input</Text>
          <TouchableOpacity onPress={() => setInput("")} style={s.clearBtn}>
            <Text style={s.clearBtnTxt}>✕ Clear</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          ref={inputRef}
          style={s.inputField}
          value={input}
          onChangeText={setInput}
          onSelectionChange={e => setSelection(e.nativeEvent.selection)}
          placeholder="e.g. D2G2B3E2 or (E2A2D0G0B0e3)..."
          placeholderTextColor={T.textHint}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />

        {/* ── Style symbol row ── */}
       <Text style={s.rowLabel}>Style:</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.btnRow}>
  {/* Chord open — always first */}
  <TouchableOpacity
    style={[s.chipBtn, chordMode && s.chipBtnActive]}
    onPress={() => handleStyleBtn("(")}
    disabled={chordMode}
  >
    <Text style={[s.chipTxt, chordMode && s.chipTxtActive]}>(</Text>
  </TouchableOpacity>

  {/* Chord close — only active in chord mode */}
  <TouchableOpacity
    style={[s.chipBtn, chordMode && s.chipBtnActive]}
    onPress={handleChordClose}
    disabled={!chordMode}
  >
    <Text style={[s.chipTxt, chordMode && s.chipTxtActive]}>)</Text>
  </TouchableOpacity>

  {/* Other style buttons — disabled in chord mode */}
  {STYLE_SYMBOLS.filter(s2 => s2.token !== "(" && s2.token !== ")").map(({ label, token }) => {
    const isActive = pendingStyle === token;
    return (
      <TouchableOpacity
        key={token + label}
        style={[s.chipBtn, isActive && s.chipBtnActive, chordMode && { opacity: 0.3 }]}
        onPress={() => handleStyleBtn(token)}
        disabled={chordMode}
      >
        <Text style={[s.chipTxt, isActive && s.chipTxtActive]}>{label}</Text>
      </TouchableOpacity>
    );
  })}
</ScrollView>

        {/* ── String row ── */}
        <Text style={s.rowLabel}>Strings:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.btnRow}>
          {[...currentStrings].reverse().map((str) => {
            const lbl = labelsMap[str] || str[0];
            const isActive = pendingString === str;
            return (
              <TouchableOpacity
                key={str}
                style={[s.chipBtn, s.chipBtnString, isActive && s.chipBtnStringActive]}
                onPress={() => handleStringBtn(str)}
              >
                <Text style={[s.chipTxt, isActive && s.chipTxtStringActive]}>{lbl}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Fret row ── */}
        <Text style={s.rowLabel}>Frets:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.btnRow}>
          {FRETS.map(fret => (
            <TouchableOpacity
              key={fret}
              style={[s.chipBtn, pendingString && s.chipBtnFretReady]}
              onPress={() => handleFretBtn(fret)}
            >
              <Text style={[s.chipTxt, pendingString && s.chipTxtFretReady]}>{fret}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Pending indicator */}
      {chordMode ? (
  <View style={s.pendingRow}>
    <Text style={[s.pendingTxt, { color: T.green }]}>
      🎵 Chord mode — building: ({chordBuffer})
      {pendingString ? `  → tap fret for "${labelsMap[pendingString] || pendingString}"` : "  → tap a string"}
    </Text>
    <TouchableOpacity onPress={() => { setChordMode(false); setChordBuffer(""); setPendingString(null); }}>
      <Text style={{ color: T.red, fontSize: 12, fontWeight: "700" }}>Cancel</Text>
    </TouchableOpacity>
  </View>
) : (pendingStyle || pendingString) ? (
  <View style={s.pendingRow}>
    <Text style={[s.pendingTxt, { color: T.amber }]}>
      {pendingStyle ? `Style: "${pendingStyle}"  ` : ""}
      {pendingString ? `String: "${labelsMap[pendingString] || pendingString}"  ` : ""}
      → {pendingString ? "tap a fret" : "tap a string"}
    </Text>
    <TouchableOpacity onPress={() => { setPendingStyle(""); setPendingString(null); }}>
      <Text style={{ color: T.red, fontSize: 12, fontWeight: "700" }}>Cancel</Text>
    </TouchableOpacity>
  </View>
) : null}
      </View>

      {/* ── Tab Preview card ── */}
      <View style={s.card}>
        <View style={s.cardRow}>
          <Text style={[s.cardLabel, { color: T.text }]}>👁 Tab Preview</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
  <TouchableOpacity onPress={() => setPreviewExpanded(e => !e)} style={s.iconActionBtn}>
    <Text style={[s.iconActionTxt, { color: T.textSecond }]}>{previewExpanded ? "⬆" : "⬇"}</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={() => { setSaveName(""); setSaveNotes(""); setShowSaveModal(true); }} style={[s.iconActionBtn, { borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 8 }]}>
    <Text style={[s.iconActionTxt, { color: T.amber, fontSize: 11, fontWeight: "700" }]}>SAVE</Text>
  </TouchableOpacity>
  <TouchableOpacity onPress={copyToClipboard} style={[s.iconActionBtn, { borderWidth: 1, borderColor: T.border, borderRadius: 6, paddingHorizontal: 8 }]}>
    <Text style={[s.iconActionTxt, { color: T.amber, fontSize: 11, fontWeight: "700" }]}>{copyMsg || "COPY"}</Text>
  </TouchableOpacity>
</View>

        <ScrollView
          style={[s.previewBox, previewExpanded && s.previewBoxExpanded]}
          horizontal={false}
          nestedScrollEnabled
        >
          <ScrollView horizontal showsHorizontalScrollIndicator>
            {outputLines.length === 0 ? (
              <Text style={[s.tabPlaceholder, { color: T.textHint }]}>
                {"Tab preview will appear here.\nEnter notation above to start."}
              </Text>
            ) : (
              <View>
                {outputLines.map((line, i) => (
                  <Text key={i} style={[s.tabLine, { color: T.tabText }]}>{line}</Text>
                ))}
              </View>
            )}
          </ScrollView>
        </ScrollView>
      </View>

      {/* ── Settings card ── */}
      <View style={s.card}>
        {/* Tuning */}
        <Text style={[s.settingLabel, { color: T.amber }]}>Tuning</Text>
        <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowTuningModal(true)}>
          <Text style={[s.dropdownBtnTxt, { color: T.text }]}>{tuningKey}</Text>
          <Text style={[s.dropdownArrow, { color: T.textSecond }]}>▼</Text>
        </TouchableOpacity>
        <Text style={[s.settingDetail, { color: T.textSecond }]}>
          Strings: {currentStrings.map(s2 => labelsMap[s2] || s2[0]).join("  ")}
        </Text>

        <View style={s.divider} />

        {/* Line Wrap */}
        <Text style={[s.settingLabel, { color: T.amber }]}>Line Wrapping</Text>
        <TouchableOpacity style={s.dropdownBtn} onPress={() => setShowWrapModal(true)}>
          <Text style={[s.dropdownBtnTxt, { color: T.text }]}>
            {wrapAt === 0 ? "No Limit" : `${wrapAt} characters`}
          </Text>
          <Text style={[s.dropdownArrow, { color: T.textSecond }]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* ── Buy Me a Coffee ── */}
      <TouchableOpacity
        style={s.coffeeBtn}
        onPress={() => Linking.openURL(BMAC_URL).catch(() => Alert.alert("Could not open link"))}
      >
        <Text style={s.coffeeTxt}>☕  Love Tab Sentence? Buy me a coffee!</Text>
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── My Library ────────────────────────────────────────────────────────────
  const renderLibrary = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
      <Text style={[s.sectionTitle, { color: T.amber }]}>My Saved Guitar Tabs ({savedTabs.length})</Text>

      {savedTabs.length === 0 ? (
        <View style={[s.card, { alignItems: "center", padding: 24 }]}>
          <Text style={{ fontSize: 36 }}>📁</Text>
          <Text style={[s.cardLabel, { color: T.text, marginTop: 10 }]}>No saved tabs yet</Text>
          <Text style={[s.settingDetail, { color: T.textSecond, textAlign: "center", marginTop: 6 }]}>
            Write tab notation in the Studio, then tap 💾 in the preview to save.
          </Text>
        </View>
      ) : (
        savedTabs.map(tab => (
          <View key={tab.id} style={s.card}>
            <View style={s.cardRow}>
              <Text style={[s.cardLabel, { color: T.text, flex: 1 }]}>{tab.name}</Text>
              <TouchableOpacity onPress={() => deleteTab(tab.id)}>
                <Text style={{ color: T.red, fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.settingDetail, { color: T.amber, marginBottom: 4 }]}>
              {tab.tuningKey} — wrap: {tab.wrapAt === 0 ? "none" : `${tab.wrapAt}`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Text style={[s.tabLine, { color: T.tabText, fontSize: 11 }]} numberOfLines={1}>
                {tab.input}
              </Text>
            </ScrollView>
            {tab.notes ? <Text style={[s.settingDetail, { color: T.textSecond, marginTop: 4 }]}>Notes: {tab.notes}</Text> : null}
            <TouchableOpacity style={[s.loadBtn, { backgroundColor: T.amber }]} onPress={() => loadTab(tab)}>
              <Text style={[s.loadBtnTxt, { color: T.amberText }]}>↑ Load into Studio</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Glossary ──────────────────────────────────────────────────────────────
  const renderGlossary = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
      <View style={[s.card, { backgroundColor: T.green }]}>
        <Text style={[s.cardLabel, { color: T.greenText }]}>How to Write a Tab Sentence</Text>
        <Text style={[s.settingDetail, { color: T.greenText, marginTop: 4 }]}>
          A Tab Sentence is inline shorthand for guitar tablature. Type left to right using string
          names and fret numbers. Use the buttons above the input to build notation without typing.
        </Text>
      </View>

      <View style={s.card}>
        <Text style={[s.cardLabel, { color: T.amber }]}>Notation Guide</Text>
        {GLOSSARY.map(({ sym, desc }) => (
          <View key={sym} style={s.glossaryRow}>
            <View style={[s.glossarySymBox, { backgroundColor: T.btnPending }]}>
              <Text style={[s.glossarySym, { color: T.amber }]}>{sym}</Text>
            </View>
            <Text style={[s.glossaryDesc, { color: T.text }]}>{desc}</Text>
          </View>
        ))}
      </View>

      <View style={s.card}>
        <Text style={[s.cardLabel, { color: T.amber }]}>Monospace Export</Text>
        <Text style={[s.settingDetail, { color: T.text }]}>
          For correct alignment when sharing tabs in forums or messages, always use{" "}
          <Text style={{ fontFamily: MONO, fontWeight: "700" }}>Courier New</Text>{" "}
          — it ensures every character occupies identical width.
        </Text>
      </View>
      <View style={{ height: 20 }} />
    </ScrollView>
  );

  // ── Modals ────────────────────────────────────────────────────────────────

  const renderSaveModal = () => (
    <Modal visible={showSaveModal} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { backgroundColor: T.bgModal, borderColor: T.borderAccent }]}>
          <Text style={[s.modalTitle, { color: T.text }]}>Save Tab to Library</Text>
          <TextInput
            style={[s.inputField, { marginTop: 8 }]}
            value={saveName}
            onChangeText={setSaveName}
            placeholder="Tab title / song name"
            placeholderTextColor={T.textHint}
            autoFocus
          />
          <TextInput
            style={[s.inputField, { marginTop: 8, minHeight: 50 }]}
            value={saveNotes}
            onChangeText={setSaveNotes}
            placeholder="Notes (optional, e.g. played with overdrive)"
            placeholderTextColor={T.textHint}
            multiline
          />
          <View style={[s.cardRow, { marginTop: 12, gap: 8 }]}>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border, flex: 1 }]}
              onPress={() => { setShowSaveModal(false); setSaveName(""); setSaveNotes(""); }}>
              <Text style={[s.modalBtnTxt, { color: T.textSecond }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: T.amber, flex: 1 }]} onPress={saveCurrentTab}>
              <Text style={[s.modalBtnTxt, { color: T.amberText }]}>Save Tab</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTuningModal = () => (
    <Modal visible={showTuningModal} animationType="slide">
      <SafeAreaView style={[s.modalFull, { backgroundColor: T.bgModal }]}>
        <Text style={[s.modalTitle, { color: T.text, padding: 16 }]}>Select Tuning</Text>
        <ScrollView>
          {PRESET_KEYS.map(key => (
            <TouchableOpacity
              key={key}
              style={[s.tuningRow, { borderColor: T.border }, key === tuningKey && { backgroundColor: T.btnPending }]}
              onPress={() => { setTuningKey(key); setShowTuningModal(false); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.tuningName, { color: T.text }]}>{key}</Text>
                <Text style={[s.tuningStrings, { color: T.amber }]}>
                  {PRESETS[key].strings.map(str => getDifferentiatedLabels(PRESETS[key].strings)[str] || str[0]).join("  ")}
                </Text>
              </View>
              {key === tuningKey && <Text style={{ color: T.amber, fontSize: 18 }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={[s.modalBtn, { margin: 16, backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
          onPress={() => setShowTuningModal(false)}>
          <Text style={[s.modalBtnTxt, { color: T.textSecond }]}>Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );

  const renderWrapModal = () => (
    <Modal visible={showWrapModal} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { backgroundColor: T.bgModal, borderColor: T.borderAccent }]}>
          <Text style={[s.modalTitle, { color: T.text }]}>Line Wrapping</Text>
          {WRAP_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[s.wrapOption, { borderColor: T.border }, wrapAt === opt.value && { backgroundColor: T.btnPending, borderColor: T.amber }]}
              onPress={() => { setWrapAt(opt.value); setShowWrapModal(false); }}
            >
              <Text style={[s.wrapOptionTxt, { color: T.text }]}>{opt.label}</Text>
              {wrapAt === opt.value && <Text style={{ color: T.amber }}>✓</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[s.modalBtn, { marginTop: 8, backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
            onPress={() => setShowWrapModal(false)}>
            <Text style={[s.modalBtnTxt, { color: T.textSecond }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Bottom Navigation ─────────────────────────────────────────────────────
  const renderNav = () => (
    <View style={[s.navBar, { backgroundColor: T.navBg, borderTopColor: T.border }]}>
      {[
        { icon: "🎸", label: "Tab Studio",  idx: 0 },
        { icon: "📚", label: "My Library",  idx: 1 },
        { icon: "📖", label: "Glossary",    idx: 2 },
      ].map(({ icon, label, idx }) => (
        <TouchableOpacity key={idx} style={s.navItem} onPress={() => setActiveTab(idx)}>
          <Text style={[s.navIcon, { opacity: activeTab === idx ? 1 : 0.45 }]}>{icon}</Text>
          <Text style={[s.navLabel, { color: activeTab === idx ? T.navActive : T.navInactive, fontWeight: activeTab === idx ? "700" : "400" }]}>
            {label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Final render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
      {renderHeader()}
      <View style={{ flex: 1 }}>
        {activeTab === 0 && renderStudio()}
        {activeTab === 1 && renderLibrary()}
        {activeTab === 2 && renderGlossary()}
      </View>
      {renderNav()}

      {renderSaveModal()}
      {renderTuningModal()}
      {renderWrapModal()}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(T) {
  return StyleSheet.create({
    safe: { flex: 1 },

    // Header
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: T.border,
      backgroundColor: T.bgCard,
    },
    headerLeft:  { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: T.text, letterSpacing: 0.3 },
    headerSub:   { fontSize: 10, color: T.textSecond, marginTop: 1, letterSpacing: 0.8 },
    darkBtn:     { padding: 8 },
    darkBtnTxt:  { fontSize: 20 },

    // Cards
    card: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: T.border,
      backgroundColor: T.bgCard,
      padding: 12,
      marginBottom: 10,
    },
    cardRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    cardLabel: { fontSize: 13, fontWeight: "700" },

    // Input
    inputField: {
      minHeight: 64,
      borderWidth: 1,
      borderColor: T.border,
      borderRadius: 8,
      padding: 10,
      fontFamily: MONO,
      fontSize: 12,
      color: T.text,
      backgroundColor: T.bgInput,
      textAlignVertical: "top",
      marginBottom: 8,
    },

    clearBtn:    { padding: 4 },
    clearBtnTxt: { fontSize: 11, color: T.red, fontWeight: "600" },

    // Button rows
    rowLabel: { fontSize: 11, fontWeight: "700", color: T.textSecond, marginBottom: 4, marginTop: 4 },
    btnRow:   { marginBottom: 4 },

    // Chip buttons
    chipBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: T.bgInput,
      borderWidth: 1,
      borderColor: T.border,
      marginRight: 6,
      marginBottom: 4,
    },
    chipBtnActive: {
      backgroundColor: T.amber,
      borderColor: T.amberDark,
    },
    chipTxt:    { fontFamily: MONO, fontSize: 13, fontWeight: "700", color: T.textSecond },
    chipTxtActive: { color: T.amberText },

    chipBtnString: { borderColor: T.green },
    chipBtnStringActive: { backgroundColor: T.green, borderColor: T.green },
    chipTxtStringActive: { color: T.greenText },

    chipBtnFretReady: { borderColor: T.amber, backgroundColor: T.btnPending },
    chipTxtFretReady: { color: T.amber },

    // Pending indicator
    pendingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: T.btnPending,
      borderRadius: 6,
      padding: 6,
      marginTop: 4,
    },
    pendingTxt: { fontSize: 11, fontWeight: "600" },

    // Preview
    previewBox: {
      backgroundColor: T.tabBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: T.tabBorder,
      minHeight: 120,
      maxHeight: 200,
      padding: 8,
    },
    previewBoxExpanded: { maxHeight: 400 },

    tabLine: {
      fontFamily: MONO,
      fontSize: 12,
      lineHeight: 18,
      letterSpacing: 0,
    },
    tabPlaceholder: {
      fontFamily: MONO,
      fontSize: 11,
      padding: 10,
    },

    iconActionBtn:  { paddingHorizontal: 6, paddingVertical: 2 },
    iconActionTxt:  { fontSize: 16, color: T.amber },

    // Settings / dropdowns
    settingLabel:  { fontSize: 12, fontWeight: "700", marginBottom: 4 },
    settingDetail: { fontSize: 11, color: T.textSecond, marginTop: 2 },
    dropdownBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: T.bgInput,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: T.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 4,
    },
    dropdownBtnTxt: { flex: 1, fontSize: 13, fontWeight: "600" },
    dropdownArrow:  { fontSize: 12 },
    divider: { height: 1, backgroundColor: T.border, marginVertical: 12 },

    // Coffee
    coffeeBtn: {
      borderRadius: 8,
      backgroundColor: T.amber,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 8,
    },
    coffeeTxt: { fontWeight: "800", fontSize: 13, color: T.amberText, letterSpacing: 0.5 },

    // Library
    sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
    loadBtn:      { alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 8 },
    loadBtnTxt:   { fontSize: 12, fontWeight: "700" },

    // Glossary
    glossaryRow:    { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border },
    glossarySymBox: { width: 54, borderRadius: 4, padding: 4, alignItems: "center", marginRight: 10, flexShrink: 0 },
    glossarySym:    { fontFamily: MONO, fontWeight: "700", fontSize: 13 },
    glossaryDesc:   { flex: 1, fontSize: 12, lineHeight: 16 },

    // Modals
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      padding: 20,
    },
    modalBox: {
      borderRadius: 12,
      padding: 18,
      borderWidth: 1,
    },
    modalFull:  { flex: 1 },
    modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
    modalBtn:   { paddingVertical: 11, borderRadius: 8, alignItems: "center" },
    modalBtnTxt:{ fontWeight: "700", fontSize: 13 },

    tuningRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tuningName:    { fontSize: 14, fontWeight: "700" },
    tuningStrings: { fontSize: 11, fontFamily: MONO, marginTop: 2, letterSpacing: 0.5 },

    wrapOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 6,
    },
    wrapOptionTxt: { fontSize: 14, fontWeight: "600" },

    // Nav
    navBar: {
      flexDirection: "row",
      borderTopWidth: 1,
      paddingBottom: Platform.OS === "ios" ? 12 : 4,
      paddingTop: 6,
    },
    navItem:  { flex: 1, alignItems: "center", justifyContent: "center" },
    navIcon:  { fontSize: 20 },
    navLabel: { fontSize: 10, marginTop: 2, letterSpacing: 0.3 },
  });
}

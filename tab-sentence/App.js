// App.js — Tab Sentence
// Visual refresh: warm dark studio theme + Buy Me a Coffee integration

import React, { useState, useEffect, useMemo } from “react”;
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
} from “react-native”;
import * as Clipboard from “expo-clipboard”;
import AsyncStorage from “@react-native-async-storage/async-storage”;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MONO = Platform.select({
android: “monospace”,
ios:     “Courier New”,
default: “monospace”,
});

const BMAC_URL = “https://buymeacoffee.com/Bullfrog”;

const STORAGE_INPUT    = “@tabsentence_input”;
const STORAGE_TUNING   = “@tabsentence_tuning”;
const STORAGE_SAVED    = “@tabsentence_saved”;
const STORAGE_DARKMODE = “@tabsentence_darkmode”;
const STORAGE_WRAP     = “@tabsentence_wrap”;

const DEFAULT_WRAP = 80;

// ─────────────────────────────────────────────────────────────────────────────
// Theme
// Two modes: dark (default, studio feel) and light (warm parchment)
// ─────────────────────────────────────────────────────────────────────────────

function makeTheme(dark) {
return dark ? {
dark:        true,
bg:          “#1c1710”,   // deep mahogany
bgSecond:    “#231e14”,   // slightly lighter for output box
bgInput:     “#2a2318”,   // warm dark for inputs
bgModal:     “#1c1710”,
bgCard:      “#2e2619”,   // card / row backgrounds
border:      “#3d3426”,   // warm dark border
borderInput: “#4a3e2c”,
borderAccent:”#c8922a”,   // amber — guitar hardware gold
text:        “#f0e6d0”,   // warm off-white
textSecond:  “#a8916e”,   // muted amber
textHint:    “#5c4e38”,
amber:       “#c8922a”,   // primary accent
amberDark:   “#9e7020”,   // pressed state
amberText:   “#1c1710”,   // text on amber buttons
green:       “#4a7c59”,   // muted studio green for secondary actions
greenText:   “#f0e6d0”,
red:         “#8b3a3a”,
coffee:      “#FFDD00”,
coffeeText:  “#1c1710”,
} : {
dark:        false,
bg:          “#faf6ee”,   // warm parchment
bgSecond:    “#f2ebe0”,
bgInput:     “#ffffff”,
bgModal:     “#faf6ee”,
bgCard:      “#f0e8d8”,
border:      “#d4c4a8”,
borderInput: “#c8b48e”,
borderAccent:”#b07d2a”,
text:        “#2a1f0e”,
textSecond:  “#7a5c38”,
textHint:    “#b09878”,
amber:       “#b07d2a”,
amberDark:   “#8a6020”,
amberText:   “#ffffff”,
green:       “#3d6b4a”,
greenText:   “#ffffff”,
red:         “#8b3a3a”,
coffee:      “#c8922a”,
coffeeText:  “#ffffff”,
};
}

// ─────────────────────────────────────────────────────────────────────────────
// Tuning display helpers
// ─────────────────────────────────────────────────────────────────────────────

function displayString(s) {
if (s.length >= 2 && /[0-9]/.test(s[s.length - 1])) {
return s[s.length - 1] + s.slice(0, s.length - 1);
}
return s;
}

function displayTuning(strings) {
return strings.map(displayString).join(”  “);
}

// ─────────────────────────────────────────────────────────────────────────────
// Glossary
// ─────────────────────────────────────────────────────────────────────────────

const GLOSSARY_ENTRIES = [
[”~”,  “Vibrato / bend & release — e.g. A2~”],
[“h”,  “Hammer-on — e.g. E1h2”],
[“p”,  “Pull-off — e.g. E2p1”],
[“x”,  “Muted / dead note — e.g. Ax”],
[”^”,  “Trill — rapid hammer/pull — e.g. E1^3”],
[”/”,  “Slide up — e.g. G2/5”],
[”\”, “Slide down — e.g. G5\2”],
[“b”,  “Bend — e.g. A7b”],
[”()”, “Chord — notes played together — e.g. (G2B3e2)”],
[”-”,  “Space / sustain — adds width between notes”],
[
“Octave prefix”,
“Only needed when your tuning has more than one string on the same note “ +
“(e.g. Drop D, Open G, DADGAD).\n\n” +
“Put the octave number before the note letter to choose the exact string:\n\n” +
“  Drop D  [4e · 3B · 3G · 3D · 2A · 2D]\n” +
“    3D5  → fret 5 on the 3D string\n” +
“    2D5  → fret 5 on the 2D string\n” +
“    D5   → fret 5 on the highest D\n\n” +
“Works inside chords too: (4D7 3B3 3G0)\n\n” +
“For standard tunings where every note letter is unique, “ +
“you never need the octave prefix at all.”,
],
];

// ─────────────────────────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = {
“Standard Guitar”:  [“e4”,“B3”,“G3”,“D3”,“A2”,“E2”],
“Drop D”:           [“e4”,“B3”,“G3”,“D3”,“A2”,“D2”],
“Open G”:           [“D4”,“B3”,“G3”,“D3”,“G2”,“D2”],
“DADGAD”:           [“D4”,“A3”,“G3”,“D3”,“A2”,“D2”],
Bass:               [“G2”,“D2”,“A1”,“E1”],
“5-String Bass”:    [“G2”,“D2”,“A1”,“E1”,“B0”],
Ukulele:            [“A4”,“E4”,“C4”,“G4”],
“Baritone Ukulele”: [“E3”,“B2”,“G2”,“D2”],
};

// ─────────────────────────────────────────────────────────────────────────────
// Parser helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveString(letter, octave, strings) {
if (octave) {
const key = letter + octave;
const m1 = strings.find(t => t === key);
if (m1) return m1;
const m2 = strings.find(t => t.toLowerCase() === key.toLowerCase());
if (m2) return m2;
}
const m3 = strings.find(t => t[0] === letter);
if (m3) return m3;
const m4 = strings.find(t => t[0].toLowerCase() === letter.toLowerCase());
return m4 || null;
}

function hasDuplicateLetter(letter, strings) {
return strings.filter(t => t[0].toLowerCase() === letter.toLowerCase()).length > 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseEvents
// ─────────────────────────────────────────────────────────────────────────────

function parseEvents(input, strings) {
const events = [];
let i = 0;

while (i < input.length) {
const ch = input[i];

```
if (/\s/.test(ch)) { i++; continue; }

if (ch === "(") {
  let j = i + 1, buf = "";
  while (j < input.length && input[j] !== ")") { buf += input[j]; j++; }
  i = j + 1;
  const rawNotes = buf.match(/[0-9]?[A-Ga-g][0-9x]*/g) || [];
  const notes = rawNotes.map(n => {
    let octave = "", letter, fret;
    if (/^[0-9]/.test(n) && n.length >= 2 && /[A-Ga-g]/.test(n[1])) {
      octave = n[0]; letter = n[1]; fret = n.slice(2);
    } else {
      letter = n[0]; fret = n.slice(1);
    }
    if (octave && !hasDuplicateLetter(letter, strings)) {
      fret = octave + fret; octave = "";
    }
    const key = resolveString(letter, octave, strings);
    return { string: key || letter, fret };
  });
  events.push({ type: "chord", notes });
  continue;
}

if (ch === "-") {
  let j = i;
  while (j < input.length && input[j] === "-") j++;
  events.push({ type: "space", count: j - i });
  i = j;
  continue;
}

if (
  /[0-9]/.test(ch) &&
  i + 1 < input.length &&
  /[A-Ga-g]/.test(input[i + 1])
) {
  const octaveCandidate = ch;
  const letterCandidate = input[i + 1];
  if (hasDuplicateLetter(letterCandidate, strings)) {
    const resolved = resolveString(letterCandidate, octaveCandidate, strings);
    if (resolved) {
      const stringKey = resolved;
      let j = i + 2;
      if (j < input.length && input[j] === "x" && !/[0-9]/.test(input[j + 1] || "")) {
        events.push({ type: "note", string: stringKey, sequence: [{ fret: "x" }] });
        i = j + 1; continue;
      }
      let num = "";
      while (j < input.length && /[0-9]/.test(input[j])) { num += input[j]; j++; }
      const sequence = [{ fret: num }];
      let k = j;
      while (k < input.length) {
        const op = input[k];
        if (!"hp/~b\\^x".includes(op)) break;
        if (op === "~" || op === "b") { sequence.push({ op, fret: "" }); k++; continue; }
        let m = k + 1, f = "";
        while (m < input.length && /[0-9x]/.test(input[m])) { f += input[m]; m++; }
        if (!f) break;
        sequence.push({ op, fret: f }); k = m;
      }
      events.push({ type: "note", string: stringKey, sequence });
      i = k; continue;
    }
  }
  i++; continue;
}

if (/[A-Ga-g]/.test(ch)) {
  const letter = ch;
  let j = i + 1;
  const stringKey = resolveString(letter, "", strings) || letter;
  if (j < input.length && input[j] === "x" && !/[0-9]/.test(input[j + 1] || "")) {
    events.push({ type: "note", string: stringKey, sequence: [{ fret: "x" }] });
    i = j + 1; continue;
  }
  let num = "";
  while (j < input.length && /[0-9]/.test(input[j])) { num += input[j]; j++; }
  const sequence = [{ fret: num }];
  let k = j;
  while (k < input.length) {
    const op = input[k];
    if (!"hp/~b\\^x".includes(op)) break;
    if (op === "~" || op === "b") { sequence.push({ op, fret: "" }); k++; continue; }
    let m = k + 1, f = "";
    while (m < input.length && /[0-9x]/.test(input[m])) { f += input[m]; m++; }
    if (!f) break;
    sequence.push({ op, fret: f }); k = m;
  }
  events.push({ type: "note", string: stringKey, sequence });
  i = k; continue;
}

i++;
```

}
return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// renderGrid
// ─────────────────────────────────────────────────────────────────────────────

function renderGrid(events, strings) {
const grid = {};
strings.forEach(s => (grid[s] = []));
const pushColumn = () => strings.forEach(s => grid[s].push(”-”));
const write = (stringKey, val) => {
let match = strings.find(t => t === stringKey);
if (!match) match = strings.find(t => t.toLowerCase() === stringKey.toLowerCase());
if (!match) match = strings.find(t => t[0] === stringKey[0]);
if (!match) match = strings.find(t => t[0].toLowerCase() === stringKey[0].toLowerCase());
if (match) grid[match][grid[match].length - 1] = val;
};
events.forEach(ev => {
if (ev.type === “space”) { for (let i = 0; i < ev.count; i++) pushColumn(); return; }
if (ev.type === “chord”) { pushColumn(); ev.notes.forEach(n => write(n.string, n.fret)); return; }
if (ev.type === “note”) { ev.sequence.forEach(step => { pushColumn(); write(ev.string, step.op ? step.op + step.fret : step.fret); }); }
});
const maxLen = Math.max(…strings.map(s => grid[s].length), 0);
strings.forEach(s => { while (grid[s].length < maxLen) grid[s].push(”-”); });
return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// normaliseColumns
// ─────────────────────────────────────────────────────────────────────────────

function normaliseColumns(grid, strings) {
if (!strings.length) return grid;
const numCols = grid[strings[0]].length;
for (let col = 0; col < numCols; col++) {
let maxW = 1;
strings.forEach(s => { const v = grid[s][col]; if (v && v.length > maxW) maxW = v.length; });
strings.forEach(s => {
const v = grid[s][col] || “-”;
if (v.length < maxW) grid[s][col] = v + “-”.repeat(maxW - v.length);
});
}
return grid;
}

// ─────────────────────────────────────────────────────────────────────────────
// buildTabLines
// ─────────────────────────────────────────────────────────────────────────────

function buildTabLines(text, tuning, wrapAt) {
if (typeof text !== “string”) text = “”;
text = text.replace(/–|—|−/g, “-”);
const parts    = text.split(”\n”).filter(p => p.trim() !== “”);
const allLines = [];

parts.forEach((part, partIdx) => {
const events = parseEvents(part, tuning);
const grid   = renderGrid(events, tuning);
const maxLen = Math.max(…tuning.map(s => grid[s].length), 0);
tuning.forEach(s => {
while (grid[s].length < maxLen) grid[s].push(”-”);
grid[s].push(”-”, “-”, “-”);
});
normaliseColumns(grid, tuning);
const rows = tuning.map(s => ({ label: s[0] + “|”, cols: grid[s] }));

```
if (wrapAt && wrapAt > 0) {
  const totalCols = rows[0].cols.length;
  let colStart = 0;
  while (colStart < totalCols) {
    rows.forEach(row => allLines.push(row.label + row.cols.slice(colStart, colStart + wrapAt).join("")));
    colStart += wrapAt;
    if (colStart < totalCols) allLines.push("");
  }
} else {
  rows.forEach(row => allLines.push(row.label + row.cols.join("")));
}
if (partIdx < parts.length - 1) allLines.push("");
```

});
return allLines;
}

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
const systemScheme                    = useColorScheme();
const [darkOverride, setDarkOverride] = useState(null);
const isDark = darkOverride !== null ? darkOverride : systemScheme !== “light”;
const T      = useMemo(() => makeTheme(isDark), [isDark]);

const [input, setInput]               = useState(”(G2B3e2)G2/5––E1A2-D3A2~–E1h2p1-Ax”);
const [outputLines, setOutputLines]   = useState([]);
const [tuning, setTuning]             = useState(PRESETS[“Standard Guitar”]);
const [wrapAt, setWrapAt]             = useState(DEFAULT_WRAP);

const [showGlossary, setShowGlossary]     = useState(false);
const [showTuning, setShowTuning]         = useState(false);
const [showSaved, setShowSaved]           = useState(false);
const [showSettings, setShowSettings]     = useState(false);
const [showSaveDialog, setShowSaveDialog] = useState(false);

const [tuningMode, setTuningMode]     = useState(“presets”);
const [customTuning, setCustomTuning] = useState(””);

const [savedTabs, setSavedTabs] = useState([]);
const [saveName, setSaveName]   = useState(””);
const [copyMsg, setCopyMsg]     = useState(””);

// ── Restore ───────────────────────────────────────────────────────────────
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
} catch (_e) { /* use defaults */ }
})();
}, []);

// ── Persist ───────────────────────────────────────────────────────────────
useEffect(() => { AsyncStorage.setItem(STORAGE_INPUT,  input).catch(_e => {}); }, [input]);
useEffect(() => { AsyncStorage.setItem(STORAGE_TUNING, JSON.stringify(tuning)).catch(_e => {}); }, [tuning]);
useEffect(() => { AsyncStorage.setItem(STORAGE_SAVED,  JSON.stringify(savedTabs)).catch(_e => {}); }, [savedTabs]);
useEffect(() => { AsyncStorage.setItem(STORAGE_WRAP,   JSON.stringify(wrapAt)).catch(_e => {}); }, [wrapAt]);

// ── Reparse ───────────────────────────────────────────────────────────────
useEffect(() => { setOutputLines(buildTabLines(input, tuning, wrapAt)); }, [input, tuning, wrapAt]);

// ── Helpers ───────────────────────────────────────────────────────────────
const getTabText = () => outputLines.join(”\n”);
const flashMsg   = (msg) => { setCopyMsg(msg); setTimeout(() => setCopyMsg(””), 2000); };

const copyToClipboard = async () => {
const text = getTabText();
if (!text) return;
try { await Clipboard.setStringAsync(text); flashMsg(“✓ Copied!”); }
catch (_e) { flashMsg(“Copy failed”); }
};

const shareTab = async () => {
const text = getTabText();
if (!text) return;
try { await Share.share({ message: text, title: “Guitar Tab” }); }
catch (e) { if (e.message !== “The user did not share”) Alert.alert(“Share failed”, e.message); }
};

const openCoffee = () => Linking.openURL(BMAC_URL).catch(_e => Alert.alert(“Could not open link”));

const applyCustomTuning = () => {
const raw = customTuning.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
const strings = raw.map(s => {
if (s.length >= 2 && /[0-9]/.test(s[0]) && /[A-Ga-g]/.test(s[1])) return s[1] + s[0] + s.slice(2);
return s;
});
if (!strings.length) return;
setTuning(strings);
setShowTuning(false);
};

const setDarkMode = (val) => {
setDarkOverride(val);
AsyncStorage.setItem(STORAGE_DARKMODE, JSON.stringify(val)).catch(_e => {});
};

const saveCurrentTab = () => {
if (!saveName.trim()) return;
setSavedTabs(prev => [{ id: Date.now().toString(), name: saveName.trim(), input, tuning }, …prev]);
setSaveName(””); setShowSaveDialog(false); flashMsg(“✓ Saved!”);
};

const loadTab = (entry) => { setInput(entry.input); setTuning(entry.tuning); setShowSaved(false); };

const deleteTab = (id) => {
Alert.alert(“Delete Tab”, “Remove this saved tab?”, [
{ text: “Cancel”, style: “cancel” },
{ text: “Delete”, style: “destructive”, onPress: () => setSavedTabs(prev => prev.filter(t => t.id !== id)) },
]);
};

const s = useMemo(() => makeStyles(T), [T]);

// ─────────────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────────────

return (
<SafeAreaView style={[s.safe, { backgroundColor: T.bg }]}>
<View style={s.container}>

```
    {/* ── Header ──────────────────────────────────────────────────────── */}
    <View style={s.header}>
      <View>
        <Text style={s.title}>🐸 Tab Sentence</Text>
        <Text style={s.subtitle}>by Jeremiah Bullfrog</Text>
      </View>
      <View style={s.row}>
        <TouchableOpacity onPress={() => setDarkMode(!isDark)} style={s.iconBtn}>
          <Text style={s.iconTxt}>{isDark ? "☀️" : "🌙"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={s.iconBtn}>
          <Text style={s.iconTxt}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </View>

    {/* ── Example button ───────────────────────────────────────────────── */}
    <TouchableOpacity
      style={[s.btn, s.btnOutline, { borderColor: T.borderAccent }]}
      onPress={() => setInput("(G2B3e2)G2/5----E1A2-D3A2~--E1h2p1-Ax")}>
      <Text style={[s.btnTxt, { color: T.amber }]}>Try Example</Text>
    </TouchableOpacity>

    {/* ── Input ────────────────────────────────────────────────────────── */}
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

    {/* ── Top action row ───────────────────────────────────────────────── */}
    <View style={s.row}>
      <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
        onPress={() => setShowGlossary(true)}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>Glossary</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.amber }]}
        onPress={() => { setCustomTuning(displayTuning(tuning).replace(/  /g, ", ")); setShowTuning(true); }}>
        <Text style={[s.btnTxt, { color: T.amberText }]}>Tuning</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.green }]}
        onPress={() => setShowSaved(true)}>
        <Text style={[s.btnTxt, { color: T.greenText }]}>Saved</Text>
      </TouchableOpacity>
    </View>

    {/* ── Tuning label ─────────────────────────────────────────────────── */}
    <View style={[s.tuningBar, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      <Text style={[s.tuningLabel, { color: T.textSecond }]}>
        <Text style={{ color: T.amber }}>♩ </Text>
        {displayTuning(tuning)}
      </Text>
    </View>

    {/* ── Tab output ───────────────────────────────────────────────────── */}
    <ScrollView style={[s.outputBox, { backgroundColor: T.bgSecond, borderColor: T.border }]}>
      {outputLines.length === 0 ? (
        <Text style={[s.hint, { color: T.textHint }]}>Parsed tab will appear here…</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {outputLines.map((L, i) => (
              <Text key={i} style={[s.tabOutput, { color: T.text }]}>{L}</Text>
            ))}
          </View>
        </ScrollView>
      )}
    </ScrollView>

    {/* ── Bottom action row ────────────────────────────────────────────── */}
    <View style={[s.row, { marginTop: 10 }]}>
      <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.amber }]}
        onPress={copyToClipboard}>
        <Text style={[s.btnTxt, { color: T.amberText }]}>{copyMsg || "📋 Copy"}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
        onPress={shareTab}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>↑ Share</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
        onPress={() => setShowSaveDialog(true)}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>💾 Save</Text>
      </TouchableOpacity>
    </View>

    {/* ── Buy Me a Coffee ──────────────────────────────────────────────── */}
    <TouchableOpacity style={[s.coffeeBtn, { backgroundColor: T.coffee }]} onPress={openCoffee}>
      <Text style={[s.coffeeTxt, { color: T.coffeeText }]}>☕  Buy me a coffee</Text>
    </TouchableOpacity>

  </View>

  {/* ════════════════════════════════════════════════════════════════════ */}
  {/* GLOSSARY                                                             */}
  {/* ════════════════════════════════════════════════════════════════════ */}
  <Modal visible={showGlossary} animationType="slide">
    <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
      <Text style={[s.modalTitle, { color: T.text }]}>Glossary</Text>
      <ScrollView>
        {GLOSSARY_ENTRIES.map(([k, v]) => (
          <View key={k} style={[s.glossaryRow, { borderColor: T.border }]}>
            <Text style={[s.glossaryKey, { color: T.amber }]}>{k}</Text>
            <Text style={[s.glossaryVal, { color: T.text }]}>{v}</Text>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity style={[s.btn, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border, marginTop: 10 }]}
        onPress={() => setShowGlossary(false)}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  </Modal>

  {/* ════════════════════════════════════════════════════════════════════ */}
  {/* TUNING                                                               */}
  {/* ════════════════════════════════════════════════════════════════════ */}
  <Modal visible={showTuning} animationType="slide">
    <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
      <Text style={[s.modalTitle, { color: T.text }]}>Select Tuning</Text>

      <View style={[s.modeToggle, { borderColor: T.amber }]}>
        {["presets", "custom"].map(mode => (
          <TouchableOpacity key={mode}
            style={[s.modeBtn, tuningMode === mode && { backgroundColor: T.amber }]}
            onPress={() => setTuningMode(mode)}>
            <Text style={[s.modeBtnTxt, { color: tuningMode === mode ? T.amberText : T.text }]}>
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
              <Text style={[s.presetStrings, { color: T.amber }]}>{displayTuning(strings)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={[s.customHint, { color: T.textSecond }]}>
            Enter strings from highest to lowest, separated by spaces or commas.{"\n"}
            Use octave-first format: 4e, 3B, 3G, 3D, 2A, 2E
          </Text>
          <TextInput style={s.input} value={customTuning} onChangeText={setCustomTuning}
            placeholder="4e, 3B, 3G, 3D, 2A, 2E" placeholderTextColor={T.textHint}
            autoCapitalize="none" autoCorrect={false} />
          <TouchableOpacity style={[s.btn, { backgroundColor: T.amber }]} onPress={applyCustomTuning}>
            <Text style={[s.btnTxt, { color: T.amberText }]}>Apply Custom Tuning</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={[s.btn, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
        onPress={() => setShowTuning(false)}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  </Modal>

  {/* ════════════════════════════════════════════════════════════════════ */}
  {/* SAVED TABS                                                           */}
  {/* ════════════════════════════════════════════════════════════════════ */}
  <Modal visible={showSaved} animationType="slide">
    <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
      <Text style={[s.modalTitle, { color: T.text }]}>Saved Tabs</Text>
      {savedTabs.length === 0 ? (
        <Text style={[s.hint, { marginTop: 20, color: T.textHint }]}>
          No saved tabs yet.{"\n"}Tap 💾 Save on the main screen to save a tab.
        </Text>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {savedTabs.map(tab => (
            <View key={tab.id} style={[s.savedRow, { borderColor: T.border, backgroundColor: T.bgCard }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.savedName, { color: T.text }]}>{tab.name}</Text>
                <Text style={[s.savedPreview, { color: T.amber }]} numberOfLines={1}>
                  {displayTuning(tab.tuning)}  ·  {tab.input.slice(0, 40)}{tab.input.length > 40 ? "…" : ""}
                </Text>
              </View>
              <View style={s.savedActions}>
                <TouchableOpacity style={[s.savedBtn, { backgroundColor: T.amber }]} onPress={() => loadTab(tab)}>
                  <Text style={[s.savedBtnTxt, { color: T.amberText }]}>Load</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.savedBtn, { backgroundColor: T.red }]} onPress={() => deleteTab(tab.id)}>
                  <Text style={[s.savedBtnTxt, { color: "#fff" }]}>Del</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <TouchableOpacity style={[s.btn, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border, marginTop: 10 }]}
        onPress={() => setShowSaved(false)}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  </Modal>

  {/* ════════════════════════════════════════════════════════════════════ */}
  {/* SAVE DIALOG                                                          */}
  {/* ════════════════════════════════════════════════════════════════════ */}
  <Modal visible={showSaveDialog} transparent animationType="fade">
    <View style={s.dialogOverlay}>
      <View style={[s.dialogBox, { backgroundColor: T.bgModal, borderColor: T.borderAccent }]}>
        <Text style={[s.modalTitle, { fontSize: 17, marginBottom: 12, color: T.text }]}>Name this tab</Text>
        <TextInput style={[s.input, { minHeight: 44, marginBottom: 12 }]}
          value={saveName} onChangeText={setSaveName}
          placeholder="e.g. Intro Riff" placeholderTextColor={T.textHint} autoFocus />
        <View style={s.row}>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border }]}
            onPress={() => { setShowSaveDialog(false); setSaveName(""); }}>
            <Text style={[s.btnTxt, { color: T.textSecond }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.flex, { backgroundColor: T.amber }]} onPress={saveCurrentTab}>
            <Text style={[s.btnTxt, { color: T.amberText }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>

  {/* ════════════════════════════════════════════════════════════════════ */}
  {/* SETTINGS                                                             */}
  {/* ════════════════════════════════════════════════════════════════════ */}
  <Modal visible={showSettings} animationType="slide">
    <SafeAreaView style={[s.modalSafe, { backgroundColor: T.bgModal }]}>
      <Text style={[s.modalTitle, { color: T.text }]}>Settings</Text>
      <ScrollView>

        <View style={[s.settingRow, { borderColor: T.border }]}>
          <Text style={[s.settingLabel, { color: T.text }]}>Appearance</Text>
          <Text style={[s.settingHint, { color: T.textSecond }]}>
            {darkOverride === null
              ? "Following system (" + (systemScheme ?? "unknown") + ")"
              : isDark ? "Dark — studio mode" : "Light — parchment mode"}
          </Text>
          <View style={[s.row, { marginTop: 8 }]}>
            {[
              { label: "System", val: null  },
              { label: "Dark",   val: true   },
              { label: "Light",  val: false  },
            ].map(opt => (
              <TouchableOpacity key={String(opt.val)}
                style={[s.segBtn, { borderColor: T.border },
                  darkOverride === opt.val && { backgroundColor: T.amber, borderColor: T.amber }]}
                onPress={() => setDarkMode(opt.val)}>
                <Text style={[s.segBtnTxt, { color: darkOverride === opt.val ? T.amberText : T.text }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[s.settingRow, { borderColor: T.border }]}>
          <Text style={[s.settingLabel, { color: T.text }]}>Line Wrap</Text>
          <Text style={[s.settingHint, { color: T.textSecond }]}>
            {wrapAt === 0 ? "Off — single long line" : `Wrap every ${wrapAt} columns`}
          </Text>
          <View style={[s.row, { marginTop: 8, flexWrap: "wrap" }]}>
            {[{ label: "Off", val: 0 }, { label: "40", val: 40 }, { label: "60", val: 60 }, { label: "80", val: 80 }].map(opt => (
              <TouchableOpacity key={opt.val}
                style={[s.segBtn, { borderColor: T.border },
                  wrapAt === opt.val && { backgroundColor: T.amber, borderColor: T.amber }]}
                onPress={() => setWrapAt(opt.val)}>
                <Text style={[s.segBtnTxt, { color: wrapAt === opt.val ? T.amberText : T.text }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Coffee link in settings too */}
        <View style={[s.settingRow, { borderColor: T.border }]}>
          <Text style={[s.settingLabel, { color: T.text }]}>Support the app</Text>
          <Text style={[s.settingHint, { color: T.textSecond }]}>
            Tab Sentence is free. If it's useful, a coffee is always appreciated.
          </Text>
          <TouchableOpacity style={[s.coffeeBtn, { backgroundColor: T.coffee, marginTop: 10 }]} onPress={openCoffee}>
            <Text style={[s.coffeeTxt, { color: T.coffeeText }]}>☕  Buy me a coffee</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
      <TouchableOpacity style={[s.btn, { backgroundColor: T.bgCard, borderWidth: 1, borderColor: T.border, marginTop: 10 }]}
        onPress={() => setShowSettings(false)}>
        <Text style={[s.btnTxt, { color: T.textSecond }]}>Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  </Modal>

</SafeAreaView>
```

);
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(T) {
return StyleSheet.create({
safe:      { flex: 1 },
container: { flex: 1, padding: 18, backgroundColor: T.bg },

```
header: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 14,
},
title:    { fontSize: 22, fontWeight: "800", color: T.text, letterSpacing: 0.5 },
subtitle: { fontSize: 11, color: T.textSecond, marginTop: 1, letterSpacing: 1 },
iconBtn:  { padding: 6 },
iconTxt:  { fontSize: 20 },

input: {
  minHeight: 80,
  borderWidth: 1,
  borderColor: T.borderInput,
  borderRadius: 6,
  padding: 10,
  marginBottom: 12,
  fontFamily: MONO,
  fontSize: 13,
  color: T.text,
  backgroundColor: T.bgInput,
  textAlignVertical: "top",
},

btn:        { paddingVertical: 10, borderRadius: 6, alignItems: "center", marginBottom: 12 },
btnOutline: { backgroundColor: "transparent", borderWidth: 1 },
btnTxt:     { color: "#fff", fontWeight: "700", fontSize: 13 },
flex:       { flex: 1 },
row:        { flexDirection: "row", gap: 8 },

tuningBar: {
  borderWidth: 1,
  borderRadius: 6,
  paddingHorizontal: 12,
  paddingVertical: 7,
  marginBottom: 10,
},
tuningLabel: {
  fontSize: 12,
  fontFamily: MONO,
  letterSpacing: 0.5,
},

outputBox: {
  borderWidth: 1,
  padding: 12,
  borderRadius: 6,
  minHeight: 200,
  marginTop: 0,
},
tabOutput: {
  fontFamily: MONO,
  fontSize: 13,
  lineHeight: 18,
  letterSpacing: 0,
},
hint: { fontFamily: MONO },

coffeeBtn: {
  paddingVertical: 11,
  borderRadius: 6,
  alignItems: "center",
  marginTop: 2,
  marginBottom: 4,
},
coffeeTxt: { fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },

modalSafe:  { flex: 1, padding: 20 },
modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 16 },

glossaryRow: { marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
glossaryKey: { fontFamily: MONO, fontWeight: "700", fontSize: 15 },
glossaryVal: { fontSize: 14, marginTop: 2, lineHeight: 20 },

modeToggle: {
  flexDirection: "row",
  borderWidth: 1,
  borderRadius: 6,
  overflow: "hidden",
  marginBottom: 16,
},
modeBtn:       { flex: 1, paddingVertical: 9, alignItems: "center" },
modeBtnTxt:    { fontWeight: "700" },
presetRow:     { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
presetName:    { fontWeight: "700", fontSize: 15 },
presetStrings: { fontSize: 12, fontFamily: MONO, marginTop: 3, letterSpacing: 0.5 },
customHint:    { fontSize: 13, marginBottom: 10, lineHeight: 20 },

savedRow: {
  flexDirection: "row",
  alignItems: "center",
  padding: 12,
  borderRadius: 6,
  marginBottom: 8,
  borderWidth: 1,
},
savedName:    { fontWeight: "700", fontSize: 15 },
savedPreview: { fontSize: 12, fontFamily: MONO, marginTop: 2 },
savedActions: { flexDirection: "row", gap: 6 },
savedBtn:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
savedBtnTxt:  { fontWeight: "700", fontSize: 13 },

dialogOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.7)",
  justifyContent: "center",
  padding: 24,
},
dialogBox: { borderRadius: 10, padding: 20, borderWidth: 1 },

settingRow:   { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
settingLabel: { fontWeight: "700", fontSize: 15 },
settingHint:  { fontSize: 12, marginTop: 3, lineHeight: 18 },
segBtn: {
  paddingHorizontal: 14,
  paddingVertical: 7,
  borderRadius: 5,
  borderWidth: 1,
  marginRight: 6,
  marginBottom: 4,
},
segBtnTxt: { fontWeight: "600", fontSize: 13 },
```

});
}

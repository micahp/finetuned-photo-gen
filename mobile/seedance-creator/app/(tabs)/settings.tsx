// ─── Settings screen ───
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { getApiKey, setApiKey, clearApiKey } from "../../lib/storage";
import { initFalClient, isFalConfigured } from "../../lib/fal";

export default function SettingsScreen() {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    getApiKey().then((existing) => {
      if (existing) {
        setKey(existing);
        setSaved(true);
      }
    });
  }, []);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      Alert.alert("Error", "Please enter a valid API key.");
      return;
    }

    setChecking(true);
    try {
      // Quick validation: try to hit the FAL API models endpoint
      const resp = await fetch("https://api.fal.ai/v1/models", {
        headers: { Authorization: `Key ${trimmed}` },
      });
      if (!resp.ok) {
        Alert.alert(
          "Invalid Key",
          "The API key appears to be invalid. Please check it and try again.",
        );
        setChecking(false);
        return;
      }

      await setApiKey(trimmed);
      initFalClient(trimmed);
      setSaved(true);
      Alert.alert("Saved", "FAL.ai API key configured successfully!");
    } catch {
      Alert.alert("Error", "Could not verify the API key. Please check your connection.");
    } finally {
      setChecking(false);
    }
  };

  const handleClear = async () => {
    Alert.alert("Clear API Key", "Remove your saved API key?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearApiKey();
          setKey("");
          setSaved(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* API Key section */}
        <Text style={styles.sectionTitle}>FAL.ai API Key</Text>
        <Text style={styles.sectionHint}>
          You need a FAL.ai API key to generate videos with Seedance 2.0. Get one at
          fal.ai/dashboard.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Paste your FAL.ai API key..."
          placeholderTextColor="#555"
          value={key}
          onChangeText={(text) => {
            setKey(text);
            setSaved(false);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={checking}
          >
            <Text style={styles.saveButtonText}>
              {checking ? "Verifying..." : saved ? "✓ Saved" : "Save & Verify"}
            </Text>
          </TouchableOpacity>
          {saved && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* About section */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Seedance Creator</Text>
          <Text style={styles.aboutVersion}>v1.0.0</Text>
          <Text style={styles.aboutBody}>
            Create AI-generated anime video clips using ByteDance's Seedance 2.0
            model via FAL.ai.
            {"\n\n"}
            Features:{"\n"}
            • Storyboard editor with add/remove/reorder scenes{"\n"}
            • 10 style presets (anime, cartoon, cinematic, etc.){"\n"}
            • Reference image support for character consistency{"\n"}
            • Direct FAL.ai Seedance 2.0 integration{"\n"}
            • Gallery for all generated clips{"\n\n"}
            Seedance 2.0 constraints:{"\n"}
            • Max 9 reference images, 3 videos, 3 audio files{"\n"}
            • Max prompt length: 5,000 characters{"\n"}
            • Video duration: 5, 10, or 15 seconds
          </Text>
        </View>

        {/* Links */}
        <View style={styles.linksSection}>
          <Text style={styles.sectionTitle}>References</Text>
          <TouchableOpacity style={styles.linkCard}>
            <Text style={styles.linkText}>
              📖 Seedance Prompt Skill (prompt crafting guide)
            </Text>
            <Text style={styles.linkUrl}>
              github.com/songguoxs/seedance-prompt-skill
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkCard}>
            <Text style={styles.linkText}>
              🎬 Moyin Creator (production pipeline inspiration)
            </Text>
            <Text style={styles.linkUrl}>
              github.com/MemeCalculate/moyin-creator
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkCard}>
            <Text style={styles.linkText}>
              ⚡ FAL.ai Seedance 2.0 API
            </Text>
            <Text style={styles.linkUrl}>fal.ai/models/seedance-v2-pro</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#70E155" },
  body: { flex: 1, paddingHorizontal: 20 },
  sectionTitle: {
    color: "#AAA",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionHint: { color: "#777", fontSize: 13, lineHeight: 18, marginBottom: 12 },
  input: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    color: "#EEE",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 10,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#70E155",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#0D0D0D",
    fontSize: 15,
    fontWeight: "700",
  },
  clearButton: {
    backgroundColor: "#2A1313",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#E5540",
  },
  clearButtonText: { color: "#E55", fontSize: 15, fontWeight: "600" },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginVertical: 24,
  },
  aboutCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  aboutTitle: { color: "#EEE", fontSize: 18, fontWeight: "700" },
  aboutVersion: { color: "#70E155", fontSize: 13, marginTop: 2 },
  aboutBody: { color: "#888", fontSize: 13, lineHeight: 20, marginTop: 12 },
  linksSection: { marginTop: 24 },
  linkCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  linkText: { color: "#CCC", fontSize: 14, fontWeight: "600" },
  linkUrl: { color: "#70E155", fontSize: 12, marginTop: 4 },
});

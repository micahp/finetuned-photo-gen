// ─── Scene editor screen (renders as modal) ───
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { loadStoryboards, updateStoryboard, generateId } from "../../lib/storage";
import {
  Storyboard,
  Scene,
  STYLE_PRESETS,
  StylePresetKey,
  buildSeedancePrompt,
  SEEDANCE_LIMITS,
} from "../../lib/types";
import {
  submitSeedanceJob,
  checkJobStatus,
  initFalClient,
  isFalConfigured,
} from "../../lib/fal";
import { getApiKey } from "../../lib/storage";

export default function SceneEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New scene form state
  const [promptText, setPromptText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<StylePresetKey>("anime");
  const [referenceImageUri, setReferenceImageUri] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("");

  const scene = storyboard?.scenes.find((s) => s.id === selectedSceneId);

  // Load storyboard
  useEffect(() => {
    if (!id) return;
    loadStoryboards().then((all) => {
      const sb = all.find((s) => s.id === id);
      setStoryboard(sb ?? null);
      setLoading(false);
    });
  }, [id]);

  // Init FAL client
  useEffect(() => {
    getApiKey().then((key) => {
      if (key) initFalClient(key);
    });
  }, []);

  const refreshStoryboard = useCallback(async () => {
    if (!id) return;
    const all = await loadStoryboards();
    const sb = all.find((s) => s.id === id);
    setStoryboard(sb ?? null);
  }, [id]);

  // Add scene
  const handleAddScene = async () => {
    if (!storyboard) return;
    const scene: Scene = {
      id: generateId(),
      prompt: promptText.trim(),
      referenceImageUri,
      stylePreset: selectedPreset,
      status: "idle",
      createdAt: Date.now(),
    };
    const updated: Storyboard = {
      ...storyboard,
      scenes: [...storyboard.scenes, scene],
    };
    await updateStoryboard(updated);
    setStoryboard(updated);
    setPromptText("");
    setReferenceImageUri(undefined);
    setSelectedSceneId(scene.id);
  };

  // Delete scene
  const handleDeleteScene = (sceneId: string) => {
    if (!storyboard) return;
    Alert.alert("Remove Scene", "Remove this scene from the storyboard?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const updated: Storyboard = {
            ...storyboard,
            scenes: storyboard.scenes.filter((s) => s.id !== sceneId),
          };
          await updateStoryboard(updated);
          setStoryboard(updated);
          if (selectedSceneId === sceneId) setSelectedSceneId(null);
        },
      },
    ]);
  };

  // Pick image
  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setReferenceImageUri(result.assets[0].uri);
    }
  };

  // Generate
  const handleGenerate = async () => {
    if (!scene) return;
    if (!isFalConfigured()) {
      Alert.alert("API Key Required", "Set your FAL.ai API key in Settings first.");
      return;
    }

    setGenerating(true);
    setGenStatus("Submitting...");

    try {
      const fullPrompt = buildSeedancePrompt(
        scene.prompt,
        scene.stylePreset,
        !!scene.referenceImageUri,
      );

      const { requestId } = await submitSeedanceJob(fullPrompt);

      // Update scene with request ID
      const updatedScenes = storyboard!.scenes.map((s) =>
        s.id === scene.id
          ? { ...s, status: "generating" as const, falRequestId: requestId }
          : s,
      );
      const updated: Storyboard = { ...storyboard!, scenes: updatedScenes };
      await updateStoryboard(updated);
      setStoryboard(updated);

      // Poll
      setGenStatus("Generating (this may take a few minutes)...");
      const deadline = Date.now() + 600_000; // 10 min
      while (Date.now() < deadline) {
        const result = await checkJobStatus(requestId);
        if (result.status === "done") {
          const doneScenes = storyboard!.scenes.map((s) =>
            s.id === scene.id
              ? {
                  ...s,
                  status: "done" as const,
                  generatedVideoUri: result.videoUrl,
                }
              : s,
          );
          const doneUpdated: Storyboard = { ...storyboard!, scenes: doneScenes };
          await updateStoryboard(doneUpdated);
          setStoryboard(doneUpdated);
          setGenStatus("");
          setGenerating(false);
          return;
        }
        if (result.status === "failed") {
          throw new Error(result.error ?? "Generation failed");
        }
        setGenStatus(
          `Generating... (${result.status === "queued" ? "in queue" : "running"})`,
        );
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error("Timed out");
    } catch (e: any) {
      const failedScenes = storyboard!.scenes.map((s) =>
        s.id === scene.id
          ? {
              ...s,
              status: "failed" as const,
              errorMessage: e.message,
            }
          : s,
      );
      const failedUpdated: Storyboard = { ...storyboard!, scenes: failedScenes };
      await updateStoryboard(failedUpdated);
      setStoryboard(failedUpdated);
      Alert.alert("Generation Failed", e.message);
    } finally {
      setGenerating(false);
      setGenStatus("");
    }
  };

  // Rename storyboard
  const handleRename = () => {
    if (!storyboard) return;
    Alert.prompt?.(
      "Rename",
      "Enter a new title:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Rename",
          onPress: async (text?: string) => {
            if (text && text.trim()) {
              const updated = { ...storyboard, title: text.trim() };
              await updateStoryboard(updated);
              setStoryboard(updated);
            }
          },
        },
      ],
      "plain-text",
      storyboard.title,
    ) ??
      // Fallback for non-iOS: just let them delete and recreate
      Alert.alert("Rename", `Current title: ${storyboard.title}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#70E155" />
      </View>
    );
  }

  if (!storyboard) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Storyboard not found</Text>
      </View>
    );
  }

  const fullPrompt = scene
    ? buildSeedancePrompt(scene.prompt, scene.stylePreset, !!scene.referenceImageUri)
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {storyboard.title}
        </Text>
        <TouchableOpacity onPress={handleRename}>
          <Text style={styles.editButton}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scene list */}
        <Text style={styles.sectionTitle}>
          Scenes ({storyboard.scenes.length})
        </Text>
        {storyboard.scenes.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[
              styles.sceneCard,
              s.id === selectedSceneId && styles.sceneCardSelected,
            ]}
            onPress={() => setSelectedSceneId(s.id)}
            onLongPress={() => handleDeleteScene(s.id)}
          >
            <View style={styles.sceneInfo}>
              <Text style={styles.scenePrompt} numberOfLines={2}>
                {s.prompt || "Empty prompt"}
              </Text>
              <View style={styles.sceneMeta}>
                <Text style={styles.scenePreset}>
                  {STYLE_PRESETS[s.stylePreset].label}
                </Text>
                <Text
                  style={[
                    styles.sceneStatus,
                    s.status === "done" && styles.sceneStatusDone,
                    s.status === "generating" && styles.sceneStatusGenerating,
                    s.status === "failed" && styles.sceneStatusFailed,
                  ]}
                >
                  {s.status === "done"
                    ? "✓ Done"
                    : s.status === "generating"
                      ? "⏳ Generating"
                      : s.status === "failed"
                        ? "✗ Failed"
                        : "Pending"}
                </Text>
              </View>
            </View>
            {s.referenceImageUri && (
              <Text style={styles.sceneHasRef}>🖼</Text>
            )}
          </TouchableOpacity>
        ))}

        {storyboard.scenes.length === 0 && (
          <Text style={styles.emptyHint}>
            Add your first scene below — write a prompt and pick a style preset.
          </Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Add scene form */}
        <Text style={styles.sectionTitle}>New Scene</Text>

        {/* Preset selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.presetScroll}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
        >
          {(Object.keys(STYLE_PRESETS) as StylePresetKey[]).map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.presetChip,
                selectedPreset === key && styles.presetChipActive,
              ]}
              onPress={() => setSelectedPreset(key)}
            >
              <Text
                style={[
                  styles.presetChipText,
                  selectedPreset === key && styles.presetChipTextActive,
                ]}
              >
                {STYLE_PRESETS[key].label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Prompt input */}
        <TextInput
          style={styles.promptInput}
          placeholder="Describe your scene in detail... (e.g. A warrior draws her sword under cherry blossoms, petals swirling in slow motion)"
          placeholderTextColor="#555"
          multiline
          numberOfLines={4}
          value={promptText}
          onChangeText={setPromptText}
        />

        {/* Reference image */}
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          <Text style={styles.imagePickerText}>
            {referenceImageUri ? "🖼 Reference image selected" : "📷 Add reference image (optional)"}
          </Text>
        </TouchableOpacity>

        {/* Prompt preview */}
        {promptText.trim() ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>
              Full prompt ({fullPrompt.length}/{SEEDANCE_LIMITS.maxPromptChars} chars):
            </Text>
            <Text style={styles.previewText}>{fullPrompt}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.addButton,
            !promptText.trim() && styles.addButtonDisabled,
          ]}
          disabled={!promptText.trim()}
          onPress={handleAddScene}
        >
          <Text style={styles.addButtonText}>+ Add Scene to Storyboard</Text>
        </TouchableOpacity>

        {/* Generate button (for selected scene) */}
        {scene && (scene.status === "idle" || scene.status === "failed") && (
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <View style={styles.generatingRow}>
                <ActivityIndicator size="small" color="#0D0D0D" />
                <Text style={styles.generateButtonText}>{genStatus}</Text>
              </View>
            ) : (
              <Text style={styles.generateButtonText}>
                🎬 Generate Video (Seedance 2.0)
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Generated video */}
        {scene?.status === "done" && scene.generatedVideoUri && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>✓ Generation complete!</Text>
            <Text style={styles.resultUrl} numberOfLines={1}>
              {scene.generatedVideoUri}
            </Text>
            <Text style={styles.resultHint}>
              Video saved to gallery. View it in the Gallery tab.
            </Text>
          </View>
        )}

        {scene?.status === "failed" && (
          <View style={styles.resultBoxError}>
            <Text style={styles.resultLabelError}>✗ Generation failed</Text>
            <Text style={styles.resultErrorText}>{scene.errorMessage}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  center: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#E55", fontSize: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  backButton: { color: "#70E155", fontSize: 17, fontWeight: "600" },
  title: {
    flex: 1,
    color: "#EEE",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginHorizontal: 12,
  },
  editButton: { color: "#70E155", fontSize: 15 },
  body: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: {
    color: "#AAA",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 10,
  },
  sceneCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  sceneCardSelected: {
    borderColor: "#70E155",
    borderWidth: 1.5,
  },
  sceneInfo: { flex: 1 },
  scenePrompt: { color: "#CCC", fontSize: 14, lineHeight: 20 },
  sceneMeta: {
    flexDirection: "row",
    marginTop: 6,
    gap: 12,
    alignItems: "center",
  },
  scenePreset: { color: "#70E155", fontSize: 12, fontWeight: "600" },
  sceneStatus: { color: "#777", fontSize: 12 },
  sceneStatusDone: { color: "#70E155" },
  sceneStatusGenerating: { color: "#FFB347" },
  sceneStatusFailed: { color: "#E55" },
  sceneHasRef: { fontSize: 16, marginLeft: 8, alignSelf: "center" },
  emptyHint: { color: "#555", fontSize: 14, textAlign: "center", marginTop: 20 },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginTop: 24,
    marginBottom: 4,
  },
  presetScroll: { marginTop: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
  },
  presetChipActive: {
    backgroundColor: "#70E15520",
    borderColor: "#70E155",
  },
  presetChipText: { color: "#888", fontSize: 13, fontWeight: "500" },
  presetChipTextActive: { color: "#70E155" },
  promptInput: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 14,
    color: "#EEE",
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    lineHeight: 22,
  },
  imagePicker: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    borderStyle: "dashed",
  },
  imagePickerText: { color: "#777", fontSize: 14 },
  previewBox: {
    marginTop: 12,
    backgroundColor: "#111",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  previewLabel: { color: "#70E155", fontSize: 12, marginBottom: 6 },
  previewText: { color: "#AAA", fontSize: 13, lineHeight: 18 },
  addButton: {
    backgroundColor: "#70E155",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "700",
  },
  generateButton: {
    backgroundColor: "#FFB347",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  generatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  generateButtonText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "700",
  },
  resultBox: {
    marginTop: 16,
    backgroundColor: "#132A13",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#70E15540",
  },
  resultLabel: { color: "#70E155", fontSize: 15, fontWeight: "700" },
  resultUrl: { color: "#70E155", fontSize: 12, marginTop: 6 },
  resultHint: { color: "#777", fontSize: 12, marginTop: 4 },
  resultBoxError: {
    marginTop: 16,
    backgroundColor: "#2A1313",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5540",
  },
  resultLabelError: { color: "#E55", fontSize: 15, fontWeight: "700" },
  resultErrorText: { color: "#E88", fontSize: 13, marginTop: 4 },
});

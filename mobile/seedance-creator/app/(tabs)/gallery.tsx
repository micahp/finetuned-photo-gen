// ─── Gallery of generated clips ───
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadStoryboards } from "../../lib/storage";
import { Storyboard, Scene, STYLE_PRESETS } from "../../lib/types";

interface GalleryItem {
  storyboardTitle: string;
  storyboardId: string;
  scene: Scene;
}

export default function GalleryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);

  const refresh = useCallback(async () => {
    const all = await loadStoryboards();
    const gallery: GalleryItem[] = [];
    for (const sb of all) {
      for (const scene of sb.scenes) {
        if (scene.status === "done" && scene.generatedVideoUri) {
          gallery.push({ storyboardTitle: sb.title, storyboardId: sb.id, scene });
        }
      }
    }
    setItems(gallery);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fresh when screen gains focus
  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const openVideo = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot Open", "Copy the URL and open in a browser.");
    }
  };

  const renderItem = ({ item }: { item: GalleryItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openVideo(item.scene.generatedVideoUri!)}
      onLongPress={() =>
        router.push({
          pathname: "/scene/[id]",
          params: { id: item.storyboardId },
        })
      }
    >
      <View style={styles.thumbnailPlaceholder}>
        <Text style={styles.playIcon}>▶</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardPrompt} numberOfLines={2}>
          {item.scene.prompt || "Untitled scene"}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardStoryboard}>{item.storyboardTitle}</Text>
          <Text style={styles.cardPreset}>
            {STYLE_PRESETS[item.scene.stylePreset].label}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gallery</Text>
        <Text style={styles.headerSubtitle}>
          {items.length} generated clip{items.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.scene.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎞️</Text>
            <Text style={styles.emptyText}>No generated clips yet</Text>
            <Text style={styles.emptyHint}>
              Create a storyboard and generate scenes to see them here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#70E155" },
  headerSubtitle: { fontSize: 14, color: "#888", marginTop: 2 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    flexDirection: "row",
  },
  thumbnailPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { fontSize: 32, color: "#70E155", opacity: 0.7 },
  cardInfo: { flex: 1, padding: 12, justifyContent: "center" },
  cardPrompt: { color: "#CCC", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardStoryboard: { color: "#777", fontSize: 12 },
  cardPreset: { color: "#70E155", fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 120 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#777" },
  emptyHint: { fontSize: 14, color: "#555", marginTop: 6, textAlign: "center", paddingHorizontal: 40 },
});

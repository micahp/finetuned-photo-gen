// ─── Storyboards list screen ───
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  loadStoryboards,
  addStoryboard,
  deleteStoryboard,
  generateId,
} from "../../lib/storage";
import { Storyboard } from "../../lib/types";

export default function StoryboardsScreen() {
  const router = useRouter();
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const refresh = useCallback(async () => {
    const data = await loadStoryboards();
    setStoryboards(data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = async () => {
    const title = newTitle.trim() || "Untitled Storyboard";
    const sb: Storyboard = {
      id: generateId(),
      title,
      scenes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await addStoryboard(sb);
    setNewTitle("");
    setShowNewModal(false);
    await refresh();
  };

  const handleDelete = (sb: Storyboard) => {
    Alert.alert("Delete", `Delete "${sb.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteStoryboard(sb.id);
          refresh();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Storyboard }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({ pathname: "/scene/[id]", params: { id: item.id } })
      }
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>
          {item.scenes.length} scene{item.scenes.length !== 1 ? "s" : ""}
          {" • "}
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Seedance Creator</Text>
        <Text style={styles.headerSubtitle}>AI Anime Storyboard Studio</Text>
      </View>

      <FlatList
        data={storyboards}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyText}>No storyboards yet</Text>
            <Text style={styles.emptyHint}>
              Tap + to create your first storyboard
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewModal(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* New storyboard modal */}
      <Modal visible={showNewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Storyboard</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Storyboard title..."
              placeholderTextColor="#999"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={() => {
                  setShowNewModal(false);
                  setNewTitle("");
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonCreate}
                onPress={handleCreate}
              >
                <Text style={styles.modalButtonCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D0D" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#70E155",
    letterSpacing: -0.5,
  },
  headerSubtitle: { fontSize: 14, color: "#888", marginTop: 2 },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#EEE" },
  cardSubtitle: { fontSize: 13, color: "#777", marginTop: 4 },
  cardArrow: { fontSize: 28, color: "#555", marginLeft: 8 },
  empty: { alignItems: "center", paddingTop: 120 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#777" },
  emptyHint: { fontSize: 14, color: "#555", marginTop: 6 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#70E155",
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#70E155",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  fabText: { fontSize: 32, color: "#0D0D0D", lineHeight: 34 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 30,
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#EEE",
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 14,
    color: "#EEE",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
  },
  modalButtonCancel: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  modalButtonCancelText: { color: "#888", fontSize: 16 },
  modalButtonCreate: {
    backgroundColor: "#70E155",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  modalButtonCreateText: {
    color: "#0D0D0D",
    fontSize: 16,
    fontWeight: "700",
  },
});

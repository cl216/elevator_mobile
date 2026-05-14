import React, { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { autoCapitalize } from "@/src/utils/text";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createPrivateSessionRequest } from "@/src/api/privateSessionRequests";

const COLORS = {
  bg: "#05070F",
  surface: "#0D1424",
  surfaceSoft: "#121A2C",

  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",

  border: "rgba(110,145,255,0.12)",
  borderStrong: "rgba(110,145,255,0.28)",

  accent: "#6F92FF",
  accentSoft: "rgba(111,146,255,0.12)",
  accentBorder: "rgba(111,146,255,0.25)",

  divider: "rgba(255,255,255,0.06)",
};

function addDays(days: number) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 2);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateTime(date?: Date | null) {
  if (!date) return "Select date & time";
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PickerField({
  label,
  value,
  onPress,
  onClear,
  removable = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  onClear?: () => void;
  removable?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={styles.pickerCard}>
      <View style={styles.pickerIconCircle}>
        <Text style={styles.pickerIconText}>✎</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.pickerLabel}>{label}</Text>
        <Text style={styles.pickerValue}>{value}</Text>
        <Text style={styles.pickerHint}>Tap to change this time</Text>
      </View>

      {removable && onClear ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onClear();
          }}
          style={styles.clearButton}
        >
          <Text style={styles.clearButtonText}>Remove</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default function PrivateSessionRequestScreen() {

  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    teacherId?: string;
    teacherName?: string;
    category?: string;
  }>();

  const teacherId = typeof params.teacherId === "string" ? params.teacherId : "";
  const teacherName =
    typeof params.teacherName === "string" && params.teacherName.trim()
      ? params.teacherName
      : "this teacher";

  const categoryHint =
    typeof params.category === "string" && params.category.trim()
      ? params.category
      : "";

  const [message, setMessage] = useState(
    categoryHint
      ? `Hi, I’d love a private 1:1 session for ${categoryHint}.`
      : "",
  );
  const [learnerNote, setLearnerNote] = useState("");
  const [duration, setDuration] = useState("60");

  const [option1, setOption1] = useState<Date | null>(addDays(1));
  const [option2, setOption2] = useState<Date | null>(addDays(3));
  const [option3, setOption3] = useState<Date | null>(null);

  const [editingSlot, setEditingSlot] = useState<1 | 2 | 3 | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [saving, setSaving] = useState(false);

  const currentEditingDate = useMemo(() => {
    if (editingSlot === 1) return option1 ?? addDays(1);
    if (editingSlot === 2) return option2 ?? addDays(3);
    if (editingSlot === 3) return option3 ?? addDays(5);
    return new Date();
  }, [editingSlot, option1, option2, option3]);

  function setEditingDate(next: Date) {
    if (editingSlot === 1) setOption1(next);
    if (editingSlot === 2) setOption2(next);
    if (editingSlot === 3) setOption3(next);
  }

  function openSlotPicker(slot: 1 | 2 | 3) {
    setEditingSlot(slot);
    setShowTimePicker(false);
    setShowDatePicker(true);
  }

  const selectedSlots = [option1, option2, option3].filter(Boolean) as Date[];

  async function handleSubmit() {
    if (!teacherId) {
      Alert.alert(
        "Missing teacher",
        "Could not find the teacher for this request.",
      );
      return;
    }

    if (!message.trim()) {
      Alert.alert(
        "Missing message",
        "Please add a short message for the teacher.",
      );
      return;
    }

    const parsedDuration = Number(duration);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      Alert.alert(
        "Invalid duration",
        "Please enter a valid duration in minutes.",
      );
      return;
    }

    if (selectedSlots.length === 0) {
      Alert.alert(
        "Missing date and time",
        "Please choose at least one date and time suggestion.",
      );
      return;
    }

    const now = Date.now();

    for (const slot of selectedSlots) {
      if (!(slot instanceof Date) || Number.isNaN(slot.getTime())) {
        Alert.alert("Invalid time", "One of your selected times is invalid.");
        return;
      }

      if (slot.getTime() <= now) {
        Alert.alert("Invalid time", "All selected times must be in the future.");
        return;
      }
    }

    try {
      setSaving(true);

      await createPrivateSessionRequest({
        teacher_id: teacherId,
        message: message.trim(),
        requested_date_1: option1?.toISOString() ?? null,
        requested_date_2: option2?.toISOString() ?? null,
        requested_date_3: option3?.toISOString() ?? null,
        requested_duration_minutes: parsedDuration,
        learner_note: learnerNote.trim() || undefined,
      });

      Alert.alert(
        "Request sent",
        `Your private session request has been sent to ${teacherName}.`,
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
      );
    } catch (e: any) {
      const rawMessage =
        e?.response?.data?.message ??
        e?.message ??
        "Could not send request.";

      const msg = Array.isArray(rawMessage)
        ? rawMessage.join("\n")
        : String(rawMessage);

      Alert.alert("Request failed", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
    <ScrollView
  contentContainerStyle={[
    styles.content,
    { paddingTop: Math.max(24, insets.top + 18) },
  ]}
  showsVerticalScrollIndicator={false}
>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Private 1:1 request</Text>
              </View>

              <Text style={styles.title}>Request a private session</Text>
              <Text style={styles.subtitle}>
                Suggest up to 3 date and time options for {teacherName}. If they
                accept, they’ll turn one into a paid bookable session in the app.
              </Text>
            </View>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.cardOuter}>
          <View style={styles.cardInner}>
            <Text style={styles.sectionTitle}>Your request</Text>

            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
          onChangeText={setMessage}
          autoCapitalize="sentences"
                      placeholder="What do you want help with?"
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={styles.textArea}
            />

            <Text style={styles.helperText}>
              Keep it simple. For example: “I’d love a private beginner piano
              lesson focused on chords and timing.”
            </Text>

            <Text style={styles.label}>Preferred duration (minutes)</Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Extra note</Text>
            <TextInput
              value={learnerNote}
          onChangeText={setLearnerNote}
          autoCapitalize="sentences"
            placeholder="Anything helpful for the teacher to know"
              placeholderTextColor={COLORS.textMuted}
              multiline
              style={styles.textAreaSmall}
            />
          </View>
        </View>

        <View style={styles.cardOuter}>
          <View style={styles.cardInner}>
            <Text style={styles.sectionTitle}>Suggested dates and times</Text>
<Text style={styles.sectionSubtitle}>
  We’ve suggested 2 times to make this quicker. Tap any option to change it, or add a third time.
</Text>

            <View style={styles.pickerStack}>
              <PickerField
                label="Suggestion 1"
                value={formatDateTime(option1)}
                onPress={() => openSlotPicker(1)}
              />

              <PickerField
                label="Suggestion 2"
                value={formatDateTime(option2)}
                onPress={() => openSlotPicker(2)}
              />

              {option3 ? (
                <PickerField
                  label="Suggestion 3"
                  value={formatDateTime(option3)}
                  onPress={() => openSlotPicker(3)}
                  onClear={() => setOption3(null)}
                  removable
                />
              ) : (
                <Pressable
                  onPress={() => {
                    setOption3(addDays(5));
                    setEditingSlot(3);
                    setShowTimePicker(false);
                    setShowDatePicker(true);
                  }}
                  style={styles.addSuggestionButton}
                >
                  <Text style={styles.addSuggestionButtonText}>
+ Add another time option                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

<View style={styles.noticeBox}>
  <Text style={styles.noticeTitle}>How this works</Text>
  <Text style={styles.noticeText}>
    This does not start a chat. The teacher reviews your request and can
    accept or decline it. If accepted, they’ll create a private 1:1 session
    just for you, which you can then book securely through the app.
  </Text>
</View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleSubmit}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !saving && styles.buttonPressed,
              saving && styles.buttonDisabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send request</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            disabled={saving}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>

      {showDatePicker && editingSlot ? (
        <DateTimePicker
          value={currentEditingDate}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            setShowDatePicker(false);

            if (!selected) return;

            const next = new Date(currentEditingDate);
            next.setFullYear(
              selected.getFullYear(),
              selected.getMonth(),
              selected.getDate(),
            );
            setEditingDate(next);
            setShowTimePicker(true);
          }}
        />
      ) : null}

      {showTimePicker && editingSlot ? (
        <DateTimePicker
          value={currentEditingDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            setShowTimePicker(false);

            if (!selected) return;

            const next = new Date(currentEditingDate);
            next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            setEditingDate(next);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  pickerIconCircle: {
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: COLORS.accentSoft,
  borderWidth: 1,
  borderColor: COLORS.accentBorder,
  alignItems: "center",
  justifyContent: "center",
},

pickerIconText: {
  color: COLORS.text,
  fontSize: 15,
  fontWeight: "900",
},

pickerHint: {
  color: COLORS.accent,
  fontSize: 12,
  fontWeight: "800",
  marginTop: 5,
},

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  hero: {
    marginBottom: 18,
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  heroTextWrap: {
    flex: 1,
  },

  heroBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    marginBottom: 12,
  },

  heroBadgeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
    marginBottom: 8,
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
  },

  backButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  backButtonText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  cardOuter: {
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    marginBottom: 14,
    overflow: "hidden",
  },

  cardInner: {
    margin: 8,
    borderRadius: 18,
    backgroundColor: COLORS.bg,
    padding: 16,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },

  sectionSubtitle: {
    color: COLORS.textSoft,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },

  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 10,
  },

  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },

  textAreaSmall: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
  },

  helperText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },

  pickerStack: {
    gap: 10,
  },

  pickerCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  pickerLabel: {
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 4,
  },

  pickerValue: {
    color: COLORS.textSoft,
  },

  clearButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.bg,
  },

  clearButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  addSuggestionButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  addSuggestionButtonText: {
    color: COLORS.text,
    fontWeight: "800",
  },

  noticeBox: {
    marginBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    backgroundColor: COLORS.accentSoft,
    padding: 14,
  },

  noticeTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },

  noticeText: {
    color: COLORS.textSoft,
    lineHeight: 20,
    fontSize: 14,
  },

  actions: {
    gap: 10,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  secondaryButton: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  buttonPressed: {
    opacity: 0.86,
  },

  buttonDisabled: {
    opacity: 0.7,
  },
});
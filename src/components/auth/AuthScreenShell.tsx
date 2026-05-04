import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export const AUTH_COLORS = {
  bg: "#05070F",
  text: "#F5F8FF",
  textSoft: "rgba(222,230,247,0.72)",
  textMuted: "rgba(222,230,247,0.52)",
  border: "rgba(110,145,255,0.28)",
  inputBg: "#121A2C",
  surfaceSoft: "#121A2C",
  button: "#3F6AE0",
};

function ElevatorLogoMini() {
  return (
    <View style={styles.logoBox}>
      <Text style={styles.logoArrowUp}>△</Text>
      <Text style={styles.logoArrowDown}>▽</Text>
    </View>
  );
}

export default function AuthScreenShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <ElevatorLogoMini />
          <Text style={styles.brandText}>Elevator</Text>
        </View>

        <View style={styles.formWrap}>{children}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AUTH_COLORS.bg,
  },

  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 130,
    paddingBottom: 32,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
      transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],

  },

  logoBox: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
      transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],

  },

  logoArrowUp: {
    position: "absolute",
    top: 0,
    //right: 11,
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 21,
    transform: [{ scaleX: 1.25}, { translateX: 0  }],
  },

  logoArrowDown: {
    position: "absolute",
    bottom: 2,
    //left: 10,
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 21,
    transform: [{ scaleX: 1.25}, { translateX: 0  }],

  },

  brandText: {
    color: AUTH_COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    fontStyle: "italic",
    includeFontPadding: false,
    letterSpacing: -0.6,
  },

  formWrap: {
    marginTop: 150,
  },
});
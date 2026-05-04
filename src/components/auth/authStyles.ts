import { StyleSheet } from "react-native";
import { AUTH_COLORS } from "./AuthScreenShell";

export const authStyles = StyleSheet.create({
  title: {
    color: AUTH_COLORS.text,
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: AUTH_COLORS.textSoft,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 4,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AUTH_COLORS.border,
    backgroundColor: AUTH_COLORS.surfaceSoft,
    color: AUTH_COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
  },
  button: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: AUTH_COLORS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  link: {
    color: AUTH_COLORS.textSoft,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 6,
  },
});
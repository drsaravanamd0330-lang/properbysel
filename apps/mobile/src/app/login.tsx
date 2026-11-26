import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { phoneSchema } from "@pbs/validation";
import { ApiError } from "@pbs/api-client";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Field, s } from "@/components/ui";
import { C } from "@/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(""); const [code, setCode] = useState(""); const [name, setName] = useState("");
  const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);

  async function send() {
    setErr(null);
    const p = phoneSchema.safeParse(phone);
    if (!p.success) return setErr(p.error.issues[0]!.message);
    if (!agree) return setErr("Please accept the terms and privacy policy");
    setBusy(true);
    try { const r = await api.auth.requestOtp(p.data); setPhone(p.data); setStep("code"); setInfo(r.provider.startsWith("development") ? "Development mode: the code is in the API server log. No SMS was sent." : `Code sent to ${p.data}`); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not send code"); } finally { setBusy(false); }
  }
  async function verify() {
    setErr(null); setBusy(true);
    try { const r = await api.auth.verifyOtp(phone, code, name.trim() || undefined); await signIn(r); router.back(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not verify"); } finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Log in or sign up</Text>
        <Text style={[s.muted, { marginBottom: 16 }]}>Use your mobile number. We will send a one-time code.</Text>
        {step === "phone" ? <>
          <Field label="Mobile number" keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} placeholder="98765 43210" error={err ?? undefined} />
          <View style={[s.row, { marginBottom: 12, flexWrap: "nowrap" }]}><Switch value={agree} onValueChange={setAgree} accessibilityLabel="I agree to the terms of use and privacy policy" trackColor={{ true: C.emerald500 }} /><Text style={{ flex: 1 }}>I agree to the terms of use and privacy policy.</Text></View>
          <Button title="Send code" onPress={send} loading={busy} />
        </> : <>
          {info && <Text style={[s.muted, { marginBottom: 12 }]} accessibilityLiveRegion="polite">{info}</Text>}
          <Field label="6-digit code" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ""))} error={err ?? undefined} />
          <Field label="Your name (new accounts)" value={name} onChangeText={setName} autoComplete="name" />
          <Button title="Verify and continue" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button title="Change number" variant="ghost" onPress={() => setStep("phone")} style={{ marginTop: 8 }} />
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

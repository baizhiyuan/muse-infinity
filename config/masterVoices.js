// Per-master MiniMax TTS casting. Every voice_id below was verified against this account's
// live /v1/get_voice system-voice list (332 voices, probed 2026-07-19) — do not invent ids.
// Model: this account has speech-2.8-turbo/2.6-turbo/02-turbo (NOT 2.5-turbo; probed).

export const TTS_MODEL = "speech-2.8-turbo";

export const MASTER_VOICES = {
  socrates: { voiceId: "English_Deep-VoicedGentleman", speed: 0.95 }, // deep, wise, classic British gentleman
  monet: { voiceId: "English_MaturePartner", speed: 0.98 },           // mature, gentle, caring
  van_gogh: { voiceId: "English_PassionateWarrior", speed: 1.08 },    // energetic, passionate, urgent
  picasso: { voiceId: "English_Debator", speed: 1.02 },               // tough, assertive debater
  frida: { voiceId: "English_ConfidentWoman", speed: 1.0 },           // confident and firm
  hilma: { voiceId: "English_Wiselady", speed: 0.97 },                // wise, genial, insightful
  morisot: { voiceId: "English_SereneWoman", speed: 0.97 }            // serene, calm, welcoming
};

/** Unattributed lines (MUSE narration, roundtable synthesis). */
export const NARRATOR_VOICE = { voiceId: "English_expressive_narrator", speed: 1.0 };

export function voiceForSpeaker(speakerId) {
  return MASTER_VOICES[String(speakerId || "").toLowerCase()] || NARRATOR_VOICE;
}

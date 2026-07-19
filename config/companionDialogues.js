// Scripted, per-master dialogue for the gallery artwork popup ("game dialogue").
// Every line is an AI interpretation grounded in each figure's documented themes —
// not an authentic quotation. Templates may reference {title} and {artist}.

export const DIALOGUE_DISCLAIMER =
  "AI INTERPRETATION GROUNDED IN DOCUMENTED THEMES — NOT AN AUTHENTIC QUOTATION";

// The visitor's possible answers. Each feeds the same philosophy axes that the
// salon decision uses, so gallery conversations shape the final world too.
export const artworkChoices = [
  {
    id: "perception",
    label: "It changes how my eyes work. I will see differently when I leave.",
    delta: { perception: 1, emotion: 0, invention: 0 }
  },
  {
    id: "emotion",
    label: "It makes me feel something I don't have words for yet.",
    delta: { perception: 0, emotion: 1, invention: 0 }
  },
  {
    id: "invention",
    label: "It shows me a world that never existed—until someone made it.",
    delta: { perception: 0, emotion: 0, invention: 1 }
  }
];

// Which companions answer a given choice most naturally, in preference order.
export const AXIS_CHAMPIONS = {
  perception: ["monet", "morisot", "hilma"],
  emotion: ["van_gogh", "frida", "morisot"],
  invention: ["picasso", "hilma", "socrates"]
};

export const companionVoices = {
  socrates: {
    opening: "Tell me—when you look at “{title}”, do you see what {artist} made, or only what you were already prepared to find?",
    reactions: {
      perception: "Then be careful: eyes that have been changed can never again pretend they were innocent. Is that a gift, or a responsibility?",
      emotion: "A feeling without words is exactly where thinking should begin—not end. Stay with it a while longer.",
      invention: "So the unreal can instruct the real. Then tell me—which of the two is your teacher now?"
    }
  },
  monet: {
    opening: "Stand closer. “{title}” is not an object—it is a record of light deciding, moment by moment, what to become.",
    reactions: {
      perception: "Yes. Paint one haystack a hundred times and you learn: nothing is ordinary, only unobserved.",
      emotion: "What you feel is the weather of the painting. Let it pass through you the way light passes through mist.",
      invention: "Every new world begins as a new way of seeing this one. The water lilies were always there—I only consented to see them."
    }
  },
  van_gogh: {
    opening: "I cannot look at “{title}” calmly. Every mark insists that being alive is an urgent thing.",
    reactions: {
      perception: "Look until it costs you something. Seeing is not passive—the olive trees taught me that.",
      emotion: "Good. Do not tame it. A feeling with no name is the most honest visitor you will ever receive.",
      invention: "I painted the stars not as they are, but as they insisted on being. Perhaps that is invention—or a deeper honesty."
    }
  },
  picasso: {
    opening: "Ask what “{title}” refused to show you. That refusal is where the painting actually lives.",
    reactions: {
      perception: "Seeing differently is only the beginning. Walk out and find reality itself renegotiable.",
      emotion: "Feel it—then break it open. Sentiment kept whole becomes decoration.",
      invention: "Now you understand. Art is the lie that tells the truth, and the lie must be built with total conviction."
    }
  },
  frida: {
    opening: "“{title}” does not ask for your pity. It asks whether you have ever turned a wound into something that can speak.",
    reactions: {
      perception: "Then look also at what is difficult to look at. I painted my reality—never my dreams.",
      emotion: "Hold that feeling like a live bird. Naming it too quickly would break its wings.",
      invention: "I invented nothing. I translated. Maybe that is what invention truly is: a refusal to stay silent."
    }
  },
  hilma: {
    opening: "Look past the surface of “{title}”. Beneath every appearance there is a structure the painter felt before anyone could see it.",
    reactions: {
      perception: "What you see is a doorway, not a wall. The visible is the smallest part of any painting.",
      emotion: "That wordless feeling is a signal from a structure you cannot yet diagram. One day you will draw it.",
      invention: "The temple was never built, and yet you have just walked through it. Unbuilt worlds still carry weight."
    }
  },
  morisot: {
    opening: "Notice the quiet in “{title}”. The revolution is here—in attention paid to what everyone else walks past.",
    reactions: {
      perception: "Then begin at home. The cradle, the mirror, the open window—no one thought them worth seeing, and they were everything.",
      emotion: "A quiet feeling is not a small one. I spent my life proving that.",
      invention: "New worlds are often made softly—an afternoon, a gaze, a brush held by someone told she should not hold it."
    }
  }
};

const FALLBACK_VOICE = {
  opening: "“{title}” is waiting for your answer, not your admiration.",
  reactions: {
    perception: "Then let it keep changing what you notice.",
    emotion: "Then let the feeling stay unnamed a little longer.",
    invention: "Then carry that impossible world out with you."
  }
};

export function voiceFor(companionId) {
  return companionVoices[companionId] || FALLBACK_VOICE;
}

export function formatLine(template, artwork = {}) {
  return template
    .replaceAll("{title}", artwork.title || "this work")
    .replaceAll("{artist}", artwork.artist || "its maker");
}

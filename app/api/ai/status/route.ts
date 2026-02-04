import { NextResponse } from "next/server";
import { AI_CONFIGS, getAPIKey, AI_FEATURES } from "@/lib/ai/config";

/**
 * GET /api/ai/status
 *
 * Returns AI module status and available features.
 */
export async function GET() {
  const providers = {
    openai: {
      configured: !!getAPIKey("openai"),
      models: ["gpt-4o", "gpt-4o-mini"],
    },
    anthropic: {
      configured: !!getAPIKey("anthropic"),
      models: ["claude-3-opus", "claude-3-sonnet"],
    },
  };

  const features = Object.entries(AI_FEATURES).map(([key, value]) => {
    // Determine which config is needed for each feature
    let configKey: keyof typeof AI_CONFIGS = "fast";
    let implemented = false;
    
    switch (value) {
      case "flight_itinerary_parsing":
        configKey = "vision";
        implemented = true;
        break;
      case "document_parsing":
        configKey = "vision";
        implemented = true;
        break;
      case "email_parsing":
        configKey = "fast";
        implemented = true;
        break;
      case "auto_suggestions":
        configKey = "fast";
        implemented = true;
        break;
      case "translation":
        configKey = "fast";
        implemented = true;
        break;
      case "chat_assistant":
        configKey = "chat";
        implemented = false;
        break;
      default:
        implemented = false;
    }
    
    const config = AI_CONFIGS[configKey];
    const available = !!getAPIKey(config.provider);
    
    return {
      key,
      name: value,
      implemented,
      available: implemented && available,
      provider: config.provider,
      model: config.model,
    };
  });

  return NextResponse.json({
    status: "ok",
    providers,
    features,
    summary: {
      totalFeatures: features.length,
      implemented: features.filter(f => f.implemented).length,
      available: features.filter(f => f.available).length,
    },
  });
}

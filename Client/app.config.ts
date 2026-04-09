import type { ExpoConfig } from "expo/config";

/**
 * Expo / EAS project UUID (expo.dev → Project settings → Project ID).
 * - Run `eas init` from `Client/` — CLI can write this into the project.
 * - Or set `EXPO_PUBLIC_EAS_PROJECT_ID` in Expo → Environment variables for each
 *   build profile (keeps one repo usable across forks without committing the id).
 */
const easProjectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || "YOUR_PROJECT_ID";

const easProjectIdLooksValid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    easProjectId
  );

export default (): ExpoConfig => {
  const base: ExpoConfig = {
    name: "MyTravelConcierge",
    slug: "mytravelconcierge",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "mytravelconcierge",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#1a73e8",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mytravelconcierge.app",
      infoPlist: {
        NSCameraUsageDescription:
          "Allow camera access to scan travel documents",
        NSPhotoLibraryUsageDescription:
          "Allow photo library access to upload documents",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1a73e8",
      },
      package: "com.mytravelconcierge.app",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#1a73e8",
        },
      ],
    ],
    runtimeVersion: {
      policy: "appVersion",
    },
    extra: {
      eas: {
        projectId: easProjectId,
      },
    },
  };

  if (easProjectIdLooksValid) {
    base.updates = {
      url: `https://u.expo.dev/${easProjectId}`,
    };
  }

  return base;
};

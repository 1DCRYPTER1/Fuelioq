export interface BrandStyle {
  name: string;
  logoBg: string; // The background color of the logo box
  textColor: string; // Color for the price numbers
  brandText?: string; // Fallback text if using a text-based logo
  logoColor?: string; // Color of the icon/text
}

export const FUEL_BRANDS: Record<string, BrandStyle> = {
  reddy: {
    name: "Reddy Express",
    logoBg: "#A0E2F1", // Light teal matching your mockup
    textColor: "#E74C3C", // Red price text
  },
  bp: {
    name: "BP",
    logoBg: "#00A859", // BP Green
    textColor: "#FFFFFF",
    brandText: "bp",
    logoColor: "#FFCC00",
  },
  ampol: {
    name: "Ampol",
    logoBg: "#1A365D", // Deep Navy
    textColor: "#E74C3C",
    brandText: "AMPOL",
    logoColor: "#FFFFFF",
  },
  seven_eleven: {
    name: "7-Eleven",
    logoBg: "#008457", // 7-Eleven Dark Green
    textColor: "#2C3E50",
    brandText: "7-E",
    logoColor: "#FF8200",
  },
  united: {
    name: "United",
    logoBg: "#005EA6", // United Blue
    textColor: "#FFFFFF",
    brandText: "United",
    logoColor: "#E61B23",
  },
};

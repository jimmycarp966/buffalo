import {
  DEFAULT_PRINT_BRIDGE_HOST,
  DEFAULT_PRINT_BRIDGE_PORT,
  buildPrintBridgeBaseUrl,
} from "@/lib/printBridgeConfig";

describe("buildPrintBridgeBaseUrl", () => {
  it("uses explicit https host as-is", () => {
    expect(
      buildPrintBridgeBaseUrl({
        enabled: true,
        host: "https://bridge.example/",
        port: DEFAULT_PRINT_BRIDGE_PORT,
      })
    ).toBe("https://bridge.example");
  });

  it("builds http url from raw host and port", () => {
    expect(
      buildPrintBridgeBaseUrl({
        enabled: true,
        host: "10.0.0.5",
        port: DEFAULT_PRINT_BRIDGE_PORT,
      })
    ).toBe(`http://10.0.0.5:${DEFAULT_PRINT_BRIDGE_PORT}`);
  });

  it("uses fallback host when explicit host is empty", () => {
    expect(
      buildPrintBridgeBaseUrl({
        enabled: true,
        host: "",
        fallbackHost: DEFAULT_PRINT_BRIDGE_HOST,
      })
    ).toBe(DEFAULT_PRINT_BRIDGE_HOST);
  });

  it("uses embedded default host when enabled but no host is configured yet", () => {
    expect(
      buildPrintBridgeBaseUrl({
        enabled: true,
        host: "",
      })
    ).toBe(DEFAULT_PRINT_BRIDGE_HOST);
  });

  it("returns null when disabled", () => {
    expect(
      buildPrintBridgeBaseUrl({
        enabled: false,
        host: "10.0.0.5",
        port: DEFAULT_PRINT_BRIDGE_PORT,
      })
    ).toBeNull();
  });
});

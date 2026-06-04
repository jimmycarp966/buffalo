import fs from "fs";
import path from "path";

describe("PWA asset configuration", () => {
  const publicDir = path.join(process.cwd(), "public");
  const manifestPath = path.join(publicDir, "manifest.json");
  const serviceWorkerPath = path.join(publicDir, "sw.js");

  it("references installable icons that exist on disk", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/buffalo-icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/buffalo-icon-512.png",
          sizes: "512x512",
          type: "image/png",
        }),
      ]),
    );

    for (const icon of manifest.icons.filter((entry: { type?: string }) => entry.type === "image/png")) {
      const assetPath = path.join(publicDir, icon.src.replace(/^\//, ""));
      expect(fs.existsSync(assetPath)).toBe(true);
    }
  });

  it("precaches only assets that are present in public/", () => {
    const serviceWorkerSource = fs.readFileSync(serviceWorkerPath, "utf8");
    const match = serviceWorkerSource.match(/const CRITICAL_ASSETS = \[(?<assets>[\s\S]*?)\];/);

    expect(match?.groups?.assets).toBeTruthy();

    const assetEntries = Array.from(
      match?.groups?.assets.matchAll(/"(?<asset>\/[^"]+)"/g) ?? [],
      (entry) => entry.groups?.asset,
    ).filter(Boolean) as string[];

    expect(assetEntries.length).toBeGreaterThan(0);

    for (const asset of assetEntries) {
      const assetPath = path.join(publicDir, asset.replace(/^\//, ""));
      expect(fs.existsSync(assetPath)).toBe(true);
    }
  });
});

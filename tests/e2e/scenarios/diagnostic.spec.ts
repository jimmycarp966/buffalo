import { test, expect } from "@playwright/test";

test("Diagnóstico: Carga de página de login", async ({ page }) => {
  console.log("Iniciando test de diagnóstico...");
  await page.goto("/login");
  console.log("URL actual:", page.url());
  await expect(page).toHaveTitle(/La Movida/i);
  console.log("Test de diagnóstico completado con éxito");
});

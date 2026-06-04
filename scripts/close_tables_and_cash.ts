
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually load .env.local to handle potential UTF-16 encoding (common on Windows PowerShell)
const envPath = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
    try {
        const buffer = fs.readFileSync(envPath);
        // Check for UTF-16LE BOM (0xFF, 0xFE) or just try to detect
        let content = "";
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
            content = buffer.toString("utf16le");
        } else {
            content = buffer.toString("utf8");
            // Fallback: if it looks like garbage (lots of nulls), valid utf16le might not have BOM
            if (content.indexOf("\u0000") !== -1) {
                content = buffer.toString("utf16le");
            }
        }

        // Remove BOM if present in string (sometimes happens)
        if (content.charCodeAt(0) === 0xFEFF) {
            content = content.slice(1);
        }

        console.log("📄 Loaded .env.local, length:", content.length);

        content.split(/\r?\n/).forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^['"](.*)['"]$/, "$1"); // remove quotes
                process.env[key] = value;
            }
        });

    } catch (e) {
        console.error("⚠️ Error reading .env.local:", e);
    }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    console.log("Keys found:", Object.keys(process.env).filter(k => k.includes("SUPABASE")));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function closeTablesAndCash() {
    console.log("🧹 Starting cleanup...");

    try {
        // 1. Cancel all pending sales (Tables, Counter, Delivery)
        console.log("Cancelling pending sales...");
        const { data: salesData, error: salesError } = await supabase
            .from("sales")
            .update({ status: "cancelled", total_amount: 0 })
            .eq("status", "pending")
            .in("sale_type", ["table", "counter", "delivery"])
            .select("id");

        if (salesError) {
            console.error("❌ Error cancelling sales:", salesError.message);
        } else {
            console.log(`✅ Cancelled ${salesData.length} pending sales.`);
        }

        // 2. Close all open cash sessions
        console.log("Closing open cash sessions...");
        const { data: sessionsData, error: sessionsError } = await supabase
            .from("cash_register_sessions")
            .update({
                status: "closed",
                closed_at: new Date().toISOString(),
                closing_notes: "Cierre automático por script de limpieza"
            })
            .eq("status", "open")
            .select("id");

        if (sessionsError) {
            console.error("❌ Error closing cash sessions:", sessionsError.message);
        } else {
            console.log(`✅ Closed ${sessionsData.length} active cash sessions.`);
        }

        console.log("✨ Cleanup finished successfully.");

    } catch (err) {
        console.error("❌ Unexpected error:", err);
    }
}

closeTablesAndCash();

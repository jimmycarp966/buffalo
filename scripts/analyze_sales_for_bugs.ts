
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");

if (fs.existsSync(envPath)) {
    try {
        const buffer = fs.readFileSync(envPath);
        let content = "";
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
            content = buffer.toString("utf16le");
        } else {
            content = buffer.toString("utf8");
            if (content.indexOf("\u0000") !== -1) {
                content = buffer.toString("utf16le");
            }
        }
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

        content.split(/\r?\n/).forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                process.env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, "$1");
            }
        });
    } catch (e) { console.error("⚠️ Error reading .env.local:", e); }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function analyzeForBugs() {
    console.log("🕵️ Analyzing sales for bugs...");

    const twentyFiveMinutesAgo = new Date(Date.now() - 25 * 60 * 1000).toISOString();

    // Fetch recently cancelled sales
    const { data: sales, error } = await supabase
        .from("sales")
        .select(`
      id, created_at, sale_type, table_number, total_amount, status,
      sale_items (count)
    `)
        .eq("status", "cancelled")
        .gte("updated_at", twentyFiveMinutesAgo)
        .order("created_at", { ascending: true }); // Ascending for time diff check

    if (error || !sales) {
        console.error("❌ Error fetching sales:", error);
        return;
    }

    let report = `🪲 Bug Analysis of ${sales.length} Cancelled Sales\n`;
    report += `==========================================\n\n`;

    // 1. Rapid Fire / Duplicate Check
    let rapidFireCount = 0;
    let maxRapidSequence = 0;
    let currentSequence = 0;
    let lastTime = 0;

    report += "⚡ Rapid Fire Creation (Possible UI/Button mashing bugs):\n";
    sales.forEach((s, i) => {
        const time = new Date(s.created_at).getTime();
        if (i > 0) {
            const diff = time - lastTime;
            if (diff < 2000) { // Less than 2 seconds
                rapidFireCount++;
                currentSequence++;
                report += `- ⚠️ Sales created ${diff}ms apart: ${s.created_at} (${s.sale_type})\n`;
            } else {
                if (currentSequence > maxRapidSequence) maxRapidSequence = currentSequence;
                currentSequence = 0;
            }
        }
        lastTime = time;
    });

    // 2. Empty Sales (Zombie Sessions)
    // @ts-ignore
    const emptySales = sales.filter(s => s.total_amount === 0 && s.sale_items[0].count === 0);
    report += `\n🧟 Empty/Zombie Sales (Total 0, No Items): ${emptySales.length}\n`;
    report += `- These indicate sessions started but abandoned without adding items.\n`;
    report += `- If this number is high (${Math.round((emptySales.length / sales.length) * 100)}%), it suggests auto-cleanup is missing.\n`;

    // 3. Table Sales Oddities
    const tableSales = sales.filter(s => s.sale_type === 'table');
    const tablesWithZero = tableSales.filter(s => s.total_amount === 0);

    report += `\n🪑 Table Anomalies:\n`;
    report += `- Total Table Sales Cancelled: ${tableSales.length}\n`;
    report += `- Empty Table Sales (phantom tables): ${tablesWithZero.length}\n`;
    if (tablesWithZero.length > 0) {
        report += `  (These might be tables opened by accident and never used)\n`;
    }

    fs.writeFileSync("bug_analysis_report.txt", report);
    console.log("✅ Analysis written to bug_analysis_report.txt");
}

analyzeForBugs();

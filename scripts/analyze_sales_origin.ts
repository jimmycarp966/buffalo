
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually load .env.local to handle potential UTF-16 encoding
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

async function analyzeSales() {
    console.log("🕵️ Analyzing sales origin...");

    // Look for sales updated in the last 20 minutes (since we validly cancelled them recently)
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: sales, error } = await supabase
        .from("sales")
        .select(`
      id, created_at, sale_type, table_number, total_amount, status,
      user_id,
      user:users!sales_user_id_fkey(name, email)
    `)
        .eq("status", "cancelled")
        .gte("updated_at", twentyMinutesAgo)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("❌ Error fetching sales:", error);
        return;
    }

    if (!sales || sales.length === 0) {
        console.log("No recently cancelled sales found to analyze.");
        return;
    }

    let report = `📊 Analysis of ${sales.length} Cancelled Sales\n`;
    report += `==========================================\n\n`;

    // 1. By User
    const byUser: Record<string, number> = {};
    sales.forEach(s => {
        // @ts-ignore
        const name = s.user?.name || s.user?.email || "Unknown";
        byUser[name] = (byUser[name] || 0) + 1;
    });
    report += "👤 Sales by User:\n";
    Object.entries(byUser).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
        report += `- ${name}: ${count}\n`;
    });

    // 2. By Type
    const byType: Record<string, number> = {};
    sales.forEach(s => {
        byType[s.sale_type] = (byType[s.sale_type] || 0) + 1;
    });
    report += "\n🏷️ Sales by Type:\n";
    Object.entries(byType).forEach(([type, count]) => {
        report += `- ${type}: ${count}\n`;
    });

    // 3. By Date (Day)
    const byDate: Record<string, number> = {};
    sales.forEach(s => {
        const day = new Date(s.created_at).toISOString().split('T')[0];
        byDate[day] = (byDate[day] || 0) + 1;
    });
    report += "\n📅 Top Creation Dates:\n";
    Object.entries(byDate).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([date, count]) => {
        report += `- ${date}: ${count}\n`;
    });

    // 4. Samples
    report += "\n📝 Sample of 3 Oldest Sales:\n";
    sales.slice(-3).forEach(s => {
        // @ts-ignore
        report += `- ${new Date(s.created_at).toLocaleString()}: Type=${s.sale_type}, Table=${s.table_number}, User=${s.user?.name || 'Unk'}, Amount=${s.total_amount}\n`;
    });

    report += "\n📝 Sample of 3 Newest Sales:\n";
    sales.slice(0, 3).forEach(s => {
        // @ts-ignore
        report += `- ${new Date(s.created_at).toLocaleString()}: Type=${s.sale_type}, Table=${s.table_number}, User=${s.user?.name || 'Unk'}, Amount=${s.total_amount}\n`;
    });

    fs.writeFileSync("analysis_report.txt", report);
    console.log("✅ Analysis written to analysis_report.txt");
}

analyzeSales();

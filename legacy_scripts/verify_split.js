const fs = require('fs');
const pdf = require('pdf-parse');

const files = [
    "c:\\Users\\pykar\\Desktop\\WORKFLOW_SUNDER_VERCEL\\Flat no1 - editable_filename.pdf",
    "c:\\Users\\pykar\\Desktop\\WORKFLOW_SUNDER_VERCEL\\Flat no2 - editable_filename.pdf",
    "c:\\Users\\pykar\\Desktop\\WORKFLOW_SUNDER_VERCEL\\Flat no3 - editable_filename.pdf"
];

async function checkFiles() {
    for (const file of files) {
        if (!fs.existsSync(file)) {
            console.log(`❌ File not found: ${file}`);
            continue;
        }

        try {
            const dataBuffer = fs.readFileSync(file);
            const data = await pdf(dataBuffer);
            const text = data.text;

            console.log(`\n--- Inspecting: ${file.split('\\').pop()} ---`);

            // Extract Name
            const nameMatch = text.match(/Name\s*[:\-]\s*(.*?)(?=\s*(?:Flat No|Bill No|\n|\r))/i);
            const name = nameMatch ? nameMatch[1].trim() : "NOT FOUND";

            // Extract Flat No (Pattern: Flat No. - 01 OR Flat No. 01)
            // The regex in the large text dump showed "Flat No. - 01" at the end of the previous block or "Flat No. 01" inside the header
            const flatMatch = text.match(/Flat No\.?[\s-]*([0-9]+)/i);
            // Note: The extracted text had "Flat No. - 01"

            const flatNo = flatMatch ? flatMatch[1] : "NOT FOUND";

            console.log(`   ✅ Name: ${name}`);
            console.log(`   ✅ Flat No Pattern: ${flatMatch ? flatMatch[0] : 'N/A'}`);

            // Check for specific residents to be sure
            if (file.includes("Flat no1") && name.includes("Contractor")) console.log("   MATCH: Correct Name for Flat 1");
            if (file.includes("Flat no2") && name.includes("Harekrishnan")) console.log("   MATCH: Correct Name for Flat 2");
            if (file.includes("Flat no3") && name.includes("Karthikeyan")) console.log("   MATCH: Correct Name for Flat 3");

        } catch (e) {
            console.error(`Error processing ${file}:`, e.message);
        }
    }
}

checkFiles();

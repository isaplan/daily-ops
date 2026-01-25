const fs = require('fs');
const Papa = require('papaparse');

function parseCSVManually(content) {
  const lines = content.trim().split('\n');
  const header = lines[0]
    .split(',')
    .map(h => h.trim().replace(/^▲\s*/, '').replace(/"/g, ''));
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    const record = {};
    header.forEach((key, idx) => {
      record[key] = values[idx] || null;
    });
    records.push(record);
  }
  return records;
}

function parseEuro(str) {
  if (!str) return null;
  const match = str?.toString().match(/[\d,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', '.'));
}

const v1Content = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv', 'utf-8');
const v2Content = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract-v2.csv', 'utf-8');

const v1Data = parseCSVManually(v1Content);
const v2Data = parseCSVManually(v2Content);

console.log('📊 Comparing contract CSV versions\n');
console.log(`V1: ${v1Data.length} records`);
console.log(`V2: ${v2Data.length} records\n`);

// Check headers
console.log('V1 headers:');
if (v1Data[0]) console.log(Object.keys(v1Data[0]).slice(0, 10).join(', '));

console.log('\nV2 headers:');
if (v2Data[0]) console.log(Object.keys(v2Data[0]).slice(0, 20).join(', '));

// Compare some values
console.log('\n📋 Sample records comparison:\n');
['Alvinio Molina', 'André Rozhok', 'Casper Schul', 'Afwas Van Kinsbergen'].forEach(name => {
  const v1 = v1Data.find(r => r['naam'] === name);
  const v2 = v2Data.find(r => r['naam'] === name);
  
  console.log(`${name}:`);
  console.log(`  V1: €${parseEuro(v1?.['uurloon'])} | ${v1?.['contracttype']}`);
  console.log(`  V2: €${parseEuro(v2?.['uurloon'])} | ${v2?.['contracttype']}`);
  if (v2?.['voornaam']) {
    console.log(`      Email: ${v2?.['e-mailadres']} | Name: ${v2?.['voornaam']} ${v2?.['achternaam']}`);
  }
  console.log();
});


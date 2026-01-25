const fs = require('fs');
const Papa = require('papaparse');

const contractContent = fs.readFileSync('/Users/alviniomolina/Documents/GitHub/daily-ops/data-sources/eitje-werknemer-contract.csv', 'utf-8');
const contractData = Papa.parse(contractContent, { header: true, skipEmptyLines: true }).data;

console.log('First 5 contract records:');
contractData.slice(0, 5).forEach((r, i) => {
  console.log(`${i}: naam="${r['naam']}" | supportID="${r['support ID']}"`);
});

console.log(`\nTotal records: ${contractData.length}`);
console.log(`Records with naam: ${contractData.filter(r => r['naam']).length}`);
console.log(`Records with support ID: ${contractData.filter(r => r['support ID']).length}`);

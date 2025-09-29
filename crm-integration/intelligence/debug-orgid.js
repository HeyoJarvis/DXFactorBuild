const CompanyIntelligenceBridge = require('./company-intelligence-bridge');

const bridge = new CompanyIntelligenceBridge();
const url = 'https://dxfactor.com';
const orgId = bridge.getOrganizationId(url);

console.log('URL:', url);
console.log('Generated Org ID:', orgId);
console.log('Expected filename pattern:', `${orgId}_intelligence_*.json`);

// Check what files exist
const fs = require('fs').promises;
const path = require('path');

async function checkFiles() {
    try {
        const pythonPath = path.join(__dirname, '../../company-intelligence-py');
        const files = await fs.readdir(pythonPath);
        
        console.log('\nFiles in Python directory:');
        files.filter(f => f.includes('dxfactor')).forEach(f => console.log('  ', f));
        
        console.log('\nMatching files:');
        const matches = files.filter(file => file.startsWith(`${orgId}_intelligence_`) && file.endsWith('.json'));
        matches.forEach(f => console.log('  ', f));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkFiles();


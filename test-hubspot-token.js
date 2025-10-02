/**
 * Quick test script to validate HubSpot token
 */

require('dotenv').config();
const https = require('https');

const token = process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_API_KEY;

console.log('🔍 Testing HubSpot Token...\n');
console.log('Token found:', token ? `Yes (${token.substring(0, 15)}...)` : 'NO TOKEN FOUND!');
console.log('Token length:', token ? token.length : 0);
console.log('Token format:', token ? token.substring(0, 7) : 'N/A');
console.log('\n📡 Making test API call to HubSpot...\n');

const options = {
  hostname: 'api.hubapi.com',
  path: '/crm/v3/objects/contacts?limit=1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📄 Response Body:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (res.statusCode === 200) {
        console.log('\n✅ SUCCESS! Token is valid and working!');
      } else if (res.statusCode === 401) {
        console.log('\n❌ FAILED: Token is invalid or expired');
        console.log('   Reason:', parsed.message || 'Unknown');
        console.log('\n🔧 Next steps:');
        console.log('   1. Go to https://app.hubspot.com/private-apps');
        console.log('   2. Create a new Private App or regenerate token');
        console.log('   3. Grant these scopes:');
        console.log('      - crm.objects.deals.read');
        console.log('      - crm.objects.contacts.read');
        console.log('      - crm.objects.companies.read');
        console.log('   4. Copy the new token to .env file');
      } else if (res.statusCode === 403) {
        console.log('\n⚠️  Token is valid but missing required scopes');
        console.log('   Add these scopes in HubSpot Private Apps settings');
      } else {
        console.log('\n⚠️  Unexpected response');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.end();


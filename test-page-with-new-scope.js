require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWithPageScope() {
  const { data: users } = await supabase
    .from('users')
    .select('integration_settings')
    .limit(10);

  const jiraUser = users?.find(u => u.integration_settings?.jira?.access_token);
  if (!jiraUser) {
    console.log('No JIRA user found');
    return;
  }

  const token = jiraUser.integration_settings.jira.access_token;
  const cloudId = jiraUser.integration_settings.jira.cloud_id;

  console.log('🔍 Checking current token scopes...\n');

  // Decode token to see scopes
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const scopes = payload.scope.split(' ').sort();

  console.log('📋 Current scopes in token:');
  scopes.forEach(s => console.log('  -', s));

  const hasPageScope = scopes.includes('read:page:confluence');
  const hasBlogScope = scopes.includes('read:blogpost:confluence');

  console.log('\n✅ Has read:page:confluence?', hasPageScope ? 'YES' : 'NO');
  console.log('✅ Has read:blogpost:confluence?', hasBlogScope ? 'YES' : 'NO');

  if (!hasPageScope) {
    console.log('\n❌ Token does NOT have read:page:confluence scope!');
    console.log('   You need to disconnect and reconnect JIRA to get new scopes.');
    return;
  }

  console.log('\n\n🎯 Testing page access with read:page:confluence scope...\n');

  // Test 1: List spaces (should work)
  console.log('1️⃣ Testing Confluence spaces API...');
  try {
    const spacesRes = await fetch(`https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2/spaces?limit=3`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (spacesRes.ok) {
      const spacesData = await spacesRes.json();
      console.log(`✅ Spaces API works! Found ${spacesData.results?.length || 0} spaces`);

      // Test getting pages from first space
      if (spacesData.results && spacesData.results.length > 0) {
        const space = spacesData.results[0];
        console.log(`\n2️⃣ Testing pages in space "${space.name}"...`);

        const pagesRes = await fetch(`https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2/spaces/${space.id}/pages?limit=3`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          console.log(`✅ Pages API works! Found ${pagesData.results?.length || 0} pages`);

          // Test fetching a specific page
          if (pagesData.results && pagesData.results.length > 0) {
            const page = pagesData.results[0];
            console.log(`\n3️⃣ Testing fetch of page "${page.title}" (ID: ${page.id})...`);

            const pageRes = await fetch(`https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2/pages/${page.id}?body-format=storage`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (pageRes.ok) {
              const pageData = await pageRes.json();
              console.log(`✅ SUCCESS! Page fetch works!`);
              console.log(`   Title: ${pageData.title}`);
              console.log(`   Has content: ${!!pageData.body?.storage?.value}`);
              console.log(`   Content length: ${pageData.body?.storage?.value?.length || 0} chars`);
            } else {
              const error = await pageRes.text();
              console.log(`❌ Page fetch failed: ${pageRes.status}`);
              console.log(`   Error: ${error}`);
            }
          }
        } else {
          const error = await pagesRes.text();
          console.log(`❌ Pages API failed: ${pagesRes.status}`);
          console.log(`   Error: ${error}`);
        }
      }
    } else {
      const error = await spacesRes.text();
      console.log(`❌ Spaces API failed: ${spacesRes.status}`);
      console.log(`   Error: ${error}`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }

  console.log('\n\n4️⃣ Testing the problematic page (6520834)...');
  try {
    const pageRes = await fetch(`https://api.atlassian.com/ex/confluence/${cloudId}/wiki/api/v2/pages/6520834?body-format=storage`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (pageRes.ok) {
      const pageData = await pageRes.json();
      console.log(`✅ SUCCESS! Can now fetch page 6520834!`);
      console.log(`   Title: ${pageData.title}`);
      console.log(`   Has content: ${!!pageData.body?.storage?.value}`);
      console.log(`   Content length: ${pageData.body?.storage?.value?.length || 0} chars`);
    } else {
      const error = await pageRes.text();
      console.log(`❌ Still fails: ${pageRes.status}`);
      console.log(`   Error: ${error}`);
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

testWithPageScope().catch(console.error);

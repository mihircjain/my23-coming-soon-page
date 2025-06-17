// scripts/recover-calories.js - Run with Vercel CLI
// Usage: vercel env pull .env.local && node scripts/recover-calories.js

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();

async function recoverCalories() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--dry');
  const maxActivities = parseInt(args.find(arg => arg.startsWith('--max='))?.split('=')[1]) || 30;
  const userId = 'mihir_jain';

  console.log(`🔥 Calorie Recovery Script`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}${dryRun ? ' (no changes will be made)' : ''}`);
  console.log(`   Max activities: ${maxActivities}`);
  console.log(`   User: ${userId}`);
  console.log('');

  try {
    // Find activities with 0 calories
    console.log('🔍 Finding activities with 0 calories...');
    const snapshot = await db
      .collection('strava_data')
      .where('userId', '==', userId)
      .where('calories', '==', 0)
      .orderBy('start_date', 'desc')
      .limit(maxActivities * 2)
      .get();

    if (snapshot.empty) {
      console.log('✅ No activities found with 0 calories');
      process.exit(0);
    }

    // Prioritize runs and recent activities
    let activities = snapshot.docs.map(doc => ({
      docRef: doc.ref,
      data: doc.data()
    }));

    activities.sort((a, b) => {
      const aIsRun = a.data.type?.toLowerCase().includes('run') ? 1 : 0;
      const bIsRun = b.data.type?.toLowerCase().includes('run') ? 1 : 0;
      
      if (aIsRun !== bIsRun) return bIsRun - aIsRun;
      return new Date(b.data.start_date) - new Date(a.data.start_date);
    });

    activities = activities.slice(0, maxActivities);

    console.log(`📊 Found ${activities.length} activities to check`);
    console.log(`   Runs: ${activities.filter(a => a.data.type?.toLowerCase().includes('run')).length}`);
    console.log(`   Other: ${activities.filter(a => !a.data.type?.toLowerCase().includes('run')).length}`);
    console.log('');

    // Get Strava token
    console.log('🔑 Getting Strava access token...');
    const tokenResp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.VITE_STRAVA_CLIENT_ID,
        client_secret: process.env.VITE_STRAVA_CLIENT_SECRET,
        refresh_token: process.env.VITE_STRAVA_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResp.ok) {
      throw new Error(`Token refresh failed: ${tokenResp.status}`);
    }

    const { access_token: accessToken } = await tokenResp.json();
    console.log('✅ Token obtained');
    console.log('');

    // Process activities
    let recoveredCount = 0;
    let skippedCount = 0;
    let apiCallsUsed = 1;
    const recoveredActivities = [];

    console.log(`🔄 ${dryRun ? 'Testing' : 'Recovering'} calorie data...`);
    console.log('─'.repeat(80));

    for (let i = 0; i < activities.length; i++) {
      const { docRef, data } = activities[i];
      const activityId = data.id;
      
      // Rate limit check
      if (apiCallsUsed >= 90) {
        console.log(`⚠️  Rate limit protection: stopping at ${apiCallsUsed} API calls`);
        break;
      }

      process.stdout.write(`[${i+1}/${activities.length}] ${data.type}: ${data.name.substring(0, 30)}...`);

      try {
        // Fetch from Strava
        const detailResp = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        
        apiCallsUsed++;

        if (!detailResp.ok) {
          console.log(` ❌ Failed (${detailResp.status})`);
          skippedCount++;
          continue;
        }

        const detailData = await detailResp.json();

        if (detailData.calories && detailData.calories > 0) {
          console.log(` 🔥 ${detailData.calories} calories`);
          
          if (!dryRun) {
            await docRef.update({
              calories: detailData.calories,
              calories_recovered: true,
              calories_recovery_date: new Date().toISOString(),
              calories_recovery_source: 'cli_script'
            });
          }

          recoveredActivities.push({
            name: data.name,
            type: data.type,
            calories: detailData.calories,
            date: data.start_date.split('T')[0]
          });
          
          recoveredCount++;
        } else {
          console.log(` ❌ No calories`);
          skippedCount++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(` ❌ Error: ${error.message}`);
        skippedCount++;
      }
    }

    console.log('─'.repeat(80));
    console.log('');
    console.log(`✅ ${dryRun ? 'Test' : 'Recovery'} complete:`);
    console.log(`   ${dryRun ? 'Recoverable' : 'Recovered'}: ${recoveredCount} activities`);
    console.log(`   Skipped: ${skippedCount} activities`);
    console.log(`   API calls used: ${apiCallsUsed}/600 (${Math.round(apiCallsUsed/600*100)}%)`);
    
    if (recoveredCount > 0) {
      console.log('');
      console.log(`📋 ${dryRun ? 'Recoverable' : 'Recovered'} activities:`);
      recoveredActivities.forEach(activity => {
        console.log(`   ${activity.date} | ${activity.type.padEnd(12)} | ${activity.calories.toString().padStart(3)} cal | ${activity.name}`);
      });
    }

    if (dryRun && recoveredCount > 0) {
      console.log('');
      console.log('🚀 To actually recover the data, run:');
      console.log('   node scripts/recover-calories.js --live');
    }

  } catch (error) {
    console.error('❌ Recovery failed:', error);
    process.exit(1);
  }
}

// Run the script
recoverCalories().then(() => {
  console.log('');
  console.log('✨ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});

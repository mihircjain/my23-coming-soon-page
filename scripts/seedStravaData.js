// Script to seed Firebase strava_data collection with 30 days of mock data
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Generate mock strava data for the last 30 days
async function seedStravaData() {
  try {
    console.log("Starting to seed strava_data collection...");
    
    const stravaCollection = collection(db, "strava_data");
    const today = new Date();
    const mockActivities = [];
    
    // Generate data for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Skip some days randomly to simulate rest days
      if (Math.random() > 0.7 && i > 0) {
        console.log(`Skipping ${dateString} as a rest day`);
        continue;
      }
      
      // Randomize activity type
      const activityTypes = ["run", "ride", "swim", "weight_training"];
      const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      
      // Generate random but realistic values
      const duration = Math.floor(Math.random() * 60) + 20; // 20-80 minutes
      const caloriesBurned = Math.floor(Math.random() * 400) + 200; // 200-600 calories
      const avgHR = Math.floor(Math.random() * 40) + 120; // 120-160 bpm
      
      // Create activity document
      const activityData = {
        userId: "mihir_jain",
        date: dateString,
        activityType,
        duration,
        caloriesBurned,
        avgHR
      };
      
      mockActivities.push(activityData);
      console.log(`Generated mock activity for ${dateString}: ${activityType}, ${duration} minutes`);
    }
    
    // Add all activities to Firestore
    for (const activity of mockActivities) {
      await addDoc(stravaCollection, activity);
      console.log(`Added activity for ${activity.date} to Firestore`);
    }
    
    console.log(`Successfully seeded ${mockActivities.length} strava activities`);
    
  } catch (error) {
    console.error("Error seeding strava_data:", error);
  }
}

// Execute the seeding function
seedStravaData()
  .then(() => console.log("Strava data seeding complete"))
  .catch(error => console.error("Seeding failed:", error));

// Script to extract and seed Firebase strava_data collection with real data from ActivityJam
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc } from "firebase/firestore";
import fetch from "node-fetch";
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

// Function to fetch Strava data from our API and seed it to Firebase
async function extractAndSeedStravaData() {
  try {
    console.log("Starting to extract and seed strava_data collection...");
    
    // Fetch real Strava data from our API
    const response = await fetch('http://localhost:5001/api/strava?days=30');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Strava data: ${response.status} ${response.statusText}`);
    }
    
    const activitiesData = await response.json();
    console.log(`Fetched ${activitiesData.length} activities from Strava API`);
    
    // Process the activities into the format needed for Firebase
    const processedActivities = activitiesData.map(activity => ({
      userId: "mihir_jain",
      date: new Date(activity.start_date).toISOString().split('T')[0], // YYYY-MM-DD format
      activityType: activity.type.toLowerCase(),
      duration: Math.round(activity.moving_time / 60), // Convert seconds to minutes
      caloriesBurned: activity.calories || Math.round(activity.moving_time / 60 * 7), // Include calories, estimate if not available
      avgHR: activity.has_heartrate ? Math.round(activity.average_heartrate) : null,
      distance: Math.round(activity.distance / 10) / 100, // Convert meters to kilometers with 2 decimal places
      elevationGain: Math.round(activity.total_elevation_gain),
      name: activity.name
    }));
    
    // Clear existing data first to avoid duplicates
    const stravaCollection = collection(db, "strava_data");
    const existingQuery = query(stravaCollection, where("userId", "==", "mihir_jain"));
    const existingDocs = await getDocs(existingQuery);
    
    console.log(`Found ${existingDocs.size} existing documents to remove`);
    
    // Delete existing documents
    const deletePromises = [];
    existingDocs.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });
    
    await Promise.all(deletePromises);
    console.log("Cleared existing strava_data documents");
    
    // Add all activities to Firestore
    const addPromises = [];
    for (const activity of processedActivities) {
      addPromises.push(addDoc(stravaCollection, activity));
    }
    
    await Promise.all(addPromises);
    console.log(`Successfully seeded ${processedActivities.length} strava activities to Firebase`);
    
  } catch (error) {
    console.error("Error seeding strava_data:", error);
  }
}

// Execute the seeding function
extractAndSeedStravaData()
  .then(() => console.log("Strava data extraction and seeding complete"))
  .catch(error => console.error("Seeding failed:", error));

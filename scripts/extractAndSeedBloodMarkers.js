// Script to extract and seed Firebase blood_markers collection with real data from BodyJam
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc } from "firebase/firestore";
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

// Function to seed blood markers data from BodyJam to Firebase
async function extractAndSeedBloodMarkers() {
  try {
    console.log("Starting to extract and seed blood_markers collection...");
    
    // Blood marker data from BodyJam component
    const bloodMarkerData = {
      // Heart-related markers
      ldl: 96,
      hdl: 38,
      triglycerides: 50,
      total_cholesterol: 144,
      
      // Kidney-related markers
      creatinine: 0.7,
      bun: 14, // Estimated value, not directly in BodyJam
      egfr: 92, // Estimated value, not directly in BodyJam
      
      // Additional markers for completeness
      glucose: 89,
      hba1c: 5.1,
      vitamin_d: 48.2,
      vitamin_b12: 405,
      tsh: 2.504,
      uric_acid: 4.4,
      calcium: 9.3,
      sodium: 134,
      potassium: 4.8,
      
      // Metadata
      test_date: "2025-05-10",
      userId: "mihir_jain"
    };
    
    // Check if document already exists
    const bloodMarkersRef = doc(db, "blood_markers", "mihir_jain");
    const docSnap = await getDoc(bloodMarkersRef);
    
    if (docSnap.exists()) {
      console.log("Blood markers document already exists, updating...");
    } else {
      console.log("Creating new blood markers document...");
    }
    
    // Set the document with the blood marker data
    await setDoc(bloodMarkersRef, bloodMarkerData);
    
    console.log("Successfully seeded blood markers data to Firebase");
    
  } catch (error) {
    console.error("Error seeding blood_markers:", error);
  }
}

// Execute the seeding function
extractAndSeedBloodMarkers()
  .then(() => console.log("Blood markers extraction and seeding complete"))
  .catch(error => console.error("Seeding failed:", error));

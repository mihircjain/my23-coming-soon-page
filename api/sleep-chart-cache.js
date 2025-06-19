// /api/sleep-chart-cache.js - Simple cache endpoint like your existing chart-cache.js
import { db } from '../src/lib/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default async function handler(req, res) {
  const { userId = 'mihir_jain' } = req.query;
  
  if (req.method === 'GET') {
    try {
      const docRef = doc(db, 'sleep_chart_cache', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const cachedData = docSnap.data();
        const age = Math.round((Date.now() - new Date(cachedData.generatedAt).getTime()) / 1000 / 60);
        
        res.status(200).json({
          ...cachedData.chartData,
          age: `${age} minutes ago`
        });
      } else {
        res.status(404).json({ message: 'No cached chart data' });
      }
    } catch (error) {
      console.error('❌ Error fetching cached chart data:', error);
      res.status(500).json({ message: 'Error fetching cached charts' });
    }
  }
  
  if (req.method === 'POST') {
    try {
      const { chartData, generatedAt } = req.body;
      const docRef = doc(db, 'sleep_chart_cache', userId);
      
      await setDoc(docRef, {
        chartData,
        generatedAt,
        userId,
        updatedAt: new Date().toISOString()
      });
      
      console.log('✅ Sleep chart data cached successfully');
      res.status(200).json({ message: 'Chart data cached successfully' });
    } catch (error) {
      console.error('❌ Error caching chart data:', error);
      res.status(500).json({ message: 'Error caching chart data' });
    }
  }
}

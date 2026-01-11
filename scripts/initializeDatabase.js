// File: scripts/initializeDatabase.js
// Run this file ONCE to set up your Firestore database structure

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBdgeKonHOCgXL9W0qhXgFHLB6Y8nuaW2E",
  authDomain: "smartparkingsystem-dd7ce.firebaseapp.com",
  projectId: "smartparkingsystem-dd7ce",
  storageBucket: "smartparkingsystem-dd7ce.firebasestorage.app",
  messagingSenderId: "880528409042",
  appId: "1:880528409042:web:56746ecd9c5cbf5149480b",
  measurementId: "G-TJY3KVBV1Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeDatabase() {
  console.log('🚀 Starting database initialization...\n');

  try {
    // 1. Create Parking Lots
    console.log('📍 Creating parking lots...');
    
    const demoLot = {
      lotId: 'demo',
      name: 'Demo Parking',
      location: {
        address: 'Demo Location',
        city: 'Johor Bahru',
        state: 'Johor',
        country: 'Malaysia'
      },
      totalSpots: 4,
      availableSpots: 2,
      managerId: 'admin',
      isActive: true,
      operatingHours: {
        open: '00:00',
        close: '23:59',
        timezone: 'Asia/Kuala_Lumpur'
      },
      pricing: {
        hourlyRate: 2.00,
        currency: 'MYR'
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const uthmLot = {
      lotId: 'uthm',
      name: 'UTHM FKEE Parking',
      location: {
        address: 'Fakulti Kejuruteraan Elektrik dan Elektronik',
        city: 'Parit Raja',
        state: 'Johor',
        country: 'Malaysia'
      },
      totalSpots: 8,
      availableSpots: 5,
      managerId: 'admin',
      isActive: true,
      operatingHours: {
        open: '07:00',
        close: '22:00',
        timezone: 'Asia/Kuala_Lumpur'
      },
      pricing: {
        hourlyRate: 2.00,
        currency: 'MYR'
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'parkingLots', 'demo'), demoLot);
    await setDoc(doc(db, 'parkingLots', 'uthm'), uthmLot);
    console.log('✅ Parking lots created\n');

    // 2. Create Parking Spots for Demo
    console.log('🅿️  Creating parking spots for Demo...');
    
    const demoSpots = [
      { spotNumber: 'A1', status: 'occupied', rowId: 'A' },
      { spotNumber: 'A2', status: 'available', rowId: 'A' },
      { spotNumber: 'A3', status: 'available', rowId: 'A' },
      { spotNumber: 'A4', status: 'occupied', rowId: 'A' },
    ];

    for (const spot of demoSpots) {
      const spotData = {
        spotId: `demo_${spot.spotNumber}`,
        lotId: 'demo',
        spotNumber: spot.spotNumber,
        rowId: spot.rowId,
        status: spot.status,
        lastUpdated: serverTimestamp(),
        esp32CamId: null,
        coordinates: { x: 0, y: 0 }
      };
      await setDoc(doc(db, 'parkingSpots', spotData.spotId), spotData);
    }
    console.log('✅ Demo parking spots created\n');

    // 3. Create Parking Spots for UTHM
    console.log('🅿️  Creating parking spots for UTHM...');
    
    const uthmSpots = [
      { spotNumber: 'A1', status: 'occupied', rowId: 'A' },
      { spotNumber: 'A2', status: 'available', rowId: 'A' },
      { spotNumber: 'A3', status: 'available', rowId: 'A' },
      { spotNumber: 'A4', status: 'occupied', rowId: 'A' },
      { spotNumber: 'B1', status: 'available', rowId: 'B' },
      { spotNumber: 'B2', status: 'available', rowId: 'B' },
      { spotNumber: 'B3', status: 'disabled', rowId: 'B' },
      { spotNumber: 'B4', status: 'available', rowId: 'B' },
    ];

    for (const spot of uthmSpots) {
      const spotData = {
        spotId: `uthm_${spot.spotNumber}`,
        lotId: 'uthm',
        spotNumber: spot.spotNumber,
        rowId: spot.rowId,
        status: spot.status,
        lastUpdated: serverTimestamp(),
        esp32CamId: null,
        coordinates: { x: 0, y: 0 }
      };
      await setDoc(doc(db, 'parkingSpots', spotData.spotId), spotData);
    }
    console.log('✅ UTHM parking spots created\n');

    // 4. Create System Configuration
    console.log('⚙️  Creating system configuration...');
    
    const systemConfig = {
      version: '1.0.0',
      maintenanceMode: false,
      features: {
        anprEnabled: true,
        walletEnabled: true,
        notificationsEnabled: true
      },
      pricing: {
        defaultHourlyRate: 2.00,
        currency: 'MYR'
      },
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'system', 'config'), systemConfig);
    console.log('✅ System configuration created\n');

    console.log('🎉 Database initialization completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   - 2 Parking Lots created (Demo, UTHM)');
    console.log('   - 12 Parking Spots created (4 Demo + 8 UTHM)');
    console.log('   - System configuration set');
    console.log('\n✨ Your database is ready to use!');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Run the initialization
initializeDatabase();
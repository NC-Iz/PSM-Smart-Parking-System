// File: scripts/createSpots.js — replace existing content with this

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBdgeKonHOCgXL9W0qhXgFHLB6Y8nuaW2E",
  authDomain: "smartparkingsystem-dd7ce.firebaseapp.com",
  projectId: "smartparkingsystem-dd7ce",
  storageBucket: "smartparkingsystem-dd7ce.firebasestorage.app",
  messagingSenderId: "880528409042",
  appId: "1:880528409042:web:56746ecd9c5cbf5149480b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateSpots() {
  // Delete old B-row documents
  const toDelete = ['demo_B1','demo_B2','demo_B3','demo_B4',
                    'demo_A5','demo_A6','demo_A7','demo_A8'];
  for (const id of toDelete) {
    await deleteDoc(doc(db, 'parkingSpots', id));
    console.log(`🗑️  Deleted ${id}`);
  }

  // Create A1-A6
  const spots = [
    { id: 'demo_A1', spotNumber: 'A1', esp32CamId: 'CAM_VISION_002' },
    { id: 'demo_A2', spotNumber: 'A2', esp32CamId: 'CAM_VISION_002' },
    { id: 'demo_A3', spotNumber: 'A3', esp32CamId: 'CAM_VISION_002' },
    { id: 'demo_A4', spotNumber: 'A4', esp32CamId: 'CAM_VISION_001' },
    { id: 'demo_A5', spotNumber: 'A5', esp32CamId: 'CAM_VISION_001' },
    { id: 'demo_A6', spotNumber: 'A6', esp32CamId: 'CAM_VISION_001' },
  ];

  for (const spot of spots) {
    await setDoc(doc(db, 'parkingSpots', spot.id), {
      spotId:              spot.id,
      spotNumber:          spot.spotNumber,
      status:              'available',
      lotId:               'demo',
      rowId:               'A',
      esp32CamId:          spot.esp32CamId,
      licencePlate:        null,
      plateNumber:         null,
      plateConfidence:     0,
      plateValidated:      false,
      detectionConfidence: 0,
      vehicleType:         null,
      overlapScore:        0,
      coordinates:         { x: 0, y: 0 },
    });
    console.log(`✓ Created ${spot.id} (${spot.spotNumber})`);
  }

  console.log('\n✅ Done! Firestore now has demo_A1 to demo_A6');
  process.exit(0);
}

updateSpots();
import admin from "firebase-admin";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    try {
      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
        console.log("Firebase Admin initialized with credentials");
      } else {
        admin.initializeApp();
        console.log("Firebase Admin initialized with defaults");
      }
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
  return admin;
}

export { getFirebaseAdmin };
export default getFirebaseAdmin;

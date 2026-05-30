/**
 * INNOBAND — Firebase Integration Service
 * File: firebase-db.js
 * Desc: Handles Firebase authentication and Firestore database operations.
 *       Exposes global helper functions on the window object.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    query, 
    where,
    orderBy,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCpixaAIERCtsdxubKqT9-N_hV_WC5_ImI",
  authDomain: "innoband-7c9dd.firebaseapp.com",
  projectId: "innoband-7c9dd",
  storageBucket: "innoband-7c9dd.firebasestorage.app",
  messagingSenderId: "935675745165",
  appId: "1:935675745165:web:b65b93e030465f3c90a3c4",
  measurementId: "G-DEEYVPX04B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Expose Firebase objects globally for debugging if needed
window.firebaseAuth = auth;
window.firebaseDb = db;

/**
 * Register a new user in Firebase Auth and save extra info to Firestore
 */
window.dbRegister = async function(email, password, name, phone, type) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save additional user info in a 'users' collection in Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            phone: phone,
            type: type,
            createdAt: new Date().toISOString()
        });
        
        return {
            uid: user.uid,
            name: name,
            email: email,
            phone: phone,
            type: type
        };
    } catch (error) {
        console.error("Registration Error:", error);
        throw error;
    }
};

/**
 * Login user with Email and Password
 */
window.dbLogin = async function(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Fetch additional user info from Firestore
        const userDoc = await getDocs(query(collection(db, "users"), where("email", "==", email)));
        let userData = { email: email, name: email.split('@')[0], phone: "", type: "individu" };
        
        userDoc.forEach((doc) => {
            userData = doc.data();
        });
        
        return userData;
    } catch (error) {
        console.error("Login Error:", error);
        throw error;
    }
};

/**
 * Logout current user
 */
window.dbLogout = async function() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout Error:", error);
        throw error;
    }
};

/**
 * Get all profiles belonging to a user (by email) from Firestore
 */
window.dbGetProfiles = async function(userEmail) {
    try {
        const q = query(
            collection(db, "profiles"), 
            where("userEmail", "==", userEmail),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const profiles = [];
        querySnapshot.forEach((doc) => {
            profiles.push({ id: doc.id, ...doc.data() });
        });
        return profiles;
    } catch (error) {
        console.error("Get Profiles Error:", error);
        // Fallback if no index is created yet
        const qFallback = query(collection(db, "profiles"), where("userEmail", "==", userEmail));
        const fallbackSnapshot = await getDocs(qFallback);
        const profiles = [];
        fallbackSnapshot.forEach((doc) => {
            profiles.push({ id: doc.id, ...doc.data() });
        });
        return profiles;
    }
};

/**
 * Get a single profile by document ID (For SOS Feature)
 */
window.dbGetProfileById = async function(profileId) {
    try {
        const docRef = doc(db, "profiles", profileId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            let data = docSnap.data();
            data.id = docSnap.id;
            return data;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting profile:", error);
        throw error;
    }
};

/**
 * Save profile (create new or update existing) in Firestore
 */
window.dbSaveProfile = async function(profileData, userEmail) {
    try {
        const profileId = profileData.id;
        const dataToSave = {
            name: profileData.name,
            phone: profileData.phone,
            blood: profileData.blood,
            address: profileData.address,
            allergy: profileData.allergy,
            emergencyName: profileData.emergencyName,
            emergencyPhone: profileData.emergencyPhone,
            userEmail: userEmail,
            updatedAt: new Date().toISOString()
        };

        if (profileId) {
            // Update existing profile
            await setDoc(doc(db, "profiles", profileId), dataToSave, { merge: true });
            return profileId;
        } else {
            // Create new profile
            dataToSave.createdAt = new Date().toISOString();
            const docRef = await addDoc(collection(db, "profiles"), dataToSave);
            return docRef.id;
        }
    } catch (error) {
        console.error("Save Profile Error:", error);
        throw error;
    }
};

/**
 * Delete a profile from Firestore
 */
window.dbDeleteProfile = async function(profileId) {
    try {
        await deleteDoc(doc(db, "profiles", profileId));
    } catch (error) {
        console.error("Delete Profile Error:", error);
        throw error;
    }
};

/**
 * Get all orders belonging to a user (by email) from Firestore
 */
window.dbGetOrders = async function(userEmail) {
    try {
        const q = query(
            collection(db, "orders"), 
            where("userEmail", "==", userEmail),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    } catch (error) {
        console.error("Get Orders Error:", error);
        // Fallback
        const qFallback = query(collection(db, "orders"), where("userEmail", "==", userEmail));
        const fallbackSnapshot = await getDocs(qFallback);
        const orders = [];
        fallbackSnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        return orders;
    }
};

/**
 * Save a new order to Firestore
 */
window.dbSaveOrder = async function(orderData, userEmail) {
    try {
        const dataToSave = {
            product: orderData.product,
            productName: orderData.productName,
            profileId: orderData.profileId,
            profileName: orderData.profileName,
            color: orderData.color,
            customName: orderData.customName,
            price: orderData.price,
            isBulk: orderData.isBulk || false,
            quantity: orderData.quantity || 1,
            shipping: orderData.shipping || null,
            paymentMethod: orderData.paymentMethod || null,
            paymentProof: orderData.paymentProof || null,
            status: 'pending_payment',
            userEmail: userEmail,
            createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, "orders"), dataToSave);
        return docRef.id;
    } catch (error) {
        console.error("Save Order Error:", error);
        throw error;
    }
};

// Monitor Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Firebase Auth: User logged in as", user.email);
        localStorage.setItem('innoband-loggedin', 'true');
    } else {
        console.log("Firebase Auth: No user logged in");
        localStorage.setItem('innoband-loggedin', 'false');
    }
});

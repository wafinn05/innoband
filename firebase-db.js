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
    onAuthStateChanged,
    deleteUser
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
    getDoc,
    updateDoc
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
 * Listen for real-time profile changes from Firestore
 */
window.dbListenProfiles = function(userEmail, callback) {
    try {
        const q = query(
            collection(db, "profiles"), 
            where("userEmail", "==", userEmail)
        );
        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then((firestore) => {
            firestore.onSnapshot(q, (querySnapshot) => {
                const profiles = [];
                querySnapshot.forEach((doc) => {
                    profiles.push({ id: doc.id, ...doc.data() });
                });
                // Sort manually if orderBy index is missing
                profiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                callback(profiles);
            });
        });
    } catch (error) {
        console.error("Listen Profiles Error:", error);
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
            isAlert: profileData.isAlert || false,
            alertTime: profileData.alertTime || null,
            alertMapsLink: profileData.alertMapsLink || "",
            updatedAt: new Date().toISOString()
        };
        
        if (profileData.registrationId !== undefined) dataToSave.registrationId = profileData.registrationId;
        if (profileData.eventPurpose !== undefined) dataToSave.eventPurpose = profileData.eventPurpose;
        if (profileData.eventName !== undefined) dataToSave.eventName = profileData.eventName;
        if (profileData.eventSeat !== undefined) dataToSave.eventSeat = profileData.eventSeat;
        if (profileData.eventGate !== undefined) dataToSave.eventGate = profileData.eventGate;
        if (profileData.eventNumber !== undefined) dataToSave.eventNumber = profileData.eventNumber;

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
 * Listen to orders in realtime
 */
window.dbListenOrders = function(userEmail, callback) {
    try {
        const q = query(
            collection(db, "orders"), 
            where("userEmail", "==", userEmail)
        );
        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then((firestore) => {
            firestore.onSnapshot(q, (querySnapshot) => {
                const orders = [];
                querySnapshot.forEach((doc) => {
                    orders.push({ id: doc.id, ...doc.data() });
                });
                // Sort manually descending by createdAt
                orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                callback(orders);
            });
        });
    } catch (error) {
        console.error("Listen Orders Error:", error);
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

/**
 * Listen to a specific order status changes
 */
window.dbListenOrder = function(orderId, callback) {
    try {
        const docRef = doc(db, "orders", orderId);
        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then((firestore) => {
            firestore.onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    callback({ id: docSnap.id, ...docSnap.data() });
                }
            });
        });
    } catch (error) {
        console.error("Listen Order Error:", error);
    }
};

/**
 * Update user profile
 */
window.dbUpdateUser = async function(email, name, phone) {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, "users", userDoc.id), {
                name: name,
                phone: phone,
                updatedAt: new Date().toISOString()
            });
            return true;
        }
        throw new Error("User document not found");
    } catch (error) {
        console.error("Update User Error:", error);
        throw error;
    }
};

/**
 * Delete user account
 */
window.dbDeleteAccount = async function(email) {
    try {
        // Delete Firestore document
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            await deleteDoc(doc(db, "users", userDoc.id));
        }

        // Delete Firebase Auth user
        if (auth.currentUser) {
            await deleteUser(auth.currentUser);
        }
        
        return true;
    } catch (error) {
        console.error("Delete Account Error:", error);
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

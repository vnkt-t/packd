import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCustomToken, // For Canvas environment
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  getDocs,
  deleteDoc
} from 'firebase/firestore';

// Define Firebase configuration.
// Replace with your actual Firebase project configuration if you're not using the Canvas environment defaults.
const firebaseConfig = {
  apiKey: "AIzaSyCKBlAfBY7QIEv3rkRglDANkOqph67TSmo",
  authDomain: "packd-2e657.firebaseapp.com",
  projectId: "packd-2e657",
  storageBucket: "packd-2e657.firebasestorage.app",
  messagingSenderId: "940750390477",
  appId: "1:940750390477:web:0fe652567f7f1df032d584",
  measurementId: "G-HTDLKP79LE"
};

// Global variables provided by the Canvas environment.
// For local or GitHub Pages deployment, these will be undefined, and the code handles the fallbacks.
/* eslint-disable no-undef */ // Disable no-undef for __app_id and __initial_auth_token
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Initialize Firebase App and Services (Auth, Firestore)
// Ensures Firebase is initialized only once
let firebaseApp;
if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApp();
}
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Create a context for Firebase services and user data to avoid prop-drilling
const FirebaseContext = createContext(null);

// FirebaseProvider component to manage authentication state and provide Firebase instances
function FirebaseProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false); // Tracks if auth state has been checked
  const [authError, setAuthError] = useState(null); // For handling auth-related errors and displaying them

  useEffect(() => {
    // onAuthStateChanged listens for authentication state changes (login/logout)
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in.
        setCurrentUser(user);
        setUserId(user.uid);

        // Fetch or create user profile in Firestore
        const profileRef = doc(db, `artifacts/${appId}/users/${user.uid}/userProfile`, 'profile');
        onSnapshot(profileRef, (docSnap) => {
          if (!docSnap.exists()) {
            // If profile doesn't exist, create a default one
            setDoc(profileRef, {
              displayName: user.displayName || user.email || 'Student',
              email: user.email || 'N/A',
              darkMode: false, // Default setting
              accentColor: '#3498DB', // Default setting
              createdAt: new Date().toISOString(),
            }, { merge: true }) // Use merge: true to avoid overwriting existing fields if they appear later
            .catch(err => {
                console.error("Error creating user profile:", err);
                setAuthError(`Failed to create profile: ${err.message}`);
            });
          }
        }, (error) => {
            console.error("Error checking user profile existence:", error);
            setAuthError(`Failed to check profile: ${error.message}`);
        });
      } else {
        // User is signed out.
        setCurrentUser(null);
        setUserId(null);
      }
      setIsAuthReady(true); // Auth state check is complete
    });

    // Handle initial custom auth token provided by the Canvas environment
    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    if (initialAuthToken) {
      signInWithCustomToken(auth, initialAuthToken)
        .then(() => console.log("Signed in with custom token"))
        .catch((error) => {
          console.error("Error signing in with custom token:", error);
          setAuthError(`Custom token sign-in failed: ${error.message}. Attempting anonymous sign-in.`);
          // Fallback to anonymous sign-in if custom token fails
          signInAnonymously(auth).catch(anonErr => {
            console.error("Anonymous sign-in fallback failed:", anonErr);
            setAuthError(`Anonymous sign-in failed: ${anonErr.message}`);
          });
        });
    } else if (!auth.currentUser) {
        // If no initial token and no current user, sign in anonymously by default for basic functionality
        signInAnonymously(auth).catch(error => {
            console.error("Anonymous sign-in failed:", error);
            setAuthError(`Anonymous sign-in failed: ${error.message}`);
        });
    }

    // Cleanup function for the auth listener
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this effect runs only once on mount

  // Provide Firebase instances and user state to children components
  return (
    <FirebaseContext.Provider value={{ db, auth, currentUser, userId, isAuthReady, setAuthError, authError }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Custom hook to consume the Firebase context
const useFirebase = () => useContext(FirebaseContext);

// LoginPage component for user authentication
function LoginPage() { // Removed direct props for auth and setAuthError, will use context
  const { auth, authError, setAuthError } = useFirebase(); // Consume from context

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setAuthError(null); // Clear any previous errors on successful sign-in
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      setAuthError(`Google Sign-In failed: ${error.message}`);
    }
  };

  const handleAnonymousSignIn = async () => {
    try {
      await signInAnonymously(auth);
      setAuthError(null); // Clear any previous errors
    } catch (error) {
      console.error("Anonymous Sign-In Error:", error);
      setAuthError(`Anonymous Sign-In failed: ${error.message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 rounded-lg shadow-xl bg-white dark:bg-gray-800 text-center max-w-sm mx-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Welcome to PrepPack!</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6">Please sign in to continue.</p>

        <button
          onClick={handleGoogleSignIn}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors duration-200 mb-4 flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M44.5 24C44.5 22.0294 44.3168 20.0894 43.9577 18.1882H24V29.7765H35.4059C34.7941 33.1529 32.7412 35.8588 29.7765 37.8588V44.5H38.2941C42.8706 40.2353 44.5 33.9176 44.5 24Z" fill="#4285F4"/>
            <path d="M24 44.5C29.4176 44.5 33.9882 42.6118 37.1529 39.5471L29.7765 37.8588C27.9059 39.1882 26.0353 39.8824 24 39.8824C19.8235 39.8824 16.2 37.0824 14.8647 33.1529H6.11765V39.5471C9.69412 42.8706 16.3176 44.5 24 44.5Z" fill="#34A853"/>
            <path d="M14.8647 33.1529C14.1882 31.2824 13.8824 29.4118 13.8824 27.5294C13.8824 25.6471 14.1882 23.7765 14.8647 21.9059V15.5H6.11765C4.05882 19.4353 3 23.6471 3 27.5294C3 31.4118 4.05882 35.6235 6.11765 39.5471L14.8647 33.1529Z" fill="#FBBC05"/>
            <path d="M24 8.11765C27.5294 8.11765 30.6941 9.75294 33.0588 12.1176L38.2941 6.88235C33.9882 2.61176 29.4176 1 24 1C16.3176 1 9.69412 2.61176 6.11765 5.93529L14.8647 15.5C16.2 11.5647 19.8235 8.11765 24 8.11765Z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <button
          onClick={handleAnonymousSignIn}
          className="w-full bg-gray-500 text-white py-3 px-6 rounded-lg text-lg font-semibold hover:bg-gray-600 transition-colors duration-200"
        >
          Continue Anonymously
        </button>
        {authError && <p className="text-red-500 text-sm mt-4">{authError}</p>}
      </div>
    </div>
  );
}

// --- Custom Modal Components ---
// ConfirmationModal: A reusable modal for confirming user actions
function ConfirmationModal({ message, onConfirm, onCancel, isOpen }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150 ease-in-out"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition duration-150 ease-in-out"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

// ErrorReportingModal: A modal for displaying errors and allowing users to report them
function ErrorReportingModal({ errorMessage, onClose, isOpen }) {
    const [reportText, setReportText] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleSubmitReport = () => {
        console.log("Error Report Submitted:", { originalError: errorMessage, userReport: reportText });
        setIsSubmitted(true);
        setTimeout(() => {
            onClose();
            setIsSubmitted(false);
            setReportText('');
        }, 2000); // Close after 2 seconds and reset state
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full mx-4">
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Error Occurred!</h3>
                {isSubmitted ? (
                    <p className="text-green-600 dark:text-green-400 text-center text-lg">Report Submitted! Thank you.</p>
                ) : (
                    <>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            Something went wrong. Please describe what you were doing when this error occurred.
                        </p>
                        <textarea
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4 min-h-[100px]"
                            placeholder="e.g., 'I was trying to sync Classroom data and it showed an error.'"
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                        ></textarea>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Error Details: <span className="font-mono break-words">{errorMessage}</span>
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition duration-150 ease-in-out"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleSubmitReport}
                                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition duration-150 ease-in-out"
                            >
                                Submit Report
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}


// Helper function for Firestore document reference paths
const getUserDocRef = (dbInstance, currentUserId, collectionName, docName) => {
  return doc(dbInstance, `artifacts/${appId}/users/${currentUserId}/${collectionName}`, docName);
};

// Helper function to get a Firestore collection reference
const getUserCollectionRef = (dbInstance, currentUserId, collectionName) => {
  return collection(dbInstance, `artifacts/${appId}/users/${currentUserId}/${collectionName}`);
};

// Main application dashboard logic
function MainDashboardApp() {
  const { db, auth, currentUser, userId, isAuthReady, authError, setAuthError } = useFirebase();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userProfile, setUserProfile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for ConfirmationModal
  const [modalMessage, setModalMessage] = useState(''); // Message for ConfirmationModal
  const [modalOnConfirm, setModalOnConfirm] = useState(() => () => {}); // Callback for ConfirmationModal

  // Effect to apply dark mode and accent color based on user profile from Firestore
  useEffect(() => {
    if (userProfile) {
      if (userProfile.darkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      // Dynamically set CSS variables for accent colors
      document.documentElement.style.setProperty('--color-blue', userProfile.accentColor || '#3498DB');
      // Darken the accent color for hover states
      document.documentElement.style.setProperty('--color-dark-blue', userProfile.accentColor ? darkenColor(userProfile.accentColor, 10) : '#2980b9');
    }
  }, [userProfile]);

  // Helper function to darken a hex color by a percentage
  const darkenColor = (hex, percent) => {
    let f=parseInt(hex.slice(1),16);
    let t=percent<0?0:255;
    let p=percent<0?percent*-1:percent;
    let R=f>>16;
    let G=(f>>8)&0x00FF;
    let B=(f&0x0000FF);
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
  }

  // Effect to fetch user profile data from Firestore
  useEffect(() => {
    if (db && userId) { // Only fetch if Firestore and userId are available
      const profileRef = getUserDocRef(db, userId, 'userProfile', 'profile');
      const unsubscribe = onSnapshot(profileRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        } else {
          console.log("User profile document does not exist.");
          // A default profile will be created by FirebaseProvider if it doesn't exist
        }
      }, (error) => {
        console.error("Error fetching user profile:", error);
        setAuthError(`Failed to load profile: ${error.message}`);
      });
      return () => unsubscribe(); // Unsubscribe on component unmount
    }
  }, [db, userId, setAuthError]); // Re-run if db or userId changes

  // Function to show the confirmation modal
  const showConfirmation = (message, onConfirmCallback) => {
    setModalMessage(message);
    // Use a function to set the callback to prevent stale closures
    setModalOnConfirm(() => {
      return () => {
        onConfirmCallback();
        setIsModalOpen(false); // Close modal after action
      };
    });
    setIsModalOpen(true);
  };

  // Handle user sign out
  const handleSignOut = async () => {
    showConfirmation("Are you sure you want to sign out?", async () => {
      try {
        await signOut(auth); // Sign out using Firebase Auth
        console.log("User signed out.");
        setAuthError(null); // Clear any auth errors on successful sign out
      } catch (error) {
        console.error("Error signing out:", error);
        setAuthError(`Sign out failed: ${error.message}`);
      }
    });
  };

  // Simulated Google Classroom sync (requires backend for full integration)
  const handleSyncGoogleClassroom = () => {
      if (!currentUser || currentUser.isAnonymous) {
          setAuthError("Please sign in with your Google account to sync with Google Classroom.");
          return;
      }
      console.log("Attempting to sync with Google Classroom...");
      // In a real application, you would make a backend API call here
      // For example: fetch('/api/sync-classroom', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      setAuthError("Simulated sync with Google Classroom completed! (Requires backend integration for full functionality)");
  };

  // --- Conditional Rendering based on Authentication State ---
  // Show loading state while Firebase authentication is being checked
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading PrepPack...</p>
      </div>
    );
  }

  // If there's an authentication error, display it in the error reporting modal
  if (authError && !currentUser) { // Only show error modal if there's an error and no user logged in
    return (
      <>
        <LoginPage auth={auth} setAuthError={setAuthError} />
        <ErrorReportingModal
            errorMessage={authError}
            onClose={() => setAuthError(null)} // Clear error when modal is closed
            isOpen={authError !== null}
        />
      </>
    );
  }

  // If no user is authenticated (or an anonymous user who needs to sign in with Google for full features), show LoginPage
  // This ensures the LoginPage is shown on initial anonymous sign-in or after sign-out.
  if (!currentUser) {
      return <LoginPage auth={auth} setAuthError={setAuthError} />;
  }

  // If authenticated, show the main dashboard application
  return (
    <>
      {/* CSS Styles embedded directly in the component */}
      <style>{`
        /* CSS Variables for Light Mode */
        :root {
            --bg-color-primary: #FDFDFD; /* Main background */
            --bg-color-secondary: #f0f0f0; /* Sidebar, lighter elements */
            --bg-color-card: rgba(255, 255, 255, 0.6); /* Frosted card background */
            --bg-color-card-active: rgba(255, 255, 255, 0.75); /* Card background on hover/focus */
            --text-color-primary: #333;
            --text-color-secondary: #555;
            --text-color-tertiary: #888;
            --border-color-light: #ddd;
            --border-color-medium: #ccc;
            --border-color-card: rgba(255, 255, 255, 0.4);
            --box-shadow-card: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.02);
            --outline-color-card: rgba(0, 0, 0, 0.08);
            --input-bg: rgba(255, 255, 255, 0.75);
            --input-border: rgba(204, 204, 204, 0.6);
            --progress-bar-bg: #e0e0e0;
            --active-link-bg: #e0e0e0;
            --active-link-color: #222;
            --checkbox-bg: #fff;
            --pomodoro-bg-stroke: #eee;
            --table-header-bg: rgba(245, 245, 245, 0.7);
            --gpa-bg-stroke: #eee;
            --day-dot-bg: rgba(200, 200, 200, 0.5);
            --day-dot-border: rgba(180, 180, 180, 0.6);
            --day-dot-hover-bg: rgba(180, 180, 180, 0.7);

            /* Accent Colors - can be customized */
            --color-green: #4CAF50;
            --color-red: #E74C3C;
            --color-blue: #3498DB;
            --color-orange: #F39C12;
            --color-dark-green: #45a049;
            --color-dark-blue: #2980b9;
        }

        /* Dark Mode specific CSS Variables */
        body.dark-mode {
            --bg-color-primary: #1A1A1A;
            --bg-color-secondary: #2C2C2C;
            --bg-color-card: rgba(40, 40, 40, 0.6);
            --bg-color-card-active: rgba(40, 40, 40, 0.75);
            --text-color-primary: #E0E0E0;
            --text-color-secondary: #BBBBBB;
            --text-color-tertiary: #999999;
            --border-color-light: #444;
            --border-color-medium: #666;
            --border-color-card: rgba(60, 60, 60, 0.4);
            --box-shadow-card: 0 4px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1);
            --outline-color-card: rgba(255, 255, 255, 0.08);
            --input-bg: rgba(50, 50, 50, 0.75);
            --input-border: rgba(90, 90, 90, 0.6);
            --progress-bar-bg: #444;
            --active-link-bg: #3A3A3A;
            --active-link-color: #F0F0E0;
            --checkbox-bg: #3A3A3A;
            --pomodoro-bg-stroke: #555;
            --table-header-bg: rgba(60, 60, 60, 0.7);
            --gpa-bg-stroke: #555;
            --day-dot-bg: rgba(80, 80, 80, 0.5);
            --day-dot-border: rgba(100, 100, 100, 0.6);
            --day-dot-hover-bg: rgba(100, 100, 100, 0.7);
        }

        /* General styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
        }

        body {
            background-color: var(--bg-color-primary);
            overflow-x: hidden;
            display: flex;
            min-height: 100vh;
            color: var(--text-color-primary); /* Base text color */
        }

        /* Sidebar styles */
        .sidebar {
            position: fixed;
            width: 220px;
            height: 100vh;
            background: var(--bg-color-secondary);
            padding: 20px;
            border-right: 1px solid var(--border-color-light);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding-top: 30px;
            z-index: 10;
            overflow-y: auto;
        }

        .sidebar .logo {
            font-size: 24px;
            font-weight: 600;
            color: var(--text-color-primary);
            margin-bottom: 40px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .sidebar nav {
            width: 100%;
        }

        .sidebar nav a {
            display: block;
            margin: 15px 0;
            padding: 8px 15px;
            color: var(--text-color-secondary);
            text-decoration: none;
            border-radius: 8px;
            transition: background 0.2s ease, color 0.2s ease;
            font-weight: 500;
        }

        .sidebar nav a:hover,
        .sidebar nav a.active-link {
            background: var(--active-link-bg);
            color: var(--active-link-color);
        }

        /* Main content area */
        .main {
            margin-left: 220px;
            flex-grow: 1;
            padding: 30px 40px;
            display: flex;
            flex-direction: column;
            gap: 25px;
            position: relative;
            z-index: 1;
            min-height: calc(100vh - 60px);
        }

        /* Header top section */
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            margin-bottom: 20px;
        }

        .search-bar {
            position: relative;
            width: 300px;
        }

        .search-bar input {
            width: 100%;
            padding: 10px 15px 10px 40px;
            border: 1px solid var(--border-color-medium);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            background-color: var(--input-bg);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            color: var(--text-color-primary);
        }

        .search-bar input::placeholder {
            color: var(--text-color-tertiary);
        }

        .search-bar .search-icon {
            position: absolute;
            left: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-color-tertiary);
        }

        .date-time {
            font-size: 28px;
            font-weight: 600;
            color: var(--text-color-primary);
            text-align: right;
            line-height: 1.2;
        }

        /* Consistent header style for welcome, calendar, and add task */
        .page-header {
            font-size: 32px;
            font-weight: 700;
            color: var(--text-color-primary);
            margin-bottom: 20px;
            text-align: left;
            width: 100%;
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .page-header .date-picker-trigger {
            font-size: 18px;
            font-weight: 500;
            color: var(--text-color-secondary);
            padding: 8px 12px;
            border: 1px solid var(--border-color-medium);
            border-radius: 8px;
            background-color: var(--bg-color-card);
            cursor: pointer;
            transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .page-header .date-picker-trigger:hover {
            background-color: var(--bg-color-card-active);
            border-color: var(--border-color-medium);
        }

        .welcome-message {
            /* display: none; */ /* React will control visibility */
        }
        .welcome-message .productive-text {
            color: var(--color-green);
        }

        /* Frosted Glass Base Style - applied to all relevant "box" elements */
        .box, .assessment-card, .habit-table, .calendar-day-cell, .plan-summary-item, .scheduled-task-card {
            background-color: var(--bg-color-card);
            backdrop-filter: blur(8px) saturate(150%);
            -webkit-backdrop-filter: blur(8px) saturate(150%);
            border-radius: 12px;
            border: 1px solid var(--border-color-card);
            box-shadow: var(--box-shadow-card);
            overflow: hidden;
            outline: 1px solid var(--outline-color-card);
            outline-offset: -1px;
        }

        /* Specific styles for .box elements */
        .box {
            padding: 25px;
            display: flex;
            flex-direction: column;
        }

        .box h3 {
            font-size: 20px;
            color: var(--text-color-primary);
            margin-bottom: 15px;
            font-weight: 600;
        }

        /* Productivity section */
        .productivity-section {
            background-color: var(--bg-color-card-active); /* Slightly less transparent */
            backdrop-filter: blur(10px) saturate(150%);
            -webkit-backdrop-filter: blur(10px) saturate(150%);
            border-radius: 10px;
            border: 1px solid var(--border-color-card);
            box-shadow: var(--box-shadow-card);
            padding: 20px;
            margin-bottom: 20px;
            outline: 1px solid var(--outline-color-card);
            outline-offset: -1px;
        }

        .productivity-section strong {
            font-size: 16px;
            color: var(--text-color-primary);
            display: block;
            margin-bottom: 5px;
        }

        .productivity-section p {
            font-size: 13px;
            color: var(--text-color-secondary);
            margin-top: 3px;
        }

        .progress-bar {
            background: var(--progress-bar-bg);
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }

        .progress-bar-inner {
            height: 100%;
            width: 85.7%; /* Example value, will be dynamic */
            background-color: var(--color-green);
            border-radius: 44px;
        }

        /* Dashboard Content Container */
        #dashboard-content {
            display: flex;
            flex-direction: column;
            gap: 25px;
            width: 100%;
        }

        .grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
        }

        .task-list ul {
            list-style: none;
            margin-top: 5px;
        }

        .task-list li {
            display: flex;
            align-items: center;
            margin: 12px 0;
            font-size: 16px;
            color: var(--text-color-primary);
        }

        .task-list li .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid var(--border-color-medium);
            border-radius: 4px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-right: 10px;
            cursor: pointer;
            flex-shrink: 0;
            background-color: var(--checkbox-bg);
        }

        .task-list li .checkbox.checked {
            background-color: var(--color-green);
            border-color: var(--color-green);
            color: #fff;
            font-weight: bold;
        }

        .task-list li .task-text {
            flex-grow: 1;
            font-weight: 500;
        }

        .task-list li .due-date {
            font-size: 13px;
            color: var(--text-color-tertiary);
            margin-left: 10px;
            white-space: nowrap;
        }

        .task-list li .open-link {
            color: var(--color-blue);
            text-decoration: none;
            font-size: 13px;
            margin-left: 15px;
            white-space: nowrap;
        }

        .ai-suggestion {
            margin-top: 20px;
            display: flex;
            align-items: center;
            font-style: normal;
            color: var(--text-color-primary);
            font-size: 16px;
            font-weight: 500;
        }

        .ai-suggestion .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid var(--border-color-medium);
            border-radius: 4px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-right: 10px;
            cursor: pointer;
            flex-shrink: 0;
            background-color: var(--checkbox-bg);
        }

        .pomodoro {
            text-align: center;
            flex: 1;
        }

        .pomodoro-timer {
            position: relative;
            width: 180px;
            height: 180px;
            margin: 20px auto 15px;
        }

        .pomodoro-timer svg {
            transform: rotate(-90deg);
            width: 100%;
            height: 100%;
        }

        .pomodoro-timer circle {
            fill: none;
            stroke-width: 15;
        }

        .pomodoro-bg {
            stroke: var(--pomodoro-bg-stroke);
        }

        /* pomodoro-fg stroke color will be set by JS based on mode */
        .pomodoro-fg {
            stroke: var(--color-red); /* Default, will be overridden by JS */
            stroke-dasharray: 502.65;
            /* stroke-dashoffset: calc(502.65 - (25 / 25 * 502.65)); */ /* Default, will be overridden by JS */
            transition: stroke-dashoffset 1s linear; /* Changed to linear for smooth timer */
        }

        .pomodoro-time-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 38px;
            font-weight: 600;
            color: var(--text-color-primary);
        }

        .pomodoro-dots {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-top: 15px;
            margin-bottom: 10px;
        }

        .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            opacity: 0.6;
            cursor: pointer; /* Make dots clickable/interactive */
        }

        .dot.active {
            opacity: 1;
            transform: scale(1.2); /* Slightly enlarge active dot */
            box-shadow: 0 0 5px rgba(0,0,0,0.3); /* Add a subtle shadow */
        }

        .dot.study {
            background: var(--color-red);
        }

        .dot.break {
            background: var(--color-blue);
        }

        .dot.long-break {
            background: var(--color-orange); /* Distinct color for long break */
        }

        .pomodoro p {
            font-size: 14px;
            color: var(--text-color-secondary);
            margin-bottom: 20px;
        }

        .pomodoro button {
            background-color: var(--color-green);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: background-color 0.2s ease;
        }

        .pomodoro button:hover {
            background-color: var(--color-dark-green);
        }

        .upcoming-assessments {
            text-align: left;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .assessment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 15px;
            margin-top: 15px;
            max-width: 100%;
        }

        .assessment-card {
            transition: transform 0.2s, box-shadow 0.2s;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 15px;
            min-width: 140px;
        }

        .assessment-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
        }

        .assessment-card.success {
            border-left: 6px solid var(--color-green);
        }

        .assessment-card.fail {
            border-left: 6px solid var(--color-red);
        }

        .assessment-card .date {
            font-size: 13px;
            color: var(--text-color-tertiary);
            margin-bottom: 5px;
        }

        .assessment-card .title {
            font-weight: 600;
            font-size: 16px;
            color: var(--text-color-primary);
            margin-bottom: 8px;
        }

        .assessment-card .status {
            font-size: 24px;
        }

        .habit-tracker {
            grid-column: span 2;
        }

        .habit-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 15px;
            overflow: hidden;
            border-radius: 10px;
        }

        .habit-table th, .habit-table td {
            border: 1px solid var(--border-color-card);
            padding: 10px 8px;
            text-align: center;
            font-size: 14px;
            color: var(--text-color-secondary);
            background-color: inherit;
        }

        .habit-table th {
            background-color: var(--table-header-bg);
            font-weight: 600;
            color: var(--text-color-primary);
        }

        .habit-table td:first-child {
            text-align: left;
            font-weight: 500;
            color: var(--text-color-primary);
            background-color: var(--bg-color-card);
        }

        .habit-table .checkbox-cell {
            font-size: 18px;
        }

        .habit-table .checkbox-cell.checked {
            color: var(--color-green);
        }

        .habit-table .checkbox-cell.unchecked {
            color: var(--color-red);
        }

        .gpa {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
        }

        .gpa-circle {
            position: relative;
            width: 120px;
            height: 120px;
            margin: 20px auto 10px;
        }

        .gpa-circle svg {
            transform: rotate(-90deg);
            width: 100%;
            height: 100%;
        }

        .gpa-circle circle {
            fill: none;
            stroke-width: 12;
        }

        .gpa-bg {
            stroke: var(--gpa-bg-stroke);
        }

        .gpa-fg {
            stroke: var(--color-blue);
            stroke-dasharray: 314.16;
            /* stroke-dashoffset: calc(314.16 - (3.75 / 4.0 * 314.16)); */ /* Will be dynamic */
            transition: stroke-dashoffset 1s ease;
        }

        .gpa-value {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 38px;
            font-weight: 700;
            color: var(--color-blue);
        }

        .notes-section {
            flex: 1;
        }

        .notes-section h3 {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .notes-section .edit-icon {
            font-size: 24px;
            cursor: pointer;
        }

        .notes-section p {
            font-size: 16px;
            color: var(--text-color-secondary);
            margin-top: 10px;
            font-weight: 500;
        }

        /* Calendar Page Specific Styles */
        .calendar-page {
            display: flex; /* React will control visibility */
            flex-direction: column;
            gap: 20px;
            width: 100%;
            padding: 20px 0;
            align-items: center;
        }

        /* .calendar-page.active { display: flex; } */

        .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 10px;
            width: 100%;
            max-width: 900px;
            margin: 0 auto;
        }

        .calendar-day-name {
            font-weight: 600;
            text-align: center;
            color: var(--text-color-secondary);
            padding: 10px 0;
            background-color: var(--table-header-bg);
            border-radius: 8px;
        }

        .calendar-day-cell {
            min-height: 120px;
            padding: 10px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            text-align: left;
            position: relative;
        }

        .calendar-day-cell.inactive {
            background-color: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.2);
            color: var(--text-color-tertiary);
        }
        body.dark-mode .calendar-day-cell.inactive {
            background-color: rgba(40, 40, 40, 0.3);
            border-color: rgba(60, 60, 60, 0.2);
        }


        .calendar-day-cell .day-number {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color-primary);
            margin-bottom: 5px;
            position: relative;
            z-index: 2;
        }

        .calendar-day-cell.inactive .day-number {
            color: var(--text-color-tertiary);
        }

        .calendar-day-cell.today .day-number {
            color: #fff;
            background-color: var(--color-red);
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 5px;
            left: 2px;
            font-size: 16px;
            z-index: 2;
        }

        .calendar-day-cell.today {
            border: 1px solid var(--color-red);
        }

        .calendar-day-cell .progress-bar-small {
            background: var(--progress-bar-bg);
            height: 5px;
            border-radius: 3px;
            overflow: hidden;
            width: 90%;
            margin-top: 5px;
        }

        /* Specific style for today's progress bar */
        .calendar-day-cell.today .progress-bar-small {
            margin-top: 40px; /* Adjusted to move below the circular day number */
        }

        .calendar-day-cell .progress-bar-small-inner {
            height: 100%;
            background-color: var(--color-green);
            border-radius: 3px;
        }

        /* Progress bar colors based on value */
        .calendar-day-cell .progress-bar-small-inner.yellow {
            background-color: var(--color-orange);
        }
        .calendar-day-cell .progress-bar-small-inner.red {
            background-color: var(--color-red);
        }
        .calendar-day-cell .progress-bar-small-inner.green {
            background-color: var(--color-green);
        }

        .calendar-day-cell .event-text {
            font-size: 12px;
            color: var(--text-color-secondary);
            margin-top: 8px;
            line-height: 1.3;
        }

        .calendar-day-cell.inactive .event-text {
            color: var(--text-color-tertiary);
        }

        /* Add a Task Page Specific Styles */
        .add-task-page {
            display: flex; /* React will control visibility */
            flex-direction: column;
            gap: 25px;
            width: 100%;
            padding: 20px 0;
            align-items: center;
        }

        /* .add-task-page.active { display: flex; } */

        /* Styles for input groups */
        .input-group {
            margin-bottom: 15px;
            width: 100%;
            position: relative;
        }

        .input-group label {
            display: block;
            font-size: 14px;
            color: var(--text-color-secondary);
            margin-bottom: 6px;
            font-weight: 500;
        }

        .input-group input[type="text"],
        .input-group select,
        .input-group textarea,
        .input-group input[type="date"],
        .input-group input[type="number"] { /* Added number input */
            width: 100%;
            padding: 10px 12px;
            border: 1px solid var(--input-border);
            border-radius: 8px;
            font-size: 15px;
            outline: none;
            background-color: var(--input-bg);
            color: var(--text-color-primary);
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
            transition: border-color 0.2s ease, background-color 0.2s ease;
            height: 40px;
            resize: vertical;
        }

        .input-group textarea {
            min-height: 80px;
            height: auto;
            padding-right: 35px;
        }

        .input-group input[type="text"]::placeholder,
        .input-group textarea::placeholder {
            color: var(--text-color-tertiary);
        }

        .input-group input[type="text"]:focus,
        .input-group select:focus,
        .input-group textarea:focus,
        .input-group input[type="date"]:focus,
        .input-group input[type="number"]:focus {
            border-color: var(--color-green);
            background-color: var(--bg-color-card-active);
        }

        .input-group select {
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg fill="%23555555" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>');
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 20px;
        }
        body.dark-mode .input-group select {
            background-image: url('data:image/svg+xml;utf8,<svg fill="%23BBBBBB" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>');
        }


        .input-group .input-icon {
            position: absolute;
            right: 15px;
            bottom: 10px;
            font-size: 18px;
            color: var(--text-color-tertiary);
            pointer-events: none;
        }

        .add-task-card,
        .add-category-card,
        .gpa-calculator-section { /* Added GPA calculator section to card styles */
            padding: 25px 30px;
            max-width: 700px;
            width: 100%;
            margin: 0;
        }

        .add-category-card .card-title,
        .gpa-calculator-section .card-title { /* Added GPA calculator section */
            font-size: 20px;
            color: var(--text-color-primary);
            margin-bottom: 20px;
            font-weight: 600;
        }

        .input-group-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px 25px;
            margin-bottom: 20px;
        }

        .input-group-grid .input-group:last-child {
            grid-column: span 2;
        }

        .add-button {
            background-color: var(--color-green);
            color: white;
            border: none;
            padding: 12px 25px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            transition: background-color 0.2s ease, transform 0.1s ease;
            width: auto;
            align-self: flex-start;
            margin-top: 5px;
        }

        .add-button:hover {
            background-color: var(--color-dark-green);
            transform: translateY(-1px);
        }

        /* Styles for Habit fields */
        .repeat-days-selector {
            display: flex;
            gap: 8px;
            margin-top: 5px;
            margin-bottom: 15px;
        }

        .day-dot {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: var(--day-dot-bg);
            color: var(--text-color-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
            border: 1px solid var(--day-dot-border);
        }

        .day-dot:hover {
            background-color: var(--day-dot-hover-bg);
        }

        .day-dot.selected {
            background-color: var(--color-green);
            color: white;
            border-color: var(--color-green);
        }

        /* Plan Page Specific Styles */
        .plan-page {
            display: flex; /* React will control visibility */
            flex-direction: column;
            gap: 25px;
            width: 100%;
            padding: 20px 0;
            align-items: center;
        }

        /* .plan-page.active { display: flex; } */

        .plan-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 25px;
            width: 100%;
            max-width: 900px;
            margin-top: -10px;
            margin-bottom: 10px;
        }

        .plan-summary-item {
            padding: 15px 20px;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .plan-summary-item .label {
            font-size: 14px;
            color: var(--text-color-secondary);
            margin-bottom: 5px;
            font-weight: 500;
        }

        .plan-summary-item .value {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-color-primary);
        }

        .plan-summary-item.progress-summary .value {
            color: var(--color-green);
        }

        .plan-summary-item.time-summary .value {
            color: var(--color-blue);
        }

        .plan-summary-item.exams-summary .value {
            color: var(--color-red);
        }

        .scheduled-tasks-list {
            width: 100%;
            max-width: 900px;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .scheduled-task-card {
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
            min-height: 70px;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .scheduled-task-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 12px rgba(0, 0, 0, 0.08);
        }

        .scheduled-task-card .time-slot {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color-secondary);
            flex-shrink: 0;
            width: 90px;
            text-align: right;
            border-right: 1px solid var(--border-color-light);
            padding-right: 15px;
        }
        body.dark-mode .scheduled-task-card .time-slot {
            border-right: 1px solid var(--border-color-medium);
        }


        .scheduled-task-card .task-details {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .scheduled-task-card .task-name {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-color-primary);
            margin-bottom: 5px;
        }

        .scheduled-task-card .tags {
            display: flex;
            gap: 8px;
        }

        .scheduled-task-card .tag {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 6px;
            font-weight: 600;
            white-space: nowrap;
        }

        .scheduled-task-card .tag.priority-high {
            background-color: #F8D7DA; /* Light Red */
            color: #721C24; /* Dark Red */
        }

        .scheduled-task-card .tag.priority-medium {
            background-color: #FFF3CD; /* Light Yellow */
            color: #856404; /* Dark Yellow */
        }

        .scheduled-task-card .tag.priority-low {
            background-color: #D4EDDA; /* Light Green */
            color: #155724; /* Dark Green */
        }

        .scheduled-task-card .tag.custom-task {
            background-color: #CCE5FF; /* Light Blue */
            color: #004085; /* Dark Blue */
        }

        .scheduled-task-card .task-checkbox {
            width: 28px;
            height: 28px;
            border: 2px solid var(--border-color-medium);
            border-radius: 6px;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
            flex-shrink: 0;
            margin-left: auto;
            background-color: var(--checkbox-bg);
            transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .scheduled-task-card .task-checkbox.checked {
            background-color: var(--color-green);
            border-color: var(--color-green);
            color: #fff;
            font-weight: bold;
            font-size: 18px;
        }

        .scheduled-task-card .task-checkbox.completed-icon {
            color: var(--color-green);
            font-size: 24px;
            border: none;
            background: none;
        }

        /* Settings Page Specific Styles */
        .settings-page {
            display: flex; /* Hidden by default */
            flex-direction: column;
            gap: 25px;
            width: 100%;
            padding: 20px 0;
            align-items: center;
        }

        /* .settings-page.active { display: flex; } */

        .settings-section {
            padding: 25px 30px;
            max-width: 700px;
            width: 100%;
        }

        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--border-color-light);
        }

        .setting-item:last-of-type {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .setting-item label {
            font-size: 16px;
            color: var(--text-color-primary);
            font-weight: 500;
        }

        /* Toggle Switch CSS */
        .switch {
            position: relative;
            display: inline-block;
            width: 45px;
            height: 25px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--progress-bar-bg);
            transition: .4s;
            border-radius: 25px;
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--color-green);
        }

        input:focus + .slider {
            box-shadow: 0 0 1px var(--color-green);
        }

        input:checked + .slider:before {
            transform: translateX(20px);
        }

        /* Specific styles for buttons within settings */
        .settings-button {
            background-color: var(--color-blue);
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s ease;
        }

        .settings-button:hover {
            background-color: var(--color-dark-blue);
        }

        .input-group input[type="color"] {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            width: 40px;
            height: 28px;
            border: none;
            padding: 0;
            background: none;
            cursor: pointer;
            border-radius: 4px;
        }

        .input-group input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
        }

        .input-group input[type="color"]::-webkit-color-swatch {
            border: 1px solid var(--border-color-medium);
            border-radius: 4px;
        }

        /* GPA Calculator Page Styles */
        .gpa-calculator-page {
            display: flex; /* Hidden by default */
            flex-direction: column;
            gap: 25px;
            width: 100%;
            padding: 20px 0;
            align-items: center;
        }

        /* .gpa-calculator-page.active { display: flex; } */

        .gpa-calculator-section {
            padding: 25px 30px;
            max-width: 700px;
            width: 100%;
            margin: 0;
        }

        .gpa-calculator-section .add-button {
            margin-top: 20px; /* Space above add course button */
        }

        .course-list {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            overflow: hidden;
            border-radius: 10px;
            background-color: var(--bg-color-card); /* Inherit card background */
            box-shadow: var(--box-shadow-card);
            border: 1px solid var(--border-color-card);
            margin-top: 20px;
        }

        .course-list th, .course-list td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid var(--border-color-light);
            color: var(--text-color-primary);
        }

        .course-list th {
            background-color: var(--table-header-bg);
            font-weight: 600;
            font-size: 15px;
        }

        .course-list td {
            font-size: 14px;
            color: var(--text-color-secondary);
        }

        .course-list tr:last-child td {
            border-bottom: none;
        }

        .course-list .remove-btn {
            background-color: var(--color-red);
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.2s ease;
        }

        .course-list .remove-btn:hover {
            background-color: #c0392b; /* Darker red */
        }

        .gpa-result {
            text-align: right;
            font-size: 24px;
            font-weight: 700;
            color: var(--color-blue);
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid var(--border-color-light);
        }
        .gpa-result span {
            font-size: 16px;
            font-weight: 500;
            color: var(--text-color-secondary);
            margin-right: 10px;
        }
      `}</style>
      <div className="flex w-full min-h-screen">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M2 7L12 12L22 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M12 12V22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M7 4.5L17 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 14.5L17 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            PrepPack
          </div>
          <nav>
            <a href="#" className={currentPage === 'dashboard' ? 'active-link' : ''} onClick={() => setCurrentPage('dashboard')}>
              Dashboard
            </a>
            <a href="#" className={currentPage === 'calendar' ? 'active-link' : ''} onClick={() => setCurrentPage('calendar')}>
              Calendar
            </a>
            <a href="#" className={currentPage === 'add-task' ? 'active-link' : ''} onClick={() => setCurrentPage('add-task')}>
              Add Task
            </a>
            <a href="#" className={currentPage === 'plan' ? 'active-link' : ''} onClick={() => setCurrentPage('plan')}>
              Study Plan
            </a>
            <a href="#" className={currentPage === 'gpa-calculator' ? 'active-link' : ''} onClick={() => setCurrentPage('gpa-calculator')}>
              GPA Calculator
            </a>
            <a href="#" className={currentPage === 'settings' ? 'active-link' : ''} onClick={() => setCurrentPage('settings')}>
              Settings
            </a>
          </nav>

          <div className="mt-auto w-full pt-6"> {/* Push to bottom */}
            {/* Display user ID */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">User ID: {userId}</p>
            {/* Display user email if available */}
            {currentUser && currentUser.email && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Email: {currentUser.email}</p>
            )}
            <button
                onClick={handleSignOut}
                className="w-full bg-red-500 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors duration-200 mt-4"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main">
          {/* Header */}
          <header className="header-top">
            <div className="search-bar">
              <input type="text" placeholder="Search for anything..." />
              <span className="search-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19.5 21L21 19.5L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="currentColor"/>
                </svg>
              </span>
            </div>
            <div className="date-time">
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span><br/>
              <span className="text-2xl text-gray-500 dark:text-gray-400">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </header>

          {/* Page Specific Headers */}
          {currentPage === 'dashboard' && (
            <div className="page-header">
              <span className="welcome-message">
                Hello, {userProfile?.displayName || 'Student'}! Make it a <span className="productive-text">productive</span> day.
              </span>
            </div>
          )}
          {currentPage === 'calendar' && (
            <div className="page-header">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Calendar Overview
              <button className="date-picker-trigger">Select Date</button>
            </div>
          )}
          {currentPage === 'add-task' && (
            <div className="page-header">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Add New Task / Habit
            </div>
          )}
          {currentPage === 'plan' && (
            <div className="page-header">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 4H8C5.79086 4 4 5.79086 4 8V16C4 18.2091 5.79086 20 8 20H16C18.2091 20 20 18.2091 20 16V8C20 5.79086 18.2091 4 16 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 8L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 16L8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Study Plan
            </div>
          )}
          {currentPage === 'gpa-calculator' && (
            <div className="page-header">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                GPA Calculator
            </div>
          )}
          {currentPage === 'settings' && (
            <div className="page-header">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 6V3M12 21V18M18 12H21M3 12H6M19.07 4.93L17.66 6.34M6.34 17.66L4.93 19.07M19.07 19.07L17.66 17.66M6.34 6.34L4.93 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Settings
            </div>
          )}


          {/* Dashboard Page */}
          {currentPage === 'dashboard' && (
            <div id="dashboard-content">
                <div className="productivity-section">
                    <strong>Your Productivity Progress</strong>
                    <p>85.7% of tasks completed this week, keep up the great work!</p>
                    <div className="progress-bar">
                        <div className="progress-bar-inner" style={{ width: '85.7%' }}></div>
                    </div>
                </div>

                <div className="grid-container">
                    <div className="box task-list">
                        <h3>Today's Tasks</h3>
                        <ul>
                            <li>
                                <span className="checkbox checked">✔</span>
                                <span className="task-text">Finish Math Homework</span>
                                <span className="due-date">Due: 5 PM</span>
                                <a href="#" className="open-link">Open</a>
                            </li>
                            <li>
                                <span className="checkbox"></span>
                                <span className="task-text">Study for Physics Exam</span>
                                <span className="due-date">Due: Tomorrow</span>
                                <a href="#" className="open-link">Open</a>
                            </li>
                            <li>
                                <span className="checkbox"></span>
                                <span className="task-text">Read "To Kill a Mockingbird" Chapter 10</span>
                                <span className="due-date">Due: Fri</span>
                                <a href="#" className="open-link">Open</a>
                            </li>
                        </ul>
                        <div className="ai-suggestion">
                            <span className="checkbox"></span>
                            <span>AI Suggestion: Review Calculus concepts from last week.</span>
                        </div>
                    </div>

                    <div className="box pomodoro">
                        <h3>Pomodoro Timer</h3>
                        <div className="pomodoro-timer">
                            <svg viewBox="0 0 180 180">
                                <circle cx="90" cy="90" r="80" className="pomodoro-bg"></circle>
                                {/* stroke-dashoffset is calculated as circumference - (percent * circumference) */}
                                <circle cx="90" cy="90" r="80" className="pomodoro-fg"
                                        style={{ strokeDashoffset: `calc(502.65 - (25 / 25 * 502.65))`, stroke: 'var(--color-red)' }}
                                ></circle>
                            </svg>
                            <div className="pomodoro-time-text">25:00</div>
                        </div>
                        <div className="pomodoro-dots">
                            <span className="dot study active" style={{backgroundColor: 'var(--color-red)'}}></span>
                            <span className="dot break" style={{backgroundColor: 'var(--color-blue)'}}></span>
                            <span className="dot long-break" style={{backgroundColor: 'var(--color-orange)'}}></span>
                        </div>
                        <p>Focus on your studies with timed intervals.</p>
                        <button>Start Timer</button>
                    </div>

                    <div className="box upcoming-assessments">
                        <h3>Upcoming Assessments</h3>
                        <div className="assessment-grid">
                            <div className="assessment-card success">
                                <div className="date">Jul 10</div>
                                <div className="title">History Quiz</div>
                                <div className="status">Passed</div>
                            </div>
                            <div className="assessment-card fail">
                                <div className="date">Aug 01</div>
                                <div className="title">Chemistry Midterm</div>
                                <div className="status">Failed</div>
                            </div>
                            <div className="assessment-card">
                                {/* Removed the non-standard 'behaves-like' attribute */}
                                <div id="math-final-card">
                                    <div className="date">Oct 05</div>
                                    <div className="title">Math Final</div>
                                    <div className="status">Pending</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="box habit-tracker">
                        <h3>Habit Tracker</h3>
                        <table className="habit-table">
                            <thead>
                                <tr>
                                    <th>Habit</th>
                                    <th>Mon</th>
                                    <th>Tue</th>
                                    <th>Wed</th>
                                    <th>Thu</th>
                                    <th>Fri</th>
                                    <th>Sat</th>
                                    <th>Sun</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Meditate 10min</td>
                                    <td className="checkbox-cell checked">✔</td>
                                    <td className="checkbox-cell checked">✔</td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                </tr>
                                <tr>
                                    <td>Exercise</td>
                                    <td className="checkbox-cell checked">✔</td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell checked">✔</td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                </tr>
                                <tr>
                                    <td>Read Book</td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell checked">✔</td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell checked">✔</td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                    <td className="checkbox-cell"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="box gpa">
                        <h3>Current GPA</h3>
                        <div className="gpa-circle">
                            <svg viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" className="gpa-bg"></circle>
                                {/* stroke-dashoffset is calculated as circumference - (gpa_percent * circumference) */}
                                <circle cx="60" cy="60" r="50" className="gpa-fg"
                                        style={{ strokeDashoffset: `calc(314.16 - (3.75 / 4.0 * 314.16))` }}
                                ></circle>
                            </svg>
                            <div className="gpa-value">3.75</div>
                        </div>
                        <p>Based on your last semester's courses.</p>
                    </div>

                    <div className="box notes-section">
                        <h3>Quick Notes
                            <span className="edit-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M11 4H4C3.44772 4 3 4.44772 3 5V20C3 20.5523 3.44772 21 4 21H19C19.5523 21 20 20.5523 20 20V13M18.5 2.5C18.8978 2.10217 19.4391 1.89506 20 1.89506C20.5609 1.89506 21.1022 2.10217 21.5 2.5C21.8978 2.89782 22.1049 3.43913 22.1049 4C22.1049 4.56087 21.8978 5.10217 21.5 5.5L12 15L8 16L9 12L18.5 2.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </span>
                        </h3>
                        <p>Remember to submit the scholarship application by Friday. Also, research internship opportunities for summer 2026. Schedule a meeting with Professor Lee next week.</p>
                    </div>
                </div>
                <button
                    onClick={handleSyncGoogleClassroom}
                    className="add-button self-center mt-8 bg-purple-600 hover:bg-purple-700 transition duration-200"
                >
                    Sync Google Classroom Data
                </button>
            </div>
          )}

          {/* Calendar Page */}
          {currentPage === 'calendar' && (
            <div className="calendar-page">
                <div className="calendar-grid">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="calendar-day-name">{day}</div>
                    ))}
                    {/* Placeholder cells for days before the 1st of the month */}
                    {[...Array(2)].map((_, i) => (
                        <div key={`inactive-${i}`} className="calendar-day-cell inactive"></div>
                    ))}
                    {/* Example Calendar Days - will be dynamically generated */}
                    {[...Array(30)].map((_, i) => {
                        const day = i + 1;
                        const isToday = day === 21; // Example: assuming today is the 21st
                        const progress = (day * 3) % 100; // Example dynamic progress
                        let progressBarClass = 'green';
                        if (progress < 40) progressBarClass = 'red';
                        else if (progress < 70) progressBarClass = 'yellow';

                        return (
                            <div key={`day-${day}`} className={`calendar-day-cell ${isToday ? 'today' : ''}`}>
                                <span className="day-number">{day}</span>
                                <div className="progress-bar-small">
                                    <div className={`progress-bar-small-inner ${progressBarClass}`} style={{ width: `${progress}%` }}></div>
                                </div>
                                {day % 3 === 0 && <span className="event-text">Project Due</span>}
                                {day % 5 === 0 && <span className="event-text">Exam Study</span>}
                            </div>
                        );
                    })}
                </div>
            </div>
          )}

          {/* Add Task Page */}
          {currentPage === 'add-task' && (
            <div className="add-task-page">
                <div className="add-task-card box">
                    <h3 className="card-title">Add New Task</h3>
                    <div className="input-group">
                        <label htmlFor="taskName">Task Name</label>
                        <input type="text" id="taskName" placeholder="e.g., Complete Calculus Assignment" />
                    </div>
                    <div className="input-group-grid">
                        <div className="input-group">
                            <label htmlFor="taskCategory">Category</label>
                            <select id="taskCategory">
                                <option value="">Select Category</option>
                                <option value="Academics">Academics</option>
                                <option value="Personal">Personal</option>
                                <option value="Work">Work</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label htmlFor="taskPriority">Priority</label>
                            <select id="taskPriority">
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label htmlFor="taskDueDate">Due Date</label>
                            <input type="date" id="taskDueDate" />
                        </div>
                        <div className="input-group">
                            <label htmlFor="taskDueTime">Due Time</label>
                            <input type="time" id="taskDueTime" />
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="taskDescription">Description (Optional)</label>
                        <textarea id="taskDescription" placeholder="Add more details about this task..."></textarea>
                    </div>
                    <button className="add-button">Add Task</button>
                </div>

                <div className="add-category-card box">
                    <h3 className="card-title">Add New Habit</h3>
                    <div className="input-group">
                        <label htmlFor="habitName">Habit Name</label>
                        <input type="text" id="habitName" placeholder="e.g., Daily Reading" />
                    </div>
                    <div className="input-group">
                        <label>Repeat Days</label>
                        <div className="repeat-days-selector">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                                <span key={index} className="day-dot">{day}</span>
                            ))}
                        </div>
                    </div>
                    <div className="input-group">
                        <label htmlFor="habitGoal">Goal (e.g., 30 mins)</label>
                        <input type="text" id="habitGoal" placeholder="e.g., 30 mins, 5 pages" />
                    </div>
                    <button className="add-button">Add Habit</button>
                </div>
            </div>
          )}

          {/* Study Plan Page */}
          {currentPage === 'plan' && (
            <div className="plan-page">
                <div className="plan-summary-grid">
                    <div className="plan-summary-item progress-summary box">
                        <div className="label">Tasks Completed</div>
                        <div className="value">75%</div>
                    </div>
                    <div className="plan-summary-item time-summary box">
                        <div className="label">Study Time This Week</div>
                        <div className="value">12h 30m</div>
                    </div>
                    <div className="plan-summary-item exams-summary box">
                        <div className="label">Upcoming Exams</div>
                        <div className="value">3</div>
                    </div>
                </div>

                <div className="scheduled-tasks-list">
                    <h3>Today's Study Plan</h3>
                    <div className="scheduled-task-card box">
                        <span className="time-slot">09:00 AM</span>
                        <div className="task-details">
                            <div className="task-name">Calculus Review</div>
                            <div className="tags">
                                <span className="tag priority-high">High Priority</span>
                                <span className="tag custom-task">Academics</span>
                            </div>
                        </div>
                        <span className="task-checkbox"></span>
                    </div>
                    <div className="scheduled-task-card box">
                        <span className="time-slot">10:30 AM</span>
                        <div className="task-details">
                            <div className="task-name">Break</div>
                            <div className="tags">
                                <span className="tag custom-task">Personal</span>
                            </div>
                        </div>
                        <span className="task-checkbox checked">✔</span>
                    </div>
                    <div className="scheduled-task-card box">
                        <span className="time-slot">11:00 AM</span>
                        <div className="task-details">
                            <div className="task-name">Physics Homework</div>
                            <div className="tags">
                                <span className="tag priority-medium">Medium Priority</span>
                                <span className="tag custom-task">Academics</span>
                            </div>
                        </div>
                        <span className="task-checkbox"></span>
                    </div>
                    <div className="scheduled-task-card box">
                        <span className="time-slot">02:00 PM</span>
                        <div className="task-details">
                            <div className="task-name">English Essay Outline</div>
                            <div className="tags">
                                <span className="tag priority-high">High Priority</span>
                                <span className="tag custom-task">Academics</span>
                            </div>
                        </div>
                        <span className="task-checkbox"></span>
                    </div>
                </div>
            </div>
          )}

          {/* GPA Calculator Page */}
          {currentPage === 'gpa-calculator' && (
            <div className="gpa-calculator-page">
                <div className="gpa-calculator-section box">
                    <h3 className="card-title">Add Course Grades</h3>
                    <div className="input-group">
                        <label htmlFor="courseName">Course Name</label>
                        <input type="text" id="courseName" placeholder="e.g., Advanced Algebra" />
                    </div>
                    <div className="input-group-grid">
                        <div className="input-group">
                            <label htmlFor="courseCredits">Credits</label>
                            <input type="number" id="courseCredits" placeholder="e.g., 3" min="0.5" step="0.5" />
                        </div>
                        <div className="input-group">
                            <label htmlFor="courseGrade">Grade (4.0 Scale)</label>
                            <input type="number" id="courseGrade" placeholder="e.g., 3.7" min="0" max="4" step="0.01" />
                        </div>
                    </div>
                    <button className="add-button">Add Course</button>

                    <table className="course-list">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Credits</th>
                                <th>Grade</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                            <tbody>
                                <tr>
                                    <td>Biology I</td>
                                    <td>4</td>
                                    <td>3.5</td>
                                    <td><button className="remove-btn">Remove</button></td>
                                </tr>
                                <tr>
                                    <td>Introduction to Psychology</td>
                                    <td>3</td>
                                    <td>4.0</td>
                                    <td><button className="remove-btn">Remove</button></td>
                                </tr>
                                <tr>
                                    <td>College Writing</td>
                                    <td>3</td>
                                    <td>3.0</td>
                                    <td><button className="remove-btn">Remove</button></td>
                                </tr>
                            </tbody>
                    </table>

                    <div className="gpa-result">
                        <span>Calculated GPA:</span> 3.58
                    </div>
                </div>
            </div>
          )}


          {/* Settings Page */}
          {currentPage === 'settings' && (
            <div className="settings-page">
                <div className="settings-section box">
                    <h3 className="card-title">User Settings</h3>
                    <div className="setting-item">
                        <label htmlFor="darkModeToggle">Dark Mode</label>
                        <label className="switch">
                            <input
                                type="checkbox"
                                id="darkModeToggle"
                                checked={userProfile?.darkMode || false}
                                onChange={async (e) => {
                                    if (db && userId) {
                                        const profileRef = getUserDocRef(db, userId, 'userProfile', 'profile');
                                        try {
                                            await setDoc(profileRef, { darkMode: e.target.checked }, { merge: true });
                                            setUserProfile(prev => ({ ...prev, darkMode: e.target.checked }));
                                            console.log("Dark mode updated to:", e.target.checked);
                                        } catch (error) {
                                            console.error("Error updating dark mode:", error);
                                            setAuthError(`Failed to update setting: ${error.message}`);
                                        }
                                    }
                                }}
                            />
                            <span className="slider round"></span>
                        </label>
                    </div>
                    <div className="setting-item">
                        <label htmlFor="accentColorPicker">Accent Color</label>
                        <input
                            type="color"
                            id="accentColorPicker"
                            value={userProfile?.accentColor || '#3498DB'}
                            onChange={async (e) => {
                                if (db && userId) {
                                    const profileRef = getUserDocRef(db, userId, 'userProfile', 'profile');
                                    try {
                                        await setDoc(profileRef, { accentColor: e.target.value }, { merge: true });
                                        setUserProfile(prev => ({ ...prev, accentColor: e.target.value }));
                                        // Dynamic update of CSS variables
                                        document.documentElement.style.setProperty('--color-blue', e.target.value);
                                        document.documentElement.style.setProperty('--color-dark-blue', darkenColor(e.target.value, 10)); // Darken for hover
                                        console.log("Accent color updated to:", e.target.value);
                                    } catch (error) {
                                        console.error("Error updating accent color:", error);
                                        setAuthError(`Failed to update setting: ${error.message}`);
                                    }
                                }
                            }}
                        />
                    </div>
                    <div className="setting-item">
                        <label>Google Classroom Sync</label>
                        <button onClick={handleSyncGoogleClassroom} className="settings-button">Sync Now</button>
                    </div>
                    <div className="setting-item">
                        <label>Account Management</label>
                        <button onClick={handleSignOut} className="settings-button bg-red-500 hover:bg-red-600">Sign Out</button>
                    </div>
                </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <ConfirmationModal
        message={modalMessage}
        onConfirm={modalOnConfirm}
        onCancel={() => setIsModalOpen(false)}
        isOpen={isModalOpen}
      />
      <ErrorReportingModal
          errorMessage={authError}
          onClose={() => setAuthError(null)}
          isOpen={authError !== null}
      />
    </>
  );
}

// Top-level App component that wraps MainDashboardApp with FirebaseProvider
function App() {
  return (
    <FirebaseProvider>
      <MainDashboardApp />
    </FirebaseProvider>
  );
}

// Export the main component
export default App;

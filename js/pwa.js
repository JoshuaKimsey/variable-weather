/**
 * PWA functionality for the Weather App
 */

import { initUpdateSystem } from './pwaUpdates.js';

// Register the service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/variable-weather/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);

                // Check if there's a waiting service worker
                if (registration.waiting) {
                    console.log('New service worker waiting on load');
                    document.dispatchEvent(new CustomEvent('updateAvailable'));
                }

                // Check for a new service worker installing
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;

                    if (newWorker) {
                        console.log('New service worker installing');

                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                console.log('New service worker installed and waiting');
                                document.dispatchEvent(new CustomEvent('updateAvailable'));
                            }
                        });
                    }
                });
            })
            .catch(error => {
                console.log('ServiceWorker registration failed: ', error);
            });

        // Listen for controller changes from other service worker instances/tabs
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('New service worker controller, reloading for updated content');
            window.location.reload();
        });
    });
}

// Variables to store install prompt
let deferredPrompt;
const installButton = document.getElementById('install-button');
const installContainer = document.getElementById('install-container');

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Update UI to notify the user they can add to home screen
    if (installContainer) {
        installContainer.style.display = 'block';

        installButton.addEventListener('click', (e) => {
            // Hide our user interface that shows our install button
            installContainer.style.display = 'none';

            // Show the install prompt
            deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
            });
        });
    }
});

// Listen for the appinstalled event
window.addEventListener('appinstalled', (evt) => {
    console.log('Weather App was installed');
});

// Initialize the PWA update system
document.addEventListener('DOMContentLoaded', () => {
    // Initialize update system
    initUpdateSystem();
});
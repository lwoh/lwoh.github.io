//const API_KEY = 'AIzaSyA9_lqm7_bWYvsQFyU2hdZstbmMyS2aSH8'; //TEST
const API_KEY = 'AIzaSyDGANtO2UlWa0BmDNVwdzDBbeTqVt6vOAk';

// Create the script tag, set the appropriate attributes
var script = document.createElement('script');
script.src = 'https://maps.googleapis.com/maps/api/js?key=' + API_KEY + '&libraries=places';
script.defer = false;

// Attach your callback function to the `window` object
//window.initGoogleMapCallback = function() {
  // JS API is loaded and available
//};

// Append the 'script' element to 'head'
document.head.appendChild(script);
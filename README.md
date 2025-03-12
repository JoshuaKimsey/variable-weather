# Variable Weather

<p align="center">
  <img src="icons/icon-512x512.png" alt="Variable Weather Logo" width="200">
</p>

<p align="center">
  A beautiful, animated weather application focused on providing accurate, detailed weather information with a clean, intuitive interface. Inspired by <a href="https://github.com/breezy-weather/breezy-weather">Breezy Weather</a> for Android.
</p>

<p align="center">
  <a href="https://joshuakimsey.github.io/variable-weather/">Live Demo</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#technology">Technology</a> •
  <a href="#api-keys">API Keys</a> •
  <a href="#license">License</a>
</p>

<!-- <p align="center">
  <img src="screenshots/app-screenshot.png" alt="App Screenshot" width="800">
</p> -->

## Features

- **Beautiful Animated Visuals** - Dynamic backgrounds and icons that change based on current conditions
- **Detailed Information** - Presenting the weather information that you need:
  - Current conditions,
  - 7 day forecast
  - Hourly forecasts
  - Weather alerts
  - Weather radar, with integrated severe weather alert polygons
  - Astronomical data, including sunrise/sunset times, day length, and moon phases (more to come!)
- **Dual API System** - Uses National Weather Service data for US locations and Pirate Weather API globally
- **Smart Location Detection** - Automatic geolocation with manual search options
- **Progressive Web App (PWA)** - Install on any device with automatic updates
- **Built Using Plain JS** - No heavy frameworks such as React or Vue, built using standard HTML/CSS/JS
- **Unit Conversion** - Toggle between imperial (°F) and metric (°C) units
- **Responsive Design** - Optimized for all devices from mobile to desktop
- **Weather Alerts** - Color-coded severity indicators for active weather alerts
- **More To Come** - More features are to be added... Stay tuned! 

## Installation

### As a Progressive Web App

1. Visit [Variable Weather](https://joshuakimsey.github.io/variable-weather/) in your browser
2. Your browser will show an "Install" or "Add to Home Screen" option
3. Click to install the app on your device
4. The app will now be available from your home screen or app launcher

### From Source
*Please note: Because the PWA is currently setup to operate from GitHub Pages, you will need to adjust the manifest and service workers files to allow for the PWA function to be activated if you are hosting this on your own machine or elsewhere.*

```bash
# Clone the repository
git clone https://github.com/JoshuaKimsey/variable-weather.git

# Navigate to the project directory
cd variable-weather

# You can use a live preview extension in VS Code to test this.
# Alternatively, you can use your own web server of choice.
```

## Usage

### Finding Weather for Your Location

- **Automatic Location**: Click the location arrow icon to use your current location
- **Manual Search**: Enter a location (city, state, country) in the search box

### Reading Weather Information

- **Current Conditions**: The main display shows current temperature, conditions, and weather icon
- **Details**: View wind speed, humidity, pressure, and visibility information
- **Forecast**: Scroll horizontally to view the 7-day forecast
- **Alerts**: Any active weather alerts will appear at the top - click to expand for details
- **Weather Radar**: See precipitation in your area or around the world
  - **Integrated Severe Alert Polygons**: See Severe Weather Alerts on the map (US only currently)
- **Astronomical Data**: Progression of the sun, when it rises and sets, and the phases of the moon

### Customization Options

- **Unit Toggle**: Switch between Fahrenheit and Celsius using the settings menu
- **API Settings**: Add your Pirate Weather API key for non-US locations

### PWA Updates

When a new version is available, and it has not already automatically updated, you will see an update notification. Click "Update Now" to get the latest features and improvements.

## Technology

- **Frontend**: HTML5, CSS3, & Plain JavaScript (ES6+)
- **Weather Data**: National Weather Service API, Pirate Weather API, Rain Viewer
- **Geocoding**: OpenStreetMap Nominatim API, Leaflet
- **Timezone Lookup**: TZ-Lookup
- **Animation**: CSS Animations, SVG Graphics

## API Keys

Variable Weather uses free weather data providers when possible:

- **US Locations**: National Weather Service API (no key required)
- **Non-US Locations**: [Pirate Weather API](https://pirateweather.net/) (requires free API key)

To add your Pirate Weather API key:
1. Get a free key from [Pirate Weather](https://pirateweather.net/getting-started)
2. Click the settings gear icon in the app
3. Enter your API key and save

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Breezy Weather](https://github.com/breezy-weather/breezy-weather)
- Weather data provided by [National Weather Service](https://www.weather.gov/) and [Pirate Weather](https://pirateweather.net/)
- Radar data provided by [Rain Viewer](https://www.rainviewer.com/)
- Mapping data provided by [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors via [Leaflet](https://leafletjs.com/)
- Timezone lookup functionality provided by PhotoStructure's [tz-lookup](https://github.com/photostructure/tz-lookup)
- Icons and animations created with CSS and SVG
- Special thanks to Anthropic's <a href="https://claude.ai">Claude 3.7 Sonnet</a> for helping in the building and creation of this app

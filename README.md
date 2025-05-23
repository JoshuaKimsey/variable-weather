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
  - Precipitation nowcasting
  - Hourly forecasts
  - Weather alerts
  - Weather radar, with integrated severe weather alert polygons in it's own larger popout modal
  - Astronomical data, including sunrise/sunset times, day length, and moon phases (more to come!)
- **Modular API System** - Uses the Open-Meteo API globally for weather by default
  - Other API options include Pirate Weather (Global, requires a free API key), OpenWeatherMap (Global, requires a free API key) or the National Weather Service (US)
  - The modular API system allows new sources to be added easily as well (Please see the [Custom Weather API Guide](js/api/custom-weather-api-guide.md))
- **Smart Location Detection** - Automatic geolocation with manual search options
- **Progressive Web App (PWA)** - Install on any device with automatic updates
- **Built Using Plain JS** - No heavy frameworks such as React or Vue, built using standard HTML/CSS/JS
- **Unit Conversion** - Toggle between imperial (°F) and metric (°C) units
- **Responsive Design** - Optimized for all devices from desktop to mobile
- **Weather Alerts** - Color-coded severity indicators for active weather alerts
- **More To Come** - More features are to be added... Stay tuned! 

## Installation

### As a Progressive Web App

1. Visit [Variable Weather](https://joshuakimsey.github.io/variable-weather/) in your browser
2. Your browser will show an "Install" or "Add to Home Screen" option
3. Click to install the app on your device
4. The app will now be available from your home screen or app launcher

### From Source
*Please note: Because the PWA is currently setup to operate from GitHub Pages, you may need to adjust the manifest and service workers files to allow for the PWA function to be activated if you are hosting this on your own machine or elsewhere.*

*Note on NWS User-Agent: If you deploy this app elsewhere, please change the user-agent string found in the config.js file to match your contact information.*

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
- **Forecast**: Scroll horizontally to view the 7-day and hourly forecast
  - **Nowcast**: Click on individual bars to see the precipitation type, probability, and intensity for that time period
- **Alerts**: Any active weather alerts will appear at the top (US location for now) - click to expand for details
- **Weather Radar**: See precipitation in your area or around the world, click the radar icon in the bottom-right to view it
  - **Integrated Severe Alert Polygons**: See Severe Weather Alerts on the map (US only currently)
- **Astronomical Data**: Progression of the sun, when it rises and sets, and the phases of the moon

### Customization Options

- **Unit Toggle**: Switch between Fahrenheit and Celsius using the settings menu
- **Icon Switching**: Switch between the dynamically generated icons or meteocons
  - Note: On mobile devices, Meteocons will be enabled as the default choice upon first start. However, once this is changed, the user's choice will become the default instead.
- **API Settings**: Choose which API sources to use for global, regional, and nowcasting weather
  - For sources requiring an API key, selecting such a source will reveal the box for inputting your key

### PWA Updates

When a new version is available, and it has not already automatically updated, you will see an update notification. Click "Update Now" to get the latest features and improvements.

## Technology

- **Frontend**: HTML5, CSS3, & Plain JavaScript (ES6+), with Bootstrap for styling and font-icons
- **Weather Data**: Open_Meteo [(CC BY 4.0)](https://creativecommons.org/licenses/by/4.0), Pirate Weather API, OpenWeatherMap, The National Weather Service (US), Rain Viewer
- **Geocoding**: OpenStreetMap Nominatim API, Leaflet
- **Timezone Lookup**: TZ-Lookup
- **Astronomical Data**: SunCalc3
- **Weather Icons**: Dynamically generated icons, Meteocons
- **Animation**: CSS Animations, SVG Graphics

## API Keys

Variable Weather uses free weather data providers when possible, however, options with API keys also exist:

- **Global Locations**: [Pirate Weather API](https://pirateweather.net/) (requires free API key)
- **Global Locations**: [OpenWeatherMap](https://openweathermap.org/) (requires free API key)

To add your Pirate Weather API key:
1. Get a free key from [Pirate Weather](https://pirateweather.net/getting-started)
2. Click the settings gear icon in the app
3. Enter your API key and save

To add your OpenWeatherMap API key:
1. Get a free key from [OpenWeatherMap](https://openweathermap.org/api)
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
- Weather data provided by [Open-Meteo](https://open-meteo.com/), [Pirate Weather](https://pirateweather.net/), [OpenWeatherMap](https://openweathermap.org/), and the [National Weather Service](https://www.weather.gov/)
- Radar data provided by [Rain Viewer](https://www.rainviewer.com/)
- Mapping data provided by [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors via [Leaflet](https://leafletjs.com/)
- Timezone lookup functionality provided by PhotoStructure's [tz-lookup](https://github.com/photostructure/tz-lookup)
- Astronomical data functionality provided by [SunCalc3](https://github.com/Hypnos3/suncalc3)
- Dynamic icons and animations created with CSS and SVG
- Meteocons created and provided by [Bas Milius](https://github.com/basmilius/weather-icons)
- Special thanks to Anthropic's <a href="https://claude.ai">Claude 3.7 Sonnet</a> for helping in the building and creation of this app

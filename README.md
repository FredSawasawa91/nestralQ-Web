# NestralQ Web - Smart Home Control

A vanilla HTML/CSS/JavaScript smart home control application with Firebase Realtime Database integration. Compatible with GitHub Pages hosting.

## Features

- **Sensor Monitoring**: Temperature, humidity, light intensity, and motion detection
- **Device Controls**: Fan, heater, bulb, and automation mode toggles
- **Temperature Thresholds**: Configurable min/max temperature limits
- **Dark Mode**: Light/dark theme with localStorage persistence
- **Connection Modes**: Online (Firebase) or Bluetooth/Offline mode
- **Real-time Updates**: Firebase Realtime Database listeners keep UI in sync
- **Responsive Design**: Works on mobile, tablet, and desktop

## File Structure

```
NestralQ Web/
├── index.html              # Main HTML file
├── css/
│   └── style.css           # All styles (variables, layout, theme, responsive)
├── js/
│   ├── config.js           # Firebase configuration
│   ├── firebase.js         # Firebase SDK init + listeners + write functions
│   ├── state.js            # Application state management
│   ├── ui.js               # DOM manipulation and event listeners
│   └── main.js             # Application entry point
├── assets/
│   └── icons/
│       ├── home.svg
│       ├── settings.svg
│       └── motion.svg
└── README.md               # This file
```

## Firebase Configuration

The `js/config.js` file is **pre-configured** with the same Firebase project as the React Native app (`sha-app-fc4f5`):

- **Project ID**: `sha-app-fc4f5`
- **Database URL**: `https://sha-app-fc4f5-default-rtdb.firebaseio.com`
- **API Key**: `AIzaSyCi3z4bqpUC5Ayu5z9KDrA2gTZy8-RnvDE`

No configuration changes are needed if you're using the same Firebase project as the RN app.

If you want to use a different Firebase project, edit `js/config.js` with your own credentials from the Firebase Console Project Settings.

## Firebase Security Rules

## Expected Database Structure

```json
{
  "sensors": {
    "temperature": 23.5,
    "humidity": 45,
    "lightIntensity": 500,
    "motionDetected": 0
  },
  "commands": {
    "fan": false,
    "heater": false,
    "bulb": false
  },
  "settings": {
    "autoMode": true,
    "minTemp": 22,
    "maxTemp": 28,
    "connectionMode": "online"
  }
}
```

## Local Development

Simply open `index.html` in a browser or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## GitHub Pages Deployment

1. Create a new repository on GitHub (e.g., `nestralq-web`)
2. Push all files to the `main` branch
3. Go to Settings → Pages
4. Under "Build and deployment", select:
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/ (root)`
5. Click Save
6. Your site will be available at `https://<username>.github.io/nestralq-web/`

## Browser Compatibility

- Chrome/Edge 80+
- Firefox 75+
- Safari 13.1+
- Uses ES6 modules (`type="module"`)
- Uses Firebase Web SDK v10 (CDN)

## License

MIT License
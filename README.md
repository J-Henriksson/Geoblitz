# GeoBlitz

GeoBlitz is a web-based game where players are dropped into random locations on Google Street View with the goal of as accurately as possible pinpointing their location on a world map by analyzing the visual clues and landmarks within their surroundings.

GeoBlitz is developed primarily using React and Node.js.

### Features:
* Randomized Locations
* Google Maps API Integration

## Development Stack:
* **Frontend:** Developed using React.js, providing a responsive and intuitive user interface for seamless gameplay across devices.
* **Backend:** Powered by Node.js, handling data management, user authentication, and game logic to ensure smooth performance.
* **Google Maps API:** Integrating Google Maps API to retrieve location data, generate maps, and enable interactive exploration within the game environment.

## How to Play:

### 1. Get a Google Maps API Key

Obtain a Google API key from [Google Cloud Console](https://console.cloud.google.com/)

### 2. Clone the Repository and Configure the API Key

Open your terminal and clone the repository by running:
   ```bash
   git clone "link to this repo"
   ```
 
Navigate to the cloned repository folder, then replace the placeholder value in the GOOGLE_MAPS_API_KEY variable with your newly acquired API key.

### 3. Install dependencies

Install all of the projects dependencies using 
```bash
   npm install
   ```

### 4. Run the Application

Now you can start the application by running the following command from the terminal while in the repository's root folder:

```bash
   npm start
```
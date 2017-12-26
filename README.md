Development
-----------

These instructions are tested on a Mac:

1. Make sure MongoDB and Redis are installed and running.
   ```sh
   brew update
   brew install mongodb redis
   mongod --config /usr/local/etc/mongod.conf  # Run in its own Terminal window.
   redis-server # Run in its own Terminal window.
   ```

2. Make sure Node.js and dependencies are installed.
   ```sh
   brew install node
   npm install
   ```

3. Run the updater script and the application.
   ```sh
   node updater.js
   node app.js  # Run in its own Terminal window.
   ```

4. Open the application in your browser.
   ```sh
   open 'http://localhost:8737'
   ```

5. Add some instances (e.g `mastodon.social`, `mastodon.xyz`) by entering them in the text box at the bottom of the page and clicking **Add instance**.

6. Reload the page.

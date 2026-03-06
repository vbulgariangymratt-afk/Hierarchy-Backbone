# Navigate to the project folder explicitly
cd "/Users/Casa/Documents/Terminal app"
# Add common paths for npm
export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin

echo "🍅 Starting Tomato App Server..."
echo "You can minimize this window, but don't close it while using the app!"
echo "-------------------------------------------------------------------"
npm run dev

# Keep window open if it crashes
echo "-------------------------------------------------------------------"
echo "Server stopped. Press Enter to close this window."
read

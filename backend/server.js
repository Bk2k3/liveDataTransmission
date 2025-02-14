const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const DisplayData = require('./models/DisplayData');
const { auth } = require('express-oauth2-jwt-bearer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Auth0 configuration
const authConfig = {
    domain: 'YOUR_DOMAIN_NAME', //something like "dev-xxxxxxxxxxxxxxxx.us.auth0.com"
    audience: 'YOUR_IDENTIFIER_URL' //something like "http://localhost/api"
};

// JWT validation middleware
const checkJwt = auth({
    audience: authConfig.audience,
    issuerBaseURL: `https://${authConfig.domain}/`,
    algorithms: ['RS256']
});

// Add authorization logging middleware
const authLogging = (req, res, next) => {
    console.log('Authorized');
    next();
};

// File storage setup
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'display_data.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending_updates.json');

// Initialize storage
const initializeStorage = async () => {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        // Initialize pending updates file if it doesn't exist
        try {
            await fs.access(PENDING_FILE);
        } catch {
            await fs.writeFile(PENDING_FILE, JSON.stringify([], null, 2));
        }
        // Initialize current data file if it doesn't exist
        try {
            await fs.access(DATA_FILE);
        } catch {
            await fs.writeFile(DATA_FILE, JSON.stringify([], null, 2));
        }
    } catch (err) {
        console.error('Error initializing storage:', err);
    }
};

// Save data to local file with timestamp
const saveToFile = async (data) => {
    try {
        const timestamp = new Date();
        const entry = { ...data, timestamp };

        // Read existing data
        let fileData = [];
        try {
            const content = await fs.readFile(DATA_FILE, 'utf8');
            fileData = JSON.parse(content);
            if (!Array.isArray(fileData)) {
                console.warn("display_data.json content is not an array. Resetting to empty array.");
                fileData = [];
            }
        } catch (err) {
            console.error('Error reading file, starting fresh:', err);
        }

        // Append new data
        fileData.push(entry);

        // Save updated data
        await fs.writeFile(DATA_FILE, JSON.stringify(fileData, null, 2));
        return entry;
    } catch (err) {
        console.error('Error saving to file:', err);
        return null;
    }
};

// Save to pending updates when MongoDB is disconnected
const saveToPending = async (data) => {
    try {
        let pendingData = [];
        try {
            const content = await fs.readFile(PENDING_FILE, 'utf8');
            pendingData = JSON.parse(content);
            if (!Array.isArray(pendingData)) {
                console.warn("pending_updates.json content is not an array. Resetting to empty array.");
                pendingData = [];
            }
        } catch (err) {
            console.error('Error reading pending file, starting fresh:', err);
        }

        pendingData.push(data);
        await fs.writeFile(PENDING_FILE, JSON.stringify(pendingData, null, 2));
    } catch (err) {
        console.error('Error saving to pending file:', err);
    }
};

// Sync pending updates with MongoDB
const syncPendingUpdates = async () => {
    if (mongoose.connection.readyState !== 1) return;

    try {
        const content = await fs.readFile(PENDING_FILE, 'utf8');
        const pendingData = JSON.parse(content);

        if (Array.isArray(pendingData) && pendingData.length > 0) {
            console.log(`Syncing ${pendingData.length} pending updates to MongoDB`);
            
            for (const data of pendingData) {
                try {
                    const displayData = new DisplayData(data);
                    await displayData.save();
                } catch (err) {
                    console.error('Error syncing individual update:', err);
                    return; // Stop if we encounter an error
                }
            }

            // Clear pending updates after successful sync
            await fs.writeFile(PENDING_FILE, JSON.stringify([], null, 2));
            console.log('Pending updates synced successfully');
        }
    } catch (err) {
        console.error('Error syncing pending updates:', err);
    }
};

// MongoDB Connection with retry logic (deprecated options removed)
//replace 'YOUR_MONGO_URL' with something like mongodb+srv:/<username>:<password>@<database_name>...
const connectWithRetry = async () => {
    try {
        await mongoose.connect('YOUR_MONGO_URL', {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('Connected to MongoDB');
        // Sync pending updates when connection is established
        await syncPendingUpdates();
    } catch (err) {
        console.error('MongoDB connection error:', err);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

// Initialize storage and start MongoDB connection
initializeStorage().then(() => {
    connectWithRetry();
});

// Protected API routes
app.get('/api/display-data', checkJwt, authLogging, async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const data = await DisplayData.find().sort({ _id: -1 }).limit(1);
            res.json(data);
        } else {
            // If MongoDB is disconnected, return data from local file
            const fileContent = await fs.readFile(DATA_FILE, 'utf8');
            const fileData = JSON.parse(fileContent);
            res.json(fileData.slice(-1)); // Return most recent entry
        }
    } catch (err) {
        res.status(500).json({ message: 'Data unavailable' });
    }
});

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log('Client connected');

    // Initialize segments
    let currentData = {
        segment1: Array(4).fill(0),
        segment2: Array(4).fill(0),
        segment3: Array(4).fill(0)
    };

    // Function to generate random segment
    const generateSegment = () => Array.from({ length: 4 }, () => Math.floor(Math.random() * 10));

    // Function to get random interval (between 1000ms and 3000ms)
    const getRandomInterval = () => Math.floor(Math.random() * (3000 - 1000 + 1) + 1000);

    // Function to update and emit a specific segment
    const updateSegment = async (segmentName) => {
        currentData[segmentName] = generateSegment();

        // Save to local storage
        const savedEntry = await saveToFile(currentData);

        // Emit update to client
        socket.emit('numberUpdate', currentData);

        // Try to save to MongoDB
        if (mongoose.connection.readyState === 1) {
            try {
                const displayData = new DisplayData(currentData);
                await displayData.save();
                console.log(`${segmentName} updated and saved to DB:`, currentData[segmentName]);
            } catch (err) {
                console.error('Error saving to MongoDB:', err);
                await saveToPending(savedEntry);
            }
        } else {
            // If MongoDB is disconnected, save to pending updates
            await saveToPending(savedEntry);
        }

        // Schedule next update
        setTimeout(() => updateSegment(segmentName), getRandomInterval());
    };

    // Start independent updates for each segment
    updateSegment('segment1');
    updateSegment('segment2');
    updateSegment('segment3');

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// MongoDB connection event handlers
mongoose.connection.on('connected', async () => {
    console.log('MongoDB connected');
    await syncPendingUpdates();
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    process.exit(0);
});

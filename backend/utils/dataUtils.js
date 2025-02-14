const fs = require('fs').promises;
const path = require('path');

// File paths
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'display_data.json');

// Ensure data directory exists
const initializeStorage = async () => {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (err) {
        console.error('Error creating data directory:', err);
    }
};

// Save data to local file
const saveToFile = async (data) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving to file:', err);
    }
};

// Read data from local file
const readFromFile = async () => {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading from file:', err);
        return null;
    }
};

// Simple anomaly detection based on statistical analysis
const detectAnomalies = (segments, historicalData) => {
    const anomalies = {};
    const threshold = 2; // Standard deviations threshold

    for (const segmentName in segments) {
        const currentSegment = segments[segmentName];
        const historicalSegments = historicalData.map(record => record[segmentName]);

        // Calculate mean and standard deviation of digit changes
        const changes = historicalSegments.slice(1).map((seg, i) => {
            return seg.reduce((sum, digit, j) => sum + Math.abs(digit - historicalSegments[i][j]), 0);
        });

        const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
        const stdDev = Math.sqrt(changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length);

        // Check current change against threshold
        const currentChange = currentSegment.reduce((sum, digit, i) => {
            return sum + Math.abs(digit - (historicalSegments[historicalSegments.length - 1]?.[i] || 0));
        }, 0);

        if (Math.abs(currentChange - mean) > threshold * stdDev) {
            anomalies[segmentName] = {
                severity: 'high',
                change: currentChange,
                expected: mean,
                deviation: Math.abs(currentChange - mean) / stdDev
            };
        }
    }

    return anomalies;
};

module.exports = {
    initializeStorage,
    saveToFile,
    readFromFile,
    detectAnomalies
};
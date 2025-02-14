import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:5000');

function App() {
  const [displayData, setDisplayData] = useState({
    segment1: Array(4).fill(0),
    segment2: Array(4).fill(0),
    segment3: Array(4).fill(0),
  });

  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    // Listen for number updates
    socket.on('numberUpdate', (newData) => {
      setDisplayData(newData);
      setIsAnimating(true); // Trigger animation on update
      setTimeout(() => setIsAnimating(false), 1000); // Reset animation after 1 second
    });

    // Cleanup on component unmount
    return () => {
      socket.off('numberUpdate');
    };
  }, []);

  return (
    <div className="App">
      <h1 className="header">12-Digit Display</h1>
      <div className="display-container">
        {['segment1', 'segment2', 'segment3'].map((segment, segmentIndex) => (
          <div key={segmentIndex} className="segment">
            {displayData[segment].map((number, index) => (
              <div
                key={index}
                className={`digit ${isAnimating ? 'pulse-animation' : ''}`}
              >
                {number}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="message">Real-time Updates for Randomized Data</p>
    </div>
  );
}

export default App;
